"""
Admin Router - Brain Configuration Management

Handles export, validation, and import of brain configuration.
Also provides feedback analytics endpoints.
Protected by X-Admin-Key header.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
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
    FeedbackResponse,
    FeedbackStats,
)
from app.services.brain import brain_config

router = APIRouter()
settings = get_settings()


async def verify_admin_key(x_admin_key: str = Header(...)):
    """Verify the admin API key."""
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return True

@router.get("/verify")
async def verify_admin_credentials(
    _: bool = Depends(verify_admin_key),
):
    """
    Verify admin credentials.

    Frontend calls this to validate the admin key before granting access.
    Returns 200 if valid, 403 if invalid (handled by verify_admin_key dependency).
    """
    return {"valid": True, "message": "Admin key verified"}




# ============================================
# Feedback Endpoints
# ============================================

@router.get("/feedback", response_model=List[FeedbackResponse])
async def list_feedback(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    min_rating: Optional[int] = Query(None, ge=1, le=5),
    max_rating: Optional[int] = Query(None, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    List all feedback entries with optional filtering.
    """
    query = """
        SELECT id, session_id, rating, feedback_text, created_at
        FROM feedback
        WHERE 1=1
    """
    params = {"limit": limit, "offset": offset}

    if min_rating is not None:
        query += " AND rating >= :min_rating"
        params["min_rating"] = min_rating

    if max_rating is not None:
        query += " AND rating <= :max_rating"
        params["max_rating"] = max_rating

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    return [
        FeedbackResponse(
            id=row[0],
            session_id=row[1],
            rating=row[2],
            feedback_text=row[3],
            created_at=row[4],
        )
        for row in rows
    ]


@router.get("/feedback/stats", response_model=FeedbackStats)
async def get_feedback_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Get aggregated feedback statistics.
    """
    # Get total count and average
    result = await db.execute(
        text("SELECT COUNT(*), COALESCE(AVG(rating), 0) FROM feedback")
    )
    row = result.fetchone()
    total_count = row[0]
    average_rating = float(row[1])

    # Get rating distribution
    result = await db.execute(
        text("""
            SELECT rating, COUNT(*) as count
            FROM feedback
            GROUP BY rating
            ORDER BY rating
        """)
    )
    distribution = {i: 0 for i in range(1, 6)}
    for row in result.fetchall():
        distribution[row[0]] = row[1]

    return FeedbackStats(
        total_count=total_count,
        average_rating=round(average_rating, 2),
        rating_distribution=distribution,
    )


@router.get("/feedback/{feedback_id}")
async def get_feedback_detail(
    feedback_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Get detailed feedback entry with session info.
    """
    result = await db.execute(
        text("""
            SELECT f.id, f.session_id, f.rating, f.feedback_text, f.created_at,
                   s.language, s.completed_at, s.state
            FROM feedback f
            JOIN sessions s ON f.session_id = s.session_id
            WHERE f.id = :id
        """),
        {"id": feedback_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Feedback not found")

    import json
    state = row[7] if isinstance(row[7], dict) else json.loads(row[7])

    return {
        "id": str(row[0]),
        "session_id": str(row[1]),
        "rating": row[2],
        "feedback_text": row[3],
        "created_at": row[4].isoformat(),
        "session": {
            "language": row[5],
            "completed_at": row[6].isoformat() if row[6] else None,
            "slots": state.get("slots", {}),
            "contact_info": state.get("contact_info"),
        },
    }


@router.delete("/feedback/{feedback_id}")
async def delete_feedback(
    feedback_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Delete a feedback entry.
    """
    result = await db.execute(
        text("DELETE FROM feedback WHERE id = :id RETURNING id"),
        {"id": feedback_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Feedback not found")

    return {"success": True, "message": "Feedback deleted"}


# ============================================
# Report Footer Configuration
# ============================================

@router.get("/config/report-footer")
async def get_report_footer(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Get the current report footer text.
    """
    result = await db.execute(
        text("SELECT value FROM brain_config WHERE key = 'report_footer'")
    )
    row = result.fetchone()
    if row:
        import json
        return {"report_footer": json.loads(row[0])}
    return {"report_footer": ""}


@router.put("/config/report-footer")
async def set_report_footer(
    footer_text: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Update the report footer text.
    """
    import json
    await db.execute(
        text("""
            INSERT INTO brain_config (key, value, updated_at)
            VALUES ('report_footer', :value, NOW())
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        """),
        {"value": json.dumps(footer_text)},
    )

    # Invalidate cache
    brain_config.invalidate_cache()

    return {"success": True, "report_footer": footer_text}


# ============================================
# Brain Configuration Endpoints
# ============================================

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

        # Import modes.quick policy (stored in brain_config key-value table)
        modes = config.get("modes", {})
        quick_policy = modes.get("quick")
        if quick_policy:
            await db.execute(
                text("""
                    INSERT INTO brain_config (key, value, updated_at)
                    VALUES ('modes_quick', :value, NOW())
                    ON CONFLICT (key)
                    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """),
                {"value": json.dumps(quick_policy)},
            )

        # Import skip rules if present
        for skip_rule in config.get("skip_rules", []):
            await db.execute(
                text("""
                    INSERT INTO brain_skip_rules (rule_id, condition_slot, condition_type, condition_values, skip_question_ids, enabled)
                    VALUES (:id, :condition_slot, :condition_type, :condition_values, :skip_question_ids, :enabled)
                    ON CONFLICT (rule_id)
                    DO UPDATE SET
                        condition_slot = EXCLUDED.condition_slot,
                        condition_type = EXCLUDED.condition_type,
                        condition_values = EXCLUDED.condition_values,
                        skip_question_ids = EXCLUDED.skip_question_ids,
                        enabled = EXCLUDED.enabled
                """),
                {
                    "id": skip_rule["id"],
                    "condition_slot": skip_rule.get("condition_slot"),
                    "condition_type": skip_rule.get("condition_type"),
                    "condition_values": skip_rule.get("condition_values", []),
                    "skip_question_ids": skip_rule.get("skip_question_ids", []),
                    "enabled": skip_rule.get("enabled", True),
                },
            )

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
