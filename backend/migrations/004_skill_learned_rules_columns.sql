-- Migration: Add missing columns to skill_learned_rules table
-- Version: 2026-01-15
-- Fixes: skill_evolution.py requires rule_type, source_pattern, metadata columns

-- Add rule_type column for categorizing rules
ALTER TABLE skill_learned_rules ADD COLUMN IF NOT EXISTS rule_type VARCHAR(50) DEFAULT 'general';

-- Add source_pattern column for tracking where rule came from
ALTER TABLE skill_learned_rules ADD COLUMN IF NOT EXISTS source_pattern TEXT;

-- Add metadata JSONB column for flexible additional data
ALTER TABLE skill_learned_rules ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Index for querying by rule type
CREATE INDEX IF NOT EXISTS idx_skill_learned_rules_type ON skill_learned_rules(rule_type);

-- Index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_skill_learned_rules_metadata ON skill_learned_rules USING GIN (metadata);
