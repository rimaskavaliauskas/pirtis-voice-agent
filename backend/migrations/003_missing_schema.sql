-- Migration: Add missing tables and columns
-- Version: 2026-01-15
-- These were manually added to VPS but never documented in migrations

-- ============================================
-- Brain Config (Key-Value Store)
-- ============================================
CREATE TABLE IF NOT EXISTS brain_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Brain Skip Rules
-- ============================================
CREATE TABLE IF NOT EXISTS brain_skip_rules (
    rule_id VARCHAR(100) PRIMARY KEY,
    condition_slot VARCHAR(100) NOT NULL,
    condition_type VARCHAR(50) NOT NULL,
    condition_values TEXT[] NOT NULL,
    skip_question_ids TEXT[] NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skip_rules_enabled ON brain_skip_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_skip_rules_slot ON brain_skip_rules(condition_slot);

-- ============================================
-- User Feedback
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_session_id ON feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- ============================================
-- Session Contact Columns (ALTER)
-- ============================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS report_summary TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_contact_email ON sessions(contact_email);
