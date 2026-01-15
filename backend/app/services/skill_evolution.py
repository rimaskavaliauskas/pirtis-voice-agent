"""
Skill Evolution Service - Continuous improvement from expert feedback

This module implements a feedback loop for skill improvement:
1. Expert reviews interview sessions (quality ratings, suggestions)
2. LLM analyzes review patterns to generate improvement rules
3. Admin approves/rejects generated rules
4. Approved rules are integrated into new skill versions

ARCHITECTURE OVERVIEW:
======================

    Expert Reviews (DB)
           │
           ▼
    ┌─────────────────┐
    │ analyze_reviews │ ──► LLM analyzes patterns
    │ _and_generate_  │
    │     rules()     │
    └────────┬────────┘
             │
             ▼
    skill_learned_rules (DB)
    [status: pending]
             │
             ▼
    ┌─────────────────┐
    │  Admin Review   │ ──► approve_rule() / reject_rule()
    └────────┬────────┘
             │
             ▼
    skill_learned_rules (DB)
    [status: approved]
             │
             ▼
    ┌─────────────────┐
    │ create_skill_   │ ──► LLM integrates rules into skill
    │  from_rules()   │
    └────────┬────────┘
             │
             ▼
    skill_versions (DB)
    [new version created]


IMPORTANT NOTES FOR FUTURE DEVELOPERS:
======================================

1. SQLALCHEMY + ASYNCPG TYPE CASTING:
   When using SQLAlchemy's text() with asyncpg, you CANNOT use PostgreSQL's
   native :: cast syntax with named parameters because SQLAlchemy interprets
   :name as a parameter.

   BAD:  `:skill_id::jsonb`  ──► SQLAlchemy sees `:skill_id` and `::jsonb`
   GOOD: `CAST(:skill_id AS jsonb)`  ──► Works correctly

2. ARRAY PARAMETERS:
   Python lists passed to ANY() require explicit type casting:

   BAD:  `WHERE id = ANY(:ids)`  ──► asyncpg can't infer array type
   GOOD: `WHERE id = ANY(CAST(:ids AS int[]))`  ──► Explicit int array

3. JSONB COLUMNS:
   PostgreSQL jsonb columns via asyncpg return Python dicts, NOT JSON strings.
   Always check type before calling json.loads():

   metadata = row[5] if isinstance(row[5], dict) else json.loads(row[5]) if row[5] else {}

4. LLM RESPONSE PARSING:
   Gemini often wraps JSON in markdown code blocks (```json...```).
   Always use _extract_json() to strip these before json.loads().
"""

import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.llm import _call_llm_with_fallback, _extract_json
from app.services.skill import get_active_skill, create_skill_version


# =============================================================================
# LLM PROMPT TEMPLATES
# =============================================================================

RULE_GENERATION_PROMPT = """You are an expert at analyzing interview feedback and generating improvement rules.

Analyze the following expert reviews of sauna design consultation interviews and extract actionable improvement rules.

## Expert Reviews:
{reviews_text}

## Current Skill Version: {skill_version}

## Task:
Based on the expert feedback patterns, generate a list of specific, actionable rules that would improve future interviews.

Focus on:
1. Questions that received low effectiveness ratings - what should change?
2. Common "what could be better" suggestions - extract the patterns
3. Suggested alternative questions - identify better phrasings
4. Report accuracy/completeness issues - what was missed?

## Output Format:
Return a JSON array of rules. Each rule should have:
- "rule_type": one of "question_improvement", "new_question", "topic_priority", "report_template", "methodology"
- "rule_text": The specific instruction/rule in Lithuanian (for skill file)
- "rule_text_en": English translation for admin review
- "confidence": 0.0-1.0 based on how strong the pattern is
- "source_pattern": Brief description of what feedback led to this rule
- "affected_questions": List of question IDs this affects (if applicable)

Return ONLY the JSON array, no other text.
"""

SKILL_UPDATE_PROMPT = """You are updating a Pirtis (sauna) design consultation skill file based on approved expert feedback rules.

## Current Skill Content:
{current_skill}

## Approved Rules to Integrate:
{rules_text}

## Task:
Update the skill content to incorporate these rules. Make minimal, targeted changes that:
1. Add new instructions where appropriate
2. Modify existing instructions if rules suggest improvements
3. Add new checklist items if needed
4. Update the "What not to do" section if relevant

Return the COMPLETE updated skill content. Preserve the original structure and formatting.
Only make changes that directly implement the approved rules.
"""


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def _safe_parse_jsonb(value: Any) -> Dict[str, Any]:
    """
    Safely parse a jsonb column value that may be a dict or JSON string.

    asyncpg returns jsonb as Python dict, but older data or different
    configurations might return strings. This handles both cases.

    Args:
        value: The value from a jsonb column (dict, str, or None)

    Returns:
        Parsed dict, or empty dict if value is None/invalid
    """
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return {}


