"""
Admin Router - Brain Configuration Management

Handles export, validation, and import of brain configuration.
Protected by X-Admin-Key header.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import yaml

from app.config import get_settings
from app.database import get_db
from app.models import (
    BrainConfigExportResponse,
    BrainConfigImportRequest,
    BrainConfigImportResponse,
    BrainConfigValidationResponse,
)
from app.services.brain import brain_config

router = APIRouter()
settings = get_settings()


async def verify_admin_key(x_admin_key: str = Header(...)):
    """Verify the admin API key."""
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return True


@router.get("/export", response_model=BrainConfigExportResponse)
async def export_config(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Export the current brain configuration as YAML.
    """
    yaml_content = await brain_config.export_to_yaml(db)

    return BrainConfigExportResponse(
        yaml_content=yaml_content,
        slots_count=len(brain_config.slots),
        questions_count=len(brain_config.questions),
        risk_rules_count=len(brain_config.risk_rules),
    )


@router.post("/validate", response_model=BrainConfigValidationResponse)
async def validate_config(
    request: BrainConfigImportRequest,
    _: bool = Depends(verify_admin_key),
):
    """
    Validate YAML configuration without saving.
    """
    errors = []
    warnings = []

    try:
        config = yaml.safe_load(request.yaml_content)
    except yaml.YAMLError as e:
        return BrainConfigValidationResponse(
            valid=False,
            errors=[f"YAML parse error: {str(e)}"],
        )

    if not isinstance(config, dict):
        return BrainConfigValidationResponse(
            valid=False,
            errors=["Configuration must be a YAML object"],
        )

    # Validate scoring weights
    scoring = config.get("scoring", {})
    weights = scoring.get("weights", {})
    required_weights = ["base_priority", "missing_slot", "risk", "round_fit", "asked_penalty"]
    for w in required_weights:
        if w not in weights:
            warnings.append(f"Missing scoring weight: {w}")

    # Validate slots
    slots = config.get("slots", [])
    if not slots:
        warnings.append("No slots defined")
    else:
        slot_keys = set()
        for i, slot in enumerate(slots):
            if "key" not in slot:
                errors.append(f"Slot {i} missing 'key' field")
            else:
                if slot["key"] in slot_keys:
                    errors.append(f"Duplicate slot key: {slot['key']}")
                slot_keys.add(slot["key"])

    # Validate questions
    questions = config.get("questions", [])
    if len(questions) < 9:
        warnings.append(f"Only {len(questions)} questions defined; recommend 20+ for effective scoring")

    question_ids = set()
    for i, q in enumerate(questions):
        if "id" not in q:
            errors.append(f"Question {i} missing 'id' field")
        else:
            if q["id"] in question_ids:
                errors.append(f"Duplicate question id: {q['id']}")
            question_ids.add(q["id"])

        if "text_lt" not in q and "text_en" not in q:
            errors.append(f"Question {q.get('id', i)} has no text")

    # Validate risk rules
    risk_rules = config.get("risk_rules", [])
    rule_ids = set()
    for i, rule in enumerate(risk_rules):
        if "id" not in rule:
            errors.append(f"Risk rule {i} missing 'id' field")
        else:
            if rule["id"] in rule_ids:
                errors.append(f"Duplicate risk rule id: {rule['id']}")
            rule_ids.add(rule["id"])

        if "rule_json" not in rule:
            errors.append(f"Risk rule {rule.get('id', i)} missing 'rule_json'")

    return BrainConfigValidationResponse(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


@router.post("/import", response_model=BrainConfigImportResponse)
async def import_config(
    request: BrainConfigImportRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Import YAML configuration into the database (upsert).
    """
    # First validate
    validation = await validate_config(request, _)
    if not validation.valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Validation failed", "errors": validation.errors},
        )

    try:
        config = yaml.safe_load(request.yaml_content)
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"YAML parse error: {str(e)}")

    slots_imported = 0
    questions_imported = 0
    risk_rules_imported = 0

    try:
        # Import scoring weights
        weights = config.get("scoring", {}).get("weights", {})
        if weights:
            import json
            await db.execute(
                text("""
                    INSERT INTO brain_scoring_config (config_key, weights, updated_at)
                    VALUES ('default', :weights, NOW())
                    ON CONFLICT (config_key)
                    DO UPDATE SET weights = EXCLUDED.weights, updated_at = NOW()
                """),
                {"weights": json.dumps(weights)},
            )

        # Import slots
        for slot in config.get("slots", []):
            await db.execute(
                text("""
                    INSERT INTO brain_slots (slot_key, label_lt, label_en, description, is_required, priority_weight, updated_at)
                    VALUES (:key, :label_lt, :label_en, :description, :is_required, :priority_weight, NOW())
                    ON CONFLICT (slot_key)
                    DO UPDATE SET
                        label_lt = EXCLUDED.label_lt,
                        label_en = EXCLUDED.label_en,
                        description = EXCLUDED.description,
                        is_required = EXCLUDED.is_required,
                        priority_weight = EXCLUDED.priority_weight,
                        updated_at = NOW()
                """),
                {
                    "key": slot["key"],
                    "label_lt": slot.get("label_lt"),
                    "label_en": slot.get("label_en"),
                    "description": slot.get("description"),
                    "is_required": slot.get("is_required", False),
                    "priority_weight": slot.get("priority_weight", 1.0),
                },
            )
            slots_imported += 1

        # Import questions
        for q in config.get("questions", []):
            await db.execute(
                text("""
                    INSERT INTO brain_questions (question_id, text_lt, text_en, base_priority, round_hint, slot_coverage, risk_coverage, enabled, updated_at)
                    VALUES (:id, :text_lt, :text_en, :base_priority, :round_hint, :slot_coverage, :risk_coverage, :enabled, NOW())
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
                """),
                {
                    "id": q["id"],
                    "text_lt": q.get("text_lt"),
                    "text_en": q.get("text_en"),
                    "base_priority": q.get("base_priority", 50),
                    "round_hint": q.get("round_hint"),
                    "slot_coverage": q.get("slot_coverage", []),
                    "risk_coverage": q.get("risk_coverage", []),
                    "enabled": q.get("enabled", True),
                },
            )
            questions_imported += 1

        # Import risk rules
        import json
        for rule in config.get("risk_rules", []):
            await db.execute(
                text("""
                    INSERT INTO brain_risk_rules (rule_id, code, severity, rule_json, note_template, enabled)
                    VALUES (:id, :code, :severity, :rule_json, :note_template, :enabled)
                    ON CONFLICT (rule_id)
                    DO UPDATE SET
                        code = EXCLUDED.code,
                        severity = EXCLUDED.severity,
                        rule_json = EXCLUDED.rule_json,
                        note_template = EXCLUDED.note_template,
                        enabled = EXCLUDED.enabled
                """),
                {
                    "id": rule["id"],
                    "code": rule.get("code", rule["id"]),
                    "severity": rule.get("severity", "medium"),
                    "rule_json": json.dumps(rule.get("rule_json", {})),
                    "note_template": rule.get("note_template"),
                    "enabled": rule.get("enabled", True),
                },
            )
            risk_rules_imported += 1

        # Invalidate cache
        brain_config.invalidate_cache()

        return BrainConfigImportResponse(
            success=True,
            slots_imported=slots_imported,
            questions_imported=questions_imported,
            risk_rules_imported=risk_rules_imported,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
