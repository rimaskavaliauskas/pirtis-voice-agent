-- Session and Message Tables
-- These store the runtime interview data

-- ============================================
-- Sessions
-- ============================================
-- Main session storage with full AgentState as JSON
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(5) DEFAULT 'lt',
    round INTEGER DEFAULT 1,
    state JSONB NOT NULL DEFAULT '{
        "slots": {},
        "unknown_slots": [],
        "risk_flags": [],
        "round_summary": null,
        "asked_question_ids": [],
        "next_questions": []
    }',
    final_report TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- Messages (Conversation History)
-- ============================================
-- Stores the full conversation for each session
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,  -- 'agent' or 'user'
    question_id VARCHAR(64),  -- Links to brain_questions for agent messages
    content TEXT NOT NULL,
    round INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Audio Transcripts (Optional)
-- ============================================
-- If we want to store transcription metadata
CREATE TABLE IF NOT EXISTS transcripts (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    question_id VARCHAR(64),
    original_text TEXT NOT NULL,  -- Raw Whisper output
    confirmed_text TEXT,  -- User-edited version
    language VARCHAR(5) DEFAULT 'lt',
    confidence NUMERIC(3,2),  -- Whisper confidence score
    duration_seconds NUMERIC(6,2),  -- Audio duration
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_completed ON sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_round ON messages(session_id, round);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);

-- ============================================
-- Updated_at Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
