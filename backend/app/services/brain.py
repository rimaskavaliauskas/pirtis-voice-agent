"""
Brain Configuration Loader Service

Loads and caches brain configuration from the database.
"""

import json
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import yaml


class BrainConfigLoader:
    """
    Loads brain configuration from PostgreSQL.

    Caches configuration in memory for performance.
    """

    def __init__(self):
        self._slots: Optional[List[Dict[str, Any]]] = None
        self._questions: Optional[List[Dict[str, Any]]] = None
        self._risk_rules: Optional[List[Dict[str, Any]]] = None
        self._scoring_weights: Optional[Dict[str, float]] = None

    async def load_all(self, db: AsyncSession, force_reload: bool = False) -> None:
        """
        Load all brain configuration from database.

        Args:
            db: Database session
            force_reload: Force reload even if cached
        """
        if force_reload or self._slots is None:
            self._slots = await self._load_slots(db)

        if force_reload or self._questions is None:
            self._questions = await self._load_questions(db)

        if force_reload or self._risk_rules is None:
            self._risk_rules = await self._load_risk_rules(db)

        if force_reload or self._scoring_weights is None:
            self._scoring_weights = await self._load_scoring_weights(db)

    async def _load_slots(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Load slot definitions from database."""
        result = await db.execute(text("""
            SELECT slot_key, label_lt, label_en, description, is_required, priority_weight
            FROM brain_slots
            ORDER BY priority_weight DESC, slot_key
        """))

        return [
            {
                "slot_key": row[0],
                "label_lt": row[1],
                "label_en": row[2],
                "description": row[3],
                "is_required": row[4],
                "priority_weight": float(row[5]) if row[5] else 1.0,
            }
            for row in result.fetchall()
        ]

    async def _load_questions(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Load questions from database."""
        result = await db.execute(text("""
            SELECT question_id, text_lt, text_en, base_priority, round_hint,
                   slot_coverage, risk_coverage, enabled
            FROM brain_questions
            WHERE enabled = true
            ORDER BY base_priority DESC
        """))

        return [
            {
                "question_id": row[0],
                "text_lt": row[1],
                "text_en": row[2],
                "base_priority": row[3],
                "round_hint": row[4],
                "slot_coverage": list(row[5]) if row[5] else [],
                "risk_coverage": list(row[6]) if row[6] else [],
                "enabled": row[7],
            }
            for row in result.fetchall()
        ]

    async def _load_risk_rules(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Load risk rules from database."""
        result = await db.execute(text("""
            SELECT rule_id, code, severity, rule_json, note_template, enabled
            FROM brain_risk_rules
            WHERE enabled = true
        """))

        return [
            {
                "rule_id": row[0],
                "code": row[1],
                "severity": row[2],
                "rule_json": row[3] if isinstance(row[3], dict) else {},
                "note_template": row[4],
                "enabled": row[5],
            }
            for row in result.fetchall()
        ]

    async def _load_scoring_weights(self, db: AsyncSession) -> Dict[str, float]:
        """Load scoring weights from database."""
        result = await db.execute(text("""
            SELECT weights FROM brain_scoring_config WHERE config_key = 'default'
        """))
        row = result.fetchone()

        if row and row[0]:
            weights = row[0]
            if isinstance(weights, str):
                weights = json.loads(weights)
            return weights

        # Default weights if not configured
        return {
            "base_priority": 0.1,
            "missing_slot": 3.0,
            "risk": 2.0,
            "round_fit": 1.5,
            "asked_penalty": -5.0,
            "required_slot_bonus": 2.0,
        }

    @property
    def slots(self) -> List[Dict[str, Any]]:
        """Get cached slots."""
        return self._slots or []

    @property
    def questions(self) -> List[Dict[str, Any]]:
        """Get cached questions."""
        return self._questions or []

    @property
    def risk_rules(self) -> List[Dict[str, Any]]:
        """Get cached risk rules."""
        return self._risk_rules or []

    @property
    def scoring_weights(self) -> Dict[str, float]:
        """Get cached scoring weights."""
        return self._scoring_weights or {}

    def invalidate_cache(self) -> None:
        """Clear all cached data."""
        self._slots = None
        self._questions = None
        self._risk_rules = None
        self._scoring_weights = None

    async def export_to_yaml(self, db: AsyncSession) -> str:
        """
        Export current database config to YAML format.

        Args:
            db: Database session

        Returns:
            YAML string
        """
        await self.load_all(db, force_reload=True)

        config = {
            "scoring": {
                "weights": self.scoring_weights,
            },
            "slots": [
                {
                    "key": s["slot_key"],
                    "label_lt": s["label_lt"],
                    "label_en": s["label_en"],
                    "description": s["description"],
                    "is_required": s["is_required"],
                    "priority_weight": s["priority_weight"],
                }
                for s in self.slots
            ],
            "risk_rules": [
                {
                    "id": r["rule_id"],
                    "code": r["code"],
                    "severity": r["severity"],
                    "rule_json": r["rule_json"],
                    "note_template": r["note_template"],
                }
                for r in self.risk_rules
            ],
            "questions": [
                {
                    "id": q["question_id"],
                    "text_lt": q["text_lt"],
                    "text_en": q["text_en"],
                    "base_priority": q["base_priority"],
                    "round_hint": q["round_hint"],
                    "slot_coverage": q["slot_coverage"],
                    "risk_coverage": q["risk_coverage"],
                }
                for q in self.questions
            ],
        }

        return yaml.dump(config, allow_unicode=True, sort_keys=False, default_flow_style=False)


# Global singleton instance
brain_config = BrainConfigLoader()
