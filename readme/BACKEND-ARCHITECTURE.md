# Backend Architecture

FastAPI application running on Hetzner VPS at `http://65.108.246.252:8000`.

## API Endpoints

### Session Endpoints (`/session/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/session/start` | Create session, returns first 3 questions |
| POST | `/session/{id}/transcribe` | Whisper STT - audio to text |
| POST | `/session/{id}/answer` | Submit answer, extract slots, return next questions |
| POST | `/session/{id}/finalize` | Generate final markdown report |
| POST | `/session/{id}/translate` | Translate report to EN/RU |
| GET | `/session/{id}/download` | Download report as markdown file |

### Brain Config Endpoints (`/brain/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/brain/config/export` | Export brain config as YAML |
| POST | `/brain/config/import` | Import YAML config (upsert) |

### Admin Endpoints (`/admin/*`) - Require X-Admin-Key header

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/verify` | Verify admin key is valid |
| GET | `/admin/feedback` | List feedback entries with filters |
| GET | `/admin/sessions` | List sessions for expert review |
| GET | `/admin/sessions/{id}/review` | Get session Q&A for review |
| POST | `/admin/sessions/{id}/review` | Submit expert review |
| DELETE | `/admin/sessions/{id}` | Delete a session |
| GET | `/admin/expert-review-stats` | Get review statistics |

### Skill Evolution Endpoints (`/admin/skill/*`) - Require X-Admin-Key header

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/skill/versions` | List all skill versions |
| GET | `/admin/skill/versions/active` | Get currently active version |
| GET | `/admin/skill/versions/{id}/content` | Get full skill content |
| POST | `/admin/skill/versions/{id}/activate` | Activate a skill version |
| POST | `/admin/skill/versions/create` | Create new version from approved rules |
| POST | `/admin/skill/rules/generate` | Generate rules from expert feedback |
| GET | `/admin/skill/rules/pending` | List pending (unapproved) rules |
| GET | `/admin/skill/rules/approved` | List approved rules |
| POST | `/admin/skill/rules/{id}/approve` | Approve a rule |
| DELETE | `/admin/skill/rules/{id}` | Reject (delete) a rule |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/translate` | Translate any text (for dynamic UI content) |

## File Structure

```
backend/app/
├── main.py                    # FastAPI app, CORS, router mounting
├── config.py                  # Environment settings
├── database.py                # AsyncSession configuration
├── models.py                  # Pydantic request/response models
│
├── routers/
│   ├── session.py             # Session endpoints (21KB)
│   ├── admin.py               # Brain config + feedback endpoints
│   ├── expert_review.py       # Expert review CRUD (21KB)
│   └── skill_admin.py         # Skill evolution endpoints (8.6KB)
│
├── services/
│   ├── llm.py                 # Gemini + Claude fallback (10KB)
│   ├── whisper.py             # STT transcription
│   ├── brain.py               # Brain config parsing and caching
│   ├── skill.py               # Skill version CRUD + caching (12KB)
│   ├── skill_evolution.py     # Rule generation + skill updates (21KB)
│   ├── risk.py                # Risk rule evaluation
│   ├── scoring.py             # Question scoring algorithm
│   └── email.py               # Email sending
│
└── prompts/
    └── templates.py           # LLM prompt templates
```

## Services

### LLM Service (`llm.py`)

Implements fallback strategy:
1. Try Gemini API first
2. On 429 (rate limit) or 503 (unavailable), fall back to Claude API

```python
async def _call_llm_with_fallback(prompt: str) -> str:
    # Try Gemini first, Claude on failure
```

Handles markdown-wrapped JSON responses (strips ```json blocks).

### Skill Service (`skill.py`)

Manages versioned skill documents:
- `get_active_skill(db)` - Returns active skill with in-memory caching
- `get_skill_for_prompts(db)` - Parses skill into sections for prompt injection
- `create_skill_version(db, ...)` - Creates new version (not active by default)
- `activate_skill_version(db, id)` - Deactivates all, activates specified

Skill sections parsed:
- overview, methodology, steam_room, rest_room
- external_infrastructure, documentation, what_not_to_do
- checklists, dialogues

### Skill Evolution Service (`skill_evolution.py`)

LLM-driven improvement from expert feedback:
- `analyze_reviews_and_generate_rules(db, ...)` - LLM analyzes feedback patterns
- `save_generated_rules(db, rules)` - Saves with `approved=FALSE`
- `approve_rule(db, rule_id)` / `reject_rule(db, rule_id)`
- `generate_updated_skill(db, rule_ids)` - LLM integrates rules into skill
- `create_skill_from_rules(db, ...)` - Full pipeline

Rule types generated:
- `question_improvement` - Improve existing question
- `new_question` - Add new question to bank
- `topic_priority` - Prioritize certain topics
- `report_template` - Update report structure
- `methodology` - Improve methodology section

## Database Schema

### Core Tables

```sql
-- Sessions and messages
sessions (session_id, language, mode, state, report, created_at, ...)
messages (id, session_id, role, content, round, created_at)
transcripts (id, session_id, audio_path, transcript, created_at)

-- Brain configuration
brain_config (key, value, updated_at)
brain_slots (slot_id, name, description, is_required, weight, ...)
brain_questions (question_id, text_lt, slot_coverage, risk_coverage, ...)
brain_risk_rules (rule_id, condition_slot, condition_type, ...)
brain_scoring_config (key, weights)
brain_skip_rules (rule_id, condition_slot, skip_question_ids, ...)
```

### Skill Evolution Tables

```sql
-- Skill versions
skill_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50),
    name VARCHAR(255),
    content TEXT,                    -- Full skill document
    created_at TIMESTAMP,
    approved_by VARCHAR(255),
    is_active BOOLEAN DEFAULT FALSE,
    parent_version_id INT,
    change_summary TEXT
)

-- Generated rules
skill_learned_rules (
    id SERIAL PRIMARY KEY,
    rule_text TEXT,
    rule_type VARCHAR(50),           -- question_improvement, new_question, etc.
    confidence_score FLOAT,
    source_pattern TEXT,
    metadata JSONB DEFAULT '{}',     -- incorporated_in_skill, affected_questions
    approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP,
    created_at TIMESTAMP
)
```

### Expert Review Tables

```sql
expert_reviews (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions,
    reviewer_name VARCHAR(255),
    overall_rating INT CHECK (1-5),
    overall_comments TEXT,
    created_at TIMESTAMP
)

question_reviews (
    id SERIAL PRIMARY KEY,
    expert_review_id INT REFERENCES expert_reviews,
    question_id VARCHAR(100),
    original_question TEXT,
    user_response TEXT,
    effectiveness_rating INT CHECK (1-5),
    what_could_be_better TEXT,
    suggested_alternative TEXT,
    missed_opportunities TEXT[]
)

summary_reviews (
    id SERIAL PRIMARY KEY,
    expert_review_id INT REFERENCES expert_reviews,
    original_summary TEXT,
    accuracy_rating INT CHECK (1-5),
    completeness_rating INT CHECK (1-5),
    what_could_be_better TEXT,
    missing_insights TEXT[]
)
```

## SQLAlchemy + asyncpg Patterns

Critical patterns for PostgreSQL operations:

| Issue | Wrong | Correct |
|-------|-------|---------|
| Type casting | `:param::jsonb` | `CAST(:param AS jsonb)` |
| Array params | `ANY(:ids)` | `ANY(CAST(:ids AS int[]))` |
| jsonb columns | `json.loads(row[n])` | Check `isinstance(row[n], dict)` first |
| Same param twice | `CASE WHEN :p ... :p` | Use separate params |
| Date intervals | `f"INTERVAL '{days} days'"` | `make_interval(days => :days)` |

**Why**: SQLAlchemy uses `:name` for params, conflicting with PostgreSQL's `::` cast. asyncpg returns jsonb as dicts and can't infer array types.

## Authentication

Admin endpoints require `X-Admin-Key` header:

```python
async def verify_admin_key(x_admin_key: str = Header(...)):
    # Validates against ADMIN_KEY env variable
```

Frontend stores key in localStorage, re-verifies on every admin page load.
