# Backend Fixes - 2026-01-15

## Summary

Investigated and resolved all database schema issues identified in the backend review. The backend code was already correct - only the migration files were incomplete.

## Investigation Results

### Code Sync Status

Verified local and VPS backend code are **identical**:

| File | Status |
|------|--------|
| `app/routers/session.py` | MATCH |
| `app/services/brain.py` | MATCH |
| `app/routers/admin.py` | MATCH |

### VPS Database Status

All 15 required tables exist on VPS and are fully functional:
- `brain_config`, `brain_questions`, `brain_risk_rules`, `brain_scoring_config`
- `brain_skip_rules`, `brain_slots`, `expert_reviews`, `feedback`
- `messages`, `question_reviews`, `sessions`, `skill_learned_rules`
- `skill_versions`, `summary_reviews`, `transcripts`

### Root Cause

The "bugs" in `readme/backend-review.md` were **not runtime bugs** - they were migration file gaps. Someone had manually created tables/columns directly on VPS without updating the migration files.

## Fixes Applied

### 1. Created Migration File

**File:** `backend/migrations/003_missing_schema.sql`

Added missing schema definitions:

```sql
-- brain_config table (key-value store for report footer, etc.)
CREATE TABLE IF NOT EXISTS brain_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- brain_skip_rules table (conditional question skipping)
CREATE TABLE IF NOT EXISTS brain_skip_rules (
    rule_id VARCHAR(100) PRIMARY KEY,
    condition_slot VARCHAR(100) NOT NULL,
    condition_type VARCHAR(50) NOT NULL,
    condition_values TEXT[] NOT NULL,
    skip_question_ids TEXT[] NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- feedback table (user ratings)
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Session contact columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS report_summary TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
```

### 2. Synced Migrations to VPS

Uploaded missing migration files to VPS:
- `003_missing_schema.sql` (new)
- `add_skill_tables.sql` (was local-only)

### 3. Updated Review Document

Marked all issues as resolved in `readme/backend-review.md`.

## Issues Resolved

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Missing session columns (`contact_name`, `contact_email`, `contact_phone`, `report_summary`, `email_sent_at`) | Added via `ALTER TABLE` |
| 2 | `brain_config` table missing | Created with proper schema |
| 3 | `brain_skip_rules` table missing | Created with proper schema |
| 4 | `feedback` table missing | Created with FK to sessions |

## Migration Order

Migrations now run in correct order (alphabetically in Docker):
1. `001_brain_tables.sql` - Core brain tables
2. `002_session_tables.sql` - Sessions, messages, transcripts
3. `003_missing_schema.sql` - Missing tables + session columns
4. `add_skill_tables.sql` - Skill evolution tables

## Deployment Workflow

Confirmed working workflow:
```bash
# Edit locally
code backend/app/...

# Upload to VPS
scp -i "KEY" local_file root@65.108.246.252:/opt/agent-brain/...

# Restart service
ssh -i "KEY" root@65.108.246.252 "systemctl restart agent-brain"

# Verify
ssh -i "KEY" root@65.108.246.252 "journalctl -u agent-brain -f"
```

## Git Commits

- `f63abdd` - `chore: Add missing schema migration for brain_config, skip_rules, feedback`
