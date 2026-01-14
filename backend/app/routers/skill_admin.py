"""
Skill Admin Endpoints - Manage skill evolution and rule generation

Allows admins to:
- Generate improvement rules from expert feedback
- Review and approve/reject rules
- Create new skill versions from approved rules
- Manage skill version activation
"""

import traceback
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services.skill import (
    get_active_skill,
    list_skill_versions,
    activate_skill_version,
    create_skill_version,
)
from app.services.skill_evolution import (
    analyze_reviews_and_generate_rules,
    save_generated_rules,
    get_pending_rules,
    get_approved_rules,
    approve_rule,
    reject_rule,
    create_skill_from_rules,
)

router = APIRouter()
settings = get_settings()


async def verify_admin_key(x_admin_key: str = Header(...)):
    """Verify the admin API key."""
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return True


# ============================================
# Models
# ============================================

class GenerateRulesRequest(BaseModel):
    """Request to generate rules from expert feedback."""
    min_reviews: int = 3
    since_days: int = 30


class GenerateRulesResponse(BaseModel):
    """Response with generated rules."""
    rules_generated: int
    rules: List[dict]
    message: str


class RuleResponse(BaseModel):
    """A single rule."""
    id: int
    rule_text: str
    rule_type: str
    confidence_score: float
    source_pattern: str
    rule_text_en: str
    affected_questions: List[str]
    created_at: Optional[str]


class ApproveRuleRequest(BaseModel):
    """Request to approve a rule."""
    rule_id: int


class CreateSkillVersionRequest(BaseModel):
    """Request to create new skill version from rules."""
    new_version: str
    approved_rule_ids: List[int]
    approved_by: str


class SkillVersionResponse(BaseModel):
    """Skill version metadata."""
    id: int
    version: str
    is_active: bool
    created_at: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[str]
    change_summary: Optional[str]
    content_length: int


class ActivateSkillRequest(BaseModel):
    """Request to activate a skill version."""
    version_id: int


# ============================================
# Endpoints - Rule Generation
# ============================================

@router.post("/rules/generate", response_model=GenerateRulesResponse)
async def generate_rules(
    request: GenerateRulesRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Analyze expert reviews and generate improvement rules.

    This uses LLM to analyze patterns in expert feedback and
    generate actionable rules for skill improvement.
    """
    try:
        rules = await analyze_reviews_and_generate_rules(
            db,
            min_reviews=request.min_reviews,
            since_days=request.since_days,
        )

        if not rules:
            return GenerateRulesResponse(
                rules_generated=0,
                rules=[],
                message="Not enough reviews to analyze or no patterns found",
            )

        # Save rules to database
        rule_ids = await save_generated_rules(db, rules)
        await db.commit()

        # Add IDs to rules
        for i, rule in enumerate(rules):
            rule['id'] = rule_ids[i]

        return GenerateRulesResponse(
            rules_generated=len(rules),
            rules=rules,
            message=f"Generated {len(rules)} rules from expert feedback",
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error generating rules: {str(e)}")


@router.get("/rules/pending", response_model=List[RuleResponse])
async def list_pending_rules(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Get all rules pending admin approval."""
    rules = await get_pending_rules(db)
    return rules


@router.get("/rules/approved", response_model=List[RuleResponse])
async def list_approved_rules(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Get all approved rules."""
    rules = await get_approved_rules(db)
    return rules


@router.post("/rules/{rule_id}/approve")
async def approve_rule_endpoint(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Approve a rule for inclusion in skill updates."""
    await approve_rule(db, rule_id)
    await db.commit()
    return {"success": True, "message": f"Rule {rule_id} approved"}


@router.delete("/rules/{rule_id}")
async def reject_rule_endpoint(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Reject and delete a rule."""
    await reject_rule(db, rule_id)
    await db.commit()
    return {"success": True, "message": f"Rule {rule_id} rejected"}


# ============================================
# Endpoints - Skill Version Management
# ============================================

@router.get("/versions", response_model=List[SkillVersionResponse])
async def list_versions(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """List all skill versions."""
    versions = await list_skill_versions(db)
    return versions


@router.get("/versions/active")
async def get_active_version(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Get the currently active skill version."""
    skill = await get_active_skill(db)
    if not skill:
        return {"active": False, "message": "No active skill version"}

    return {
        "active": True,
        "id": skill['id'],
        "version": skill['version'],
        "content_preview": skill['content'][:500] + "..." if len(skill['content']) > 500 else skill['content'],
        "content_length": len(skill['content']),
    }


@router.post("/versions/create")
async def create_version_from_rules(
    request: CreateSkillVersionRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Create a new skill version incorporating approved rules.

    The new version will be created but NOT activated automatically.
    Admin should review and activate manually.
    """
    try:
        skill_id = await create_skill_from_rules(
            db,
            new_version=request.new_version,
            approved_rule_ids=request.approved_rule_ids,
            approved_by=request.approved_by,
        )

        if not skill_id:
            raise HTTPException(
                status_code=400,
                detail="Could not create skill version. Check that rules exist and are approved."
            )

        await db.commit()

        return {
            "success": True,
            "skill_id": skill_id,
            "version": request.new_version,
            "message": f"Created skill version {request.new_version} (not yet active)",
        }

    except Exception as e:
        await db.rollback()
        print(f"Error creating skill version: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating skill version: {str(e)}")


@router.post("/versions/{version_id}/activate")
async def activate_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Activate a specific skill version."""
    await activate_skill_version(db, version_id)
    await db.commit()
    return {"success": True, "message": f"Skill version {version_id} activated"}


@router.get("/versions/{version_id}/content")
async def get_version_content(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Get full content of a specific skill version."""
    from sqlalchemy import text

    result = await db.execute(
        text("SELECT id, version, content, change_summary FROM skill_versions WHERE id = :id"),
        {"id": version_id}
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Skill version not found")

    return {
        "id": row[0],
        "version": row[1],
        "content": row[2],
        "change_summary": row[3],
    }