def _format_reviews_for_analysis(reviews: List[Dict[str, Any]]) -> str:
    """
    Format expert reviews into text suitable for LLM analysis.

    Structures the review data in a clear format that helps the LLM
    identify patterns across multiple reviews.
    """
    parts = []

    for i, review in enumerate(reviews, 1):
        part = f"### Review {i} (Overall: {review['overall_rating']}/5)\n"

        if review['overall_comments']:
            part += f"Overall comments: {review['overall_comments']}\n"

        # Format individual question reviews
        if review['question_reviews']:
            part += "\nQuestion Reviews:\n"
            for qr in review['question_reviews']:
                part += f"- Q: {qr.get('original_question', 'N/A')[:100]}...\n"
                part += f"  Rating: {qr.get('effectiveness_rating', 'N/A')}/5\n"
                if qr.get('what_could_be_better'):
                    part += f"  Could be better: {qr['what_could_be_better']}\n"
                if qr.get('suggested_alternative'):
                    part += f"  Suggested: {qr['suggested_alternative']}\n"
                if qr.get('missed_opportunities'):
                    part += f"  Missed: {', '.join(qr['missed_opportunities'])}\n"

        # Format summary/report review
        if review['summary_review']:
            sr = review['summary_review']
            part += f"\nReport Review: Accuracy {sr.get('accuracy_rating', 'N/A')}/5, "
            part += f"Completeness {sr.get('completeness_rating', 'N/A')}/5\n"
            if sr.get('what_could_be_better'):
                part += f"Report could be better: {sr['what_could_be_better']}\n"
            if sr.get('missing_insights'):
                part += f"Missing: {', '.join(sr['missing_insights'])}\n"

        parts.append(part)

    return "\n---\n".join(parts)


# =============================================================================
# RULE GENERATION FROM EXPERT FEEDBACK
# =============================================================================

async def analyze_reviews_and_generate_rules(
    db: AsyncSession,
    min_reviews: int = 3,
    since_days: int = 30,
) -> List[Dict[str, Any]]:
    """
    Analyze expert reviews and generate improvement rules using LLM.

    This is the first step in the skill evolution pipeline. It:
    1. Fetches recent expert reviews from the database
    2. Formats them for LLM analysis
    3. Calls LLM to identify patterns and generate rules
    4. Returns rules for admin review (NOT auto-saved)

    Args:
        db: Async database session
        min_reviews: Minimum number of reviews required (prevents analysis on too little data)
        since_days: Only analyze reviews from the last N days

    Returns:
        List of generated rule dicts, or empty list if insufficient data
    """
    # Build query with date filter using parameterized query to prevent SQL injection
    query = """
        SELECT
            er.id,
            er.session_id,
            er.reviewer_name,
            er.overall_rating,
            er.overall_comments,
            er.created_at,
            (
                SELECT json_agg(json_build_object(
                    'question_id', qr.question_id,
                    'original_question', qr.original_question,
                    'user_response', qr.user_response,
                    'effectiveness_rating', qr.effectiveness_rating,
                    'what_could_be_better', qr.what_could_be_better,
                    'suggested_alternative', qr.suggested_alternative,
                    'missed_opportunities', qr.missed_opportunities
                ))
                FROM question_reviews qr
                WHERE qr.expert_review_id = er.id
            ) as question_reviews,
            (
                SELECT json_build_object(
                    'accuracy_rating', sr.accuracy_rating,
                    'completeness_rating', sr.completeness_rating,
                    'what_could_be_better', sr.what_could_be_better,
                    'missing_insights', sr.missing_insights
                )
                FROM summary_reviews sr
                WHERE sr.expert_review_id = er.id
                LIMIT 1
            ) as summary_review
        FROM expert_reviews er
        WHERE er.created_at > NOW() - make_interval(days => :since_days)
        ORDER BY er.created_at DESC
    """

    result = await db.execute(text(query), {'since_days': since_days})

    reviews = []
    for row in result.fetchall():
        reviews.append({
            'id': row[0],
            'session_id': str(row[1]),
            'reviewer_name': row[2],
            'overall_rating': row[3],
            'overall_comments': row[4],
            'created_at': row[5].isoformat() if row[5] else None,
            'question_reviews': row[6] or [],
            'summary_review': row[7],
        })

    # Require minimum number of reviews for meaningful analysis
    if len(reviews) < min_reviews:
        return []

    # Get current skill version for context
    skill = await get_active_skill(db)
    skill_version = skill['version'] if skill else 'unknown'

    # Format reviews and call LLM
    reviews_text = _format_reviews_for_analysis(reviews)
    prompt = RULE_GENERATION_PROMPT.format(
        reviews_text=reviews_text,
        skill_version=skill_version,
    )

    try:
        response = _call_llm_with_fallback(prompt)

        # Extract JSON from potential markdown wrapper and parse
        rules = json.loads(_extract_json(response))

        # Enrich rules with metadata
        for rule in rules:
            rule['generated_at'] = datetime.utcnow().isoformat()
            rule['source_review_count'] = len(reviews)
            rule['skill_version'] = skill_version

        return rules

    except json.JSONDecodeError as e:
        print(f"Failed to parse LLM response as JSON: {e}")
        return []
    except Exception as e:
        print(f"Error generating rules: {e}")
        return []


