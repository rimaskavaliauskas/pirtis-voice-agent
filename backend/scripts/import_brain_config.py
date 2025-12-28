#!/usr/bin/env python3
"""
Import brain configuration from YAML into PostgreSQL.

Usage:
    python scripts/import_brain_config.py config/brain_config.seed.yaml

Environment variables:
    PGHOST - PostgreSQL host (default: localhost)
    PGPORT - PostgreSQL port (default: 5432)
    PGDATABASE - Database name (default: agentbrain)
    PGUSER - Database user (default: agent)
    PGPASSWORD - Database password
"""

import json
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
import yaml


def get_db_connection():
    """Create database connection from environment variables."""
    return psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ.get("PGDATABASE", "agentbrain"),
        user=os.environ.get("PGUSER", "agent"),
        password=os.environ.get("PGPASSWORD", ""),
    )


def load_yaml(filepath: str) -> dict:
    """Load YAML configuration file."""
    with open(filepath, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def upsert_scoring_config(cursor, config: dict):
    """Upsert scoring configuration."""
    weights = config.get("scoring", {}).get("weights", {})
    if not weights:
        print("  No scoring weights found, skipping...")
        return

    cursor.execute(
        """
        INSERT INTO brain_scoring_config (config_key, weights, updated_at)
        VALUES ('default', %s, NOW())
        ON CONFLICT (config_key)
        DO UPDATE SET weights = EXCLUDED.weights, updated_at = NOW()
        """,
        (json.dumps(weights),),
    )
    print(f"  Upserted scoring config with {len(weights)} weights")


def upsert_slots(cursor, slots: list):
    """Upsert slot definitions."""
    if not slots:
        print("  No slots found, skipping...")
        return

    for slot in slots:
        cursor.execute(
            """
            INSERT INTO brain_slots (slot_key, label_lt, label_en, description, is_required, priority_weight, updated_at)
            VALUES (%(key)s, %(label_lt)s, %(label_en)s, %(description)s, %(is_required)s, %(priority_weight)s, NOW())
            ON CONFLICT (slot_key)
            DO UPDATE SET
                label_lt = EXCLUDED.label_lt,
                label_en = EXCLUDED.label_en,
                description = EXCLUDED.description,
                is_required = EXCLUDED.is_required,
                priority_weight = EXCLUDED.priority_weight,
                updated_at = NOW()
            """,
            {
                "key": slot["key"],
                "label_lt": slot.get("label_lt"),
                "label_en": slot.get("label_en"),
                "description": slot.get("description"),
                "is_required": slot.get("is_required", False),
                "priority_weight": slot.get("priority_weight", 1.0),
            },
        )
    print(f"  Upserted {len(slots)} slots")


def upsert_risk_rules(cursor, rules: list):
    """Upsert risk detection rules."""
    if not rules:
        print("  No risk rules found, skipping...")
        return

    for rule in rules:
        cursor.execute(
            """
            INSERT INTO brain_risk_rules (rule_id, code, severity, rule_json, note_template, enabled)
            VALUES (%(id)s, %(code)s, %(severity)s, %(rule_json)s, %(note_template)s, %(enabled)s)
            ON CONFLICT (rule_id)
            DO UPDATE SET
                code = EXCLUDED.code,
                severity = EXCLUDED.severity,
                rule_json = EXCLUDED.rule_json,
                note_template = EXCLUDED.note_template,
                enabled = EXCLUDED.enabled
            """,
            {
                "id": rule["id"],
                "code": rule["code"],
                "severity": rule.get("severity", "medium"),
                "rule_json": json.dumps(rule["rule_json"]),
                "note_template": rule.get("note_template"),
                "enabled": rule.get("enabled", True),
            },
        )
    print(f"  Upserted {len(rules)} risk rules")


def upsert_questions(cursor, questions: list):
    """Upsert questions bank."""
    if not questions:
        print("  No questions found, skipping...")
        return

    for q in questions:
        cursor.execute(
            """
            INSERT INTO brain_questions (
                question_id, text_lt, text_en, base_priority, round_hint,
                slot_coverage, risk_coverage, enabled, updated_at
            )
            VALUES (
                %(id)s, %(text_lt)s, %(text_en)s, %(base_priority)s, %(round_hint)s,
                %(slot_coverage)s, %(risk_coverage)s, %(enabled)s, NOW()
            )
            ON CONFLICT (question_id)
            DO UPDATE SET
                text_lt = EXCLUDED.text_lt,
                text_en = EXCLUDED.text_en,
                base_priority = EXCLUDED.base_priority,
                round_hint = EXCLUDED.round_hint,
                slot_coverage = EXCLUDED.slot_coverage,
                risk_coverage = EXCLUDED.risk_coverage,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            """,
            {
                "id": q["id"],
                "text_lt": q["text_lt"],
                "text_en": q.get("text_en"),
                "base_priority": q.get("base_priority", 50),
                "round_hint": q.get("round_hint"),
                "slot_coverage": q.get("slot_coverage", []),
                "risk_coverage": q.get("risk_coverage", []),
                "enabled": q.get("enabled", True),
            },
        )
    print(f"  Upserted {len(questions)} questions")


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_brain_config.py <yaml_file>")
        sys.exit(1)

    yaml_path = sys.argv[1]
    if not Path(yaml_path).exists():
        print(f"Error: File not found: {yaml_path}")
        sys.exit(1)

    print(f"Loading configuration from {yaml_path}...")
    config = load_yaml(yaml_path)

    print("Connecting to database...")
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        print("Importing brain configuration...")

        print("\n1. Scoring Configuration")
        upsert_scoring_config(cursor, config)

        print("\n2. Slots")
        upsert_slots(cursor, config.get("slots", []))

        print("\n3. Risk Rules")
        upsert_risk_rules(cursor, config.get("risk_rules", []))

        print("\n4. Questions")
        upsert_questions(cursor, config.get("questions", []))

        conn.commit()
        print("\n✅ Import completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error during import: {e}")
        sys.exit(1)

    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
