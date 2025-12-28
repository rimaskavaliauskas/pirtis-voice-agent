-- Brain Configuration Tables
-- These store the configurable "brain" of the agent: slots, questions, risk rules, scoring

-- ============================================
-- Slots Definition
-- ============================================
-- Defines what information the agent tries to collect
CREATE TABLE IF NOT EXISTS brain_slots (
    slot_key VARCHAR(64) PRIMARY KEY,
    label_lt VARCHAR(255),
    label_en VARCHAR(255),
    description TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    priority_weight NUMERIC(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Questions Bank (20+ questions)
-- ============================================
-- The pool of questions the agent can choose from
CREATE TABLE IF NOT EXISTS brain_questions (
    question_id VARCHAR(64) PRIMARY KEY,
    text_lt TEXT NOT NULL,
    text_en TEXT,
    base_priority INTEGER DEFAULT 50,
    round_hint INTEGER,  -- Preferred round: 1, 2, 3, or NULL for any
    slot_coverage TEXT[] DEFAULT '{}',  -- Which slots this question helps fill
    risk_coverage TEXT[] DEFAULT '{}',  -- Which risks this question addresses
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Risk Detection Rules (Deterministic)
-- ============================================
-- Rules for detecting conflicts/risks based on slot values
CREATE TABLE IF NOT EXISTS brain_risk_rules (
    rule_id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    severity VARCHAR(16) DEFAULT 'medium',  -- low, medium, high
    rule_json JSONB NOT NULL,  -- {all:[{slot:..., contains_any:[...]}]}
    note_template TEXT,  -- Explanation template
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Scoring Configuration
-- ============================================
-- Weights for the question scoring algorithm
CREATE TABLE IF NOT EXISTS brain_scoring_config (
    config_key VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    weights JSONB NOT NULL DEFAULT '{
        "base_priority": 0.1,
        "missing_slot": 3.0,
        "risk": 2.0,
        "round_fit": 1.5,
        "asked_penalty": -5.0,
        "required_slot_bonus": 2.0
    }',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default scoring config
INSERT INTO brain_scoring_config (config_key, weights)
VALUES ('default', '{
    "base_priority": 0.1,
    "missing_slot": 3.0,
    "risk": 2.0,
    "round_fit": 1.5,
    "asked_penalty": -5.0,
    "required_slot_bonus": 2.0
}')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_brain_questions_enabled ON brain_questions(enabled);
CREATE INDEX IF NOT EXISTS idx_brain_questions_round ON brain_questions(round_hint);
CREATE INDEX IF NOT EXISTS idx_brain_risk_rules_enabled ON brain_risk_rules(enabled);
