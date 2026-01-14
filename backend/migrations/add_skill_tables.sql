-- Migration: Add skill_versions and skill_learned_rules tables
-- Version: 2026-01-13

-- Skill versions table - stores versioned skill documents
CREATE TABLE IF NOT EXISTS skill_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT 'pirtis_design_skill',
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    is_active BOOLEAN DEFAULT FALSE,
    parent_version_id INTEGER REFERENCES skill_versions(id),
    change_summary TEXT
);

-- Index for quick lookup of active skill
CREATE INDEX IF NOT EXISTS idx_skill_versions_active ON skill_versions(is_active) WHERE is_active = TRUE;

-- Skill learned rules table - stores rules extracted from expert feedback
CREATE TABLE IF NOT EXISTS skill_learned_rules (
    id SERIAL PRIMARY KEY,
    rule_text TEXT NOT NULL,
    source_reviews INTEGER[],
    confidence_score FLOAT DEFAULT 0.0,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    approved_by VARCHAR(100)
);

-- Expert reviews table - stores expert feedback on sessions
CREATE TABLE IF NOT EXISTS expert_reviews (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(session_id),
    reviewer_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    overall_comments TEXT
);

-- Question reviews table - stores expert feedback on individual questions
CREATE TABLE IF NOT EXISTS question_reviews (
    id SERIAL PRIMARY KEY,
    expert_review_id INTEGER NOT NULL REFERENCES expert_reviews(id) ON DELETE CASCADE,
    question_id VARCHAR(100) NOT NULL,
    original_question TEXT NOT NULL,
    user_response TEXT,
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    what_could_be_better TEXT,
    suggested_alternative TEXT,
    missed_opportunities TEXT[]
);

-- Summary reviews table - stores expert feedback on final summaries
CREATE TABLE IF NOT EXISTS summary_reviews (
    id SERIAL PRIMARY KEY,
    expert_review_id INTEGER NOT NULL REFERENCES expert_reviews(id) ON DELETE CASCADE,
    original_summary TEXT NOT NULL,
    accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    completeness_rating INTEGER CHECK (completeness_rating >= 1 AND completeness_rating <= 5),
    what_could_be_better TEXT,
    missing_insights TEXT[]
);

-- Index for looking up reviews by session
CREATE INDEX IF NOT EXISTS idx_expert_reviews_session ON expert_reviews(session_id);