async def save_generated_rules(db: AsyncSession, rules: List[Dict[str, Any]]) -> List[int]:
    """
    Persist generated rules to database for admin review.

    Rules are saved with approved=FALSE status, requiring admin action.

    Args:
        db: Async database session
        rules: List of rule dicts from analyze_reviews_and_generate_rules()

    Returns:
        List of created rule IDs
    """
    rule_ids = []

    for rule in rules:
        # Prepare metadata as JSON string for storage
        metadata = json.dumps({
            'rule_text_en': rule.get('rule_text_en', ''),
            'affected_questions': rule.get('affected_questions', []),
            'generated_at': rule.get('generated_at'),
            'source_review_count': rule.get('source_review_count'),
            'skill_version': rule.get('skill_version'),
        })

        result = await db.execute(
            text("""
                INSERT INTO skill_learned_rules
                    (rule_text, rule_type, confidence_score, source_pattern, metadata, approved)
                VALUES
                    (:rule_text, :rule_type, :confidence, :source_pattern, :metadata, FALSE)
                RETURNING id
            """),
            {
                'rule_text': rule.get('rule_text', ''),
                'rule_type': rule.get('rule_type', 'general'),
                'confidence': rule.get('confidence', 0.5),
                'source_pattern': rule.get('source_pattern', ''),
                'metadata': metadata,
            }
        )
        rule_ids.append(result.scalar_one())

    return rule_ids


# =============================================================================
# RULE MANAGEMENT (CRUD)
# =============================================================================

