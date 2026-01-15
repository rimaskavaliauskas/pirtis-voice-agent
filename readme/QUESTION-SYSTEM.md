# Question System Architecture

This document explains how interview questions are generated and selected in the Pirtis Voice Agent system.

## Overview

The system uses **two separate mechanisms** for questions:

| System | Purpose | Source |
|--------|---------|--------|
| **Brain Config (YAML)** | Predefined question pool | Database table `brain_questions` |
| **Skill Document** | AI guidelines & dynamic follow-ups | Database table `skill_versions` |

## 1. Brain Config Questions (Predefined Pool)

### How It Works

1. Questions are stored in the `brain_questions` database table
2. Each question has: `question_id`, `text_lt`, `text_en`, `slot_coverage`, `round_hint`, `enabled`
3. The scoring algorithm (`app/services/scoring.py`) selects the best questions based on:
   - **Missing slots** - questions that fill unfilled slots score higher
   - **Risk coverage** - questions that address active risk flags
   - **Round fit** - questions matching the current round (1, 2, or 3)
   - **Already asked** - penalty for questions already asked
   - **Skip rules** - conditional rules to skip irrelevant questions

### Question Selection Flow

```
Session Start
    │
    ▼
Load brain_config.questions (from database)
    │
    ▼
select_next_questions() in scoring.py
    │
    ├── Evaluate skip_rules (filter irrelevant questions)
    ├── Calculate missing_slots (slots not yet filled)
    ├── Score each question based on weights
    └── Return top N questions (3 for quick mode, 1 for precise mode)
```

### Current Questions (23 total)

**Round 1 (Initial):**
- `Q_R1_EXPERIENCE` - Sauna experience background
- `Q_R1_LOCATION_BASIC` - Location (city, countryside, waterfront)
- `Q_R1_PURPOSE` - Primary purpose (personal, rental, commercial)
- `Q_R1_RITUAL` - Preferred sauna ritual
- `Q_R1_USERS` - Who will use it, group size

**Round 2 (Technical):**
- `Q_R2_INFRASTRUCTURE` - Water, electricity, sewage availability
- `Q_R2_ROOMS` - Desired rooms (rest area, shower, etc.)
- `Q_R2_SEASONS` - Year-round or seasonal use
- `Q_R2_SIZE` - Approximate size preference
- `Q_R2_STOVE_PREFERENCE` - Wood-burning vs electric stove
- `Q_R2_TEMPERATURE` - Temperature and humidity preferences
- `Q_R2_WATER_PROCEDURES` - Cold water procedures (pool, shower)

**Round 3 (Details):**
- `Q_R3_ACCESSIBILITY` - Accessibility requirements
- `Q_R3_BUDGET` - Budget range
- `Q_R3_DESIGN_STYLE` - Visual style preferences
- `Q_R3_MATERIALS` - Material preferences
- `Q_R3_SPECIAL_NEEDS` - Special requirements
- `Q_R3_TIMELINE` - Project timeline

**Clarification Questions:**
- `Q_CLARIFY_ELECTRIC_SIZE` - Electric stove limitations
- `Q_CLARIFY_INFRASTRUCTURE_RENTAL` - Rental infrastructure
- `Q_CLARIFY_STOVE_TYPE` - Stove type for soft steam
- `Q_CLARIFY_VENTILATION` - Ventilation for large groups
- `Q_CLARIFY_WINTER_WATER` - Winter water supply

### Managing Questions

**To add new questions:**

1. Export brain config from Admin panel (`/admin` > Config tab > Export)
2. Edit the YAML file, add to `questions:` section:
```yaml
questions:
  - question_id: "Q_R1_NEW_QUESTION"
    text_lt: "Klausimas lietuviškai?"
    text_en: "Question in English?"
    slot_coverage: ["slot_key_1", "slot_key_2"]
    round_hint: 1  # 1, 2, or 3
    base_priority: 50
    enabled: true
```
3. Import the updated YAML in Admin panel

**To disable a question:**
- Set `enabled: false` in the YAML and re-import

## 2. Skill Document (AI Guidelines)

### What It Contains

The skill is an evolving markdown document containing:
- Interview methodology and principles
- Question patterns and techniques
- Report formatting guidelines
- Rules learned from expert feedback

### How It's Used

| Feature | Uses Skill? | Description |
|---------|-------------|-------------|
| Initial questions (quick mode) | No | Uses brain config scoring |
| Initial question (precise mode) | No | Uses brain config scoring |
| Follow-up questions (precise mode) | **Yes** | AI generates based on skill |
| Clarification questions | **Yes** | AI generates when answer unclear |
| Report generation | **Yes** | Formatting, sections, style |

### Skill Evolution Flow

```
Expert Reviews Session
    │
    ▼
"Generate Rules" button in Admin
    │
    ▼
LLM analyzes feedback, creates rules
    │
    ▼
Admin approves/rejects rules
    │
    ▼
"Create New Skill Version" button
    │
    ▼
LLM integrates rules into skill document
    │
    ▼
Admin activates new version
```

### Database Tables

- `skill_versions` - Versioned skill documents (content, version, is_active)
- `skill_learned_rules` - Generated rules with approval status

## Interview Modes

### Quick Mode
- **3 questions per round**, 3 rounds = 9 questions max
- Questions selected from brain config using scoring
- No AI-generated follow-ups
- Faster, ~5 minutes

### Precise Mode
- **1 question at a time**
- Initial questions from brain config
- **AI generates follow-up questions** using skill document
- Can ask clarification if answer unclear
- Up to 12 questions total
- More thorough, ~10 minutes

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/scoring.py` | Question scoring and selection |
| `backend/app/services/llm.py` | Follow-up and clarification generation |
| `backend/app/services/skill.py` | Skill version CRUD |
| `backend/app/services/skill_evolution.py` | Rule generation from feedback |
| `backend/app/routers/session.py` | Session endpoints, question flow |

## Common Tasks

### "My skill has questions that aren't being asked"

The skill document contains **guidelines**, not the actual question pool. To add questions:
1. Add them to brain config YAML
2. Or use precise mode for AI-generated follow-ups

### "I want to change question priority"

Edit `base_priority` in the YAML (higher = more likely to be selected) or adjust `weights` in brain config.

### "Questions are being asked that shouldn't be"

Add skip rules to the YAML:
```yaml
skip_rules:
  - condition_slot: "purpose"
    condition_type: "equals_any"
    condition_values: ["personal"]
    skip_question_ids: ["Q_CLARIFY_INFRASTRUCTURE_RENTAL"]
```

### "I want different questions for different scenarios"

Use `slot_coverage` and `risk_coverage` fields - questions covering relevant slots/risks score higher and get selected.
