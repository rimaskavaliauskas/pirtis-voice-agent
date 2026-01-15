# Skill Evolution System

LLM-driven continuous improvement system that learns from expert feedback to improve interview quality.

## Overview

The skill evolution system creates a feedback loop:

```
Interview Sessions
       |
       v
Expert Reviews (rate questions, suggest improvements)
       |
       v
Rule Generation (LLM analyzes feedback patterns)
       |
       v
Admin Approval (curate generated rules)
       |
       v
Skill Update (LLM integrates rules into skill document)
       |
       v
New Skill Version (activated for future interviews)
```

## Components

### 1. Expert Reviews

Experts review completed interview sessions to provide feedback.

**Access**: Admin Panel > Review Tab > Select Session > `/admin/review/[id]`

**Review Form**:
- **Reviewer Name**: Who is providing the review
- **Overall Rating**: 1-5 stars for the entire session
- **Overall Comments**: General observations
- **Per-Question Reviews**:
  - Effectiveness rating (1-5)
  - What could be better
  - Suggested alternative question
  - Missed opportunities (what should have been asked)
- **Summary Review**:
  - Accuracy rating (1-5)
  - Completeness rating (1-5)
  - What's missing from the report

### 2. Rule Generation

LLM analyzes expert feedback patterns to generate actionable improvement rules.

**Access**: Admin Panel > Skill Tab > "Generate Rules" button

**Parameters**:
- `min_reviews`: Minimum reviews needed (default: 3)
- `since_days`: Look back period (default: 30 days)

**Process**:
1. Fetch recent expert reviews from database
2. Send to LLM with RULE_GENERATION_PROMPT
3. LLM identifies patterns and outputs structured rules
4. Rules saved to `skill_learned_rules` table with `approved=FALSE`

**Rule Types**:
| Type | Description |
|------|-------------|
| `question_improvement` | Improve wording/approach of existing question |
| `new_question` | Add new question to the bank |
| `topic_priority` | Change priority of certain topics |
| `report_template` | Modify report structure/content |
| `methodology` | Update interview methodology |

**Rule Structure**:
```json
{
  "rule_type": "question_improvement",
  "rule_text": "Klausimą apie krosnies tipą reikia užduoti anksčiau...",
  "rule_text_en": "The question about stove type should be asked earlier...",
  "confidence": 0.85,
  "source_pattern": "3/5 reviews mentioned stove timing",
  "affected_questions": ["Q_STOVE_TYPE", "Q_HEATING"]
}
```

### 3. Rule Approval Workflow

Admin reviews generated rules before they're incorporated.

**Access**: Admin Panel > Skill Tab > Pending Rules section

**Actions**:
- **Approve**: Mark rule for incorporation (remains in pending until skill is created)
- **Reject**: Delete rule from database

Rules are sorted by confidence score (highest first).

### 4. Skill Version Creation

LLM integrates approved rules into a new skill version.

**Access**: Admin Panel > Skill Tab > "Create Version" button

**Parameters**:
- `new_version`: Version string (e.g., "v2.1")
- `approved_rule_ids`: Array of rule IDs to incorporate
- `approved_by`: Admin name

**Process**:
1. Fetch current active skill content
2. Fetch approved rules by ID
3. Send to LLM with SKILL_UPDATE_PROMPT
4. LLM outputs updated skill document
5. Create new `skill_versions` record (not active)
6. Mark rules as incorporated in metadata

### 5. Version Activation

Admin reviews new skill version and activates it.

**Access**: Admin Panel > Skill Tab > Version list > "Activate" button

**Process**:
1. Deactivate all existing versions (`is_active = FALSE`)
2. Activate selected version (`is_active = TRUE`)
3. Clear skill cache (forces reload on next request)
4. Future interviews use new skill

## Database Tables

### `skill_versions`

Versioned skill documents:

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| version | VARCHAR(50) | Version string (e.g., "v1.0") |
| name | VARCHAR(255) | Descriptive name |
| content | TEXT | Full skill document (markdown) |
| created_at | TIMESTAMP | When created |
| approved_by | VARCHAR(255) | Who created it |
| approved_at | TIMESTAMP | When approved |
| is_active | BOOLEAN | Currently active (only one true) |
| parent_version_id | INT | Previous version FK |
| change_summary | TEXT | What changed |

### `skill_learned_rules`

Generated improvement rules:

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| rule_text | TEXT | Rule in Lithuanian |
| rule_type | VARCHAR(50) | question_improvement, new_question, etc. |
| confidence_score | FLOAT | LLM confidence (0-1) |
| source_pattern | TEXT | What feedback pattern triggered this |
| metadata | JSONB | Additional data (affected_questions, etc.) |
| approved | BOOLEAN | Admin approved |
| approved_at | TIMESTAMP | When approved |
| created_at | TIMESTAMP | When generated |

### `expert_reviews`, `question_reviews`, `summary_reviews`

See [Backend Architecture](./BACKEND-ARCHITECTURE.md) for full schema.

## API Endpoints

### Generate Rules
```
POST /admin/skill/rules/generate
Body: { "min_reviews": 3, "since_days": 30 }
Response: { "rules_generated": 5, "rules": [...] }
```

### List Pending Rules
```
GET /admin/skill/rules/pending
Response: [{ id, rule_text, rule_type, confidence_score, ... }]
```

### Approve Rule
```
POST /admin/skill/rules/{id}/approve
Response: { "success": true }
```

### Reject Rule
```
DELETE /admin/skill/rules/{id}
Response: { "success": true }
```

### Create Skill Version
```
POST /admin/skill/versions/create
Body: {
  "new_version": "v2.1",
  "approved_rule_ids": [1, 2, 3],
  "approved_by": "Admin Name"
}
Response: { "version_id": 5, "version": "v2.1" }
```

### Activate Version
```
POST /admin/skill/versions/{id}/activate
Response: { "success": true }
```

## Frontend Admin UI

### Review Tab
- Lists sessions with filters (language, reviewed status, completed only)
- Click session to open review form
- Shows existing review if session was previously reviewed

### Skill Tab
- **Versions section**: List all versions, view content, activate
- **Generate Rules button**: Triggers rule generation
- **Pending Rules section**: Approve/reject generated rules
- **Create Version button**: Opens modal to create from approved rules

## Best Practices

1. **Collect enough reviews**: Generate rules only when you have 3+ reviews
2. **Review rules carefully**: LLM suggestions need human judgment
3. **Test before activating**: Review new skill content before activation
4. **Version incrementally**: Small changes are easier to evaluate
5. **Document changes**: Use meaningful version names and summaries

## Troubleshooting

**No rules generated**:
- Check if enough reviews exist in the time window
- Verify reviews have substantive feedback (not just ratings)

**Poor quality rules**:
- Increase `min_reviews` threshold
- Ensure expert feedback is detailed and specific

**Skill update fails**:
- Check LLM quota (Gemini 429 errors)
- Verify current skill content is valid
- Check approved rules aren't contradictory