async def get_pending_rules(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Retrieve all rules awaiting admin approval.

    Returns rules ordered by confidence (highest first) for prioritized review.
    """
    result = await db.execute(
        text("""
            SELECT id, rule_text, rule_type, confidence_score,
                   source_pattern, metadata, created_at
            FROM skill_learned_rules
            WHERE approved IS NULL OR approved = FALSE
            ORDER BY confidence_score DESC, created_at DESC
        """)
    )

    rules = []
    for row in result.fetchall():
        # Handle jsonb column that may be dict or string
        metadata = _safe_parse_jsonb(row[5])

        rules.append({
            'id': row[0],
            'rule_text': row[1],
            'rule_type': row[2],
            'confidence_score': row[3],
            'source_pattern': row[4],
            'rule_text_en': metadata.get('rule_text_en', ''),
            'affected_questions': metadata.get('affected_questions', []),
            'created_at': row[6].isoformat() if row[6] else None,
        })

    return rules


async def get_approved_rules(db: AsyncSession) -> List[Dict[str, Any]]:
    """Retrieve all approved rules, ordered by approval date (newest first)."""
    result = await db.execute(
        text("""
            SELECT id, rule_text, rule_type, confidence_score,
                   source_pattern, metadata, created_at, approved_at
            FROM skill_learned_rules
            WHERE approved = TRUE
            ORDER BY approved_at DESC
        """)
    )

    rules = []
    for row in result.fetchall():
        metadata = _safe_parse_jsonb(row[5])

        rules.append({
            'id': row[0],
            'rule_text': row[1],
            'rule_type': row[2],
            'confidence_score': row[3],
            'source_pattern': row[4],
            'rule_text_en': metadata.get('rule_text_en', ''),
            'affected_questions': metadata.get('affected_questions', []),
            'created_at': row[6].isoformat() if row[6] else None,
            'approved_at': row[7].isoformat() if row[7] else None,
        })

    return rules


async def approve_rule(db: AsyncSession, rule_id: int) -> bool:
    """Mark a rule as approved, making it eligible for skill integration."""
    await db.execute(
        text("""
            UPDATE skill_learned_rules
            SET approved = TRUE, approved_at = NOW()
            WHERE id = :id
        """),
        {'id': rule_id}
    )
    return True


async def reject_rule(db: AsyncSession, rule_id: int) -> bool:
    """Delete a rejected rule from the database."""
    await db.execute(
        text("DELETE FROM skill_learned_rules WHERE id = :id"),
        {'id': rule_id}
    )
    return True


# =============================================================================
# SKILL VERSION CREATION FROM RULES
# =============================================================================

async def generate_updated_skill(
    db: AsyncSession,
    approved_rule_ids: List[int],
) -> Optional[Dict[str, Any]]:
    """
    Generate updated skill content by integrating approved rules.

    Uses LLM to intelligently merge rules into the existing skill document.

    Args:
        db: Async database session
        approved_rule_ids: List of rule IDs to integrate

    Returns:
        Dict with 'new_content', 'change_summary', 'rules_applied', 'parent_version'
        or None if generation fails
    """
    # Get current active skill as the base
    skill = await get_active_skill(db)
    if not skill:
        return None

    # Fetch the approved rules to integrate
    result = await db.execute(
        text("""
            SELECT id, rule_text, rule_type, source_pattern, metadata
            FROM skill_learned_rules
            WHERE id = ANY(CAST(:ids AS int[])) AND approved = TRUE
        """),
        {'ids': approved_rule_ids}
    )

    rules = []
    for row in result.fetchall():
        metadata = _safe_parse_jsonb(row[4])
        rules.append({
            'id': row[0],
            'rule_text': row[1],
            'rule_type': row[2],
            'source_pattern': row[3],
            'rule_text_en': metadata.get('rule_text_en', ''),
        })

    if not rules:
        return None

    # Format rules for LLM prompt
    rules_text = "\n".join([
        f"- [{r['rule_type']}] {r['rule_text']}\n  (EN: {r['rule_text_en']})"
        for r in rules
    ])

    prompt = SKILL_UPDATE_PROMPT.format(
        current_skill=skill['content'][:15000],  # Limit to avoid token limits
        rules_text=rules_text,
    )

    try:
        new_content = _call_llm_with_fallback(prompt)

        # Build change summary
        change_summary = f"Integrated {len(rules)} expert-approved rules:\n"
        for r in rules:
            change_summary += f"- {r['rule_text_en'][:100]}\n"

        return {
            'new_content': new_content,
            'change_summary': change_summary,
            'rules_applied': [r['id'] for r in rules],
            'parent_version': skill['version'],
        }

    except Exception as e:
        print(f"Error generating updated skill: {e}")
        return None


async def create_skill_from_rules(
    db: AsyncSession,
    new_version: str,
    approved_rule_ids: List[int],
    approved_by: str,
) -> Optional[int]:
    """
    Create a new skill version incorporating approved rules.

    This is the final step in the skill evolution pipeline. It:
    1. Calls LLM to generate updated skill content
    2. Creates a new skill version (inactive by default)
    3. Marks the rules as incorporated

    Args:
        db: Async database session
        new_version: Version string (e.g., "3.2")
        approved_rule_ids: Rule IDs to incorporate
        approved_by: Name of the person approving this version

    Returns:
        ID of the new skill version, or None if creation fails
    """
    print(f"create_skill_from_rules: version={new_version}, rule_ids={approved_rule_ids}")

    # Step 1: Generate the updated skill content
    update_result = await generate_updated_skill(db, approved_rule_ids)
    print(f"generate_updated_skill returned: {update_result is not None}")

    if not update_result:
        return None

    # Step 2: Get parent skill ID for lineage tracking
    skill = await get_active_skill(db)
    parent_id = skill['id'] if skill else None

    # Step 3: Create the new version (not activated by default)
    skill_id = await create_skill_version(
        db=db,
        version=new_version,
        content=update_result['new_content'],
        approved_by=approved_by,
        change_summary=update_result['change_summary'],
        parent_version_id=parent_id,
        activate=False,  # Admin should review and activate manually
    )
    print(f"create_skill_version returned: skill_id={skill_id}")

    # Step 4: Mark rules as incorporated in this skill version
    # IMPORTANT: Use CAST() instead of :: for type casting with SQLAlchemy named params
    await db.execute(
        text("""
            UPDATE skill_learned_rules
            SET metadata = jsonb_set(
                COALESCE(metadata::jsonb, '{}'::jsonb),
                '{incorporated_in_skill}',
                CAST(:skill_id_json AS jsonb)
            )
            WHERE id = ANY(CAST(:rule_ids AS int[]))
        """),
        {
            'skill_id_json': json.dumps(skill_id),
            'rule_ids': approved_rule_ids
        }
    )

    return skill_id
