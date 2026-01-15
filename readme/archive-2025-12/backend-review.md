# Backend Review Notes

## Issues Found

> **Status: ALL RESOLVED** - Fixed in `migrations/003_missing_schema.sql` (2026-01-15)

1. ~~**Missing session metadata columns.**~~ **FIXED** - Added `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS` for `contact_name`, `contact_email`, `contact_phone`, `report_summary`, `email_sent_at`.

2. ~~**`brain_config` table does not exist.**~~ **FIXED** - Created `brain_config` table with `key`, `value`, `updated_at` columns.

3. ~~**`brain_skip_rules` table does not exist.**~~ **FIXED** - Created `brain_skip_rules` table with `rule_id`, `condition_slot`, `condition_type`, `condition_values`, `skip_question_ids`, `enabled`, `created_at` columns.

4. ~~**`feedback` table does not exist.**~~ **FIXED** - Created `feedback` table with `id`, `session_id`, `rating`, `feedback_text`, `created_at` columns and proper FK to sessions.

## Review Methods

- **Worked well:** Reading the root README/CLAUDE docs to understand what the backend must support, then tracing SQL references in the routers/services and comparing them against `migrations/*.sql` to highlight missing schema pieces. `git grep` was also helpful to confirm every place a table is used.
- **Did not work well:** Attempting to use `rg` for quick searches fails here because the utility is not installed, so I had to fall back to `git grep` for text searches.
