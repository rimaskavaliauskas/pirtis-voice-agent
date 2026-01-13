"""
Skill Evolution Service - Generates improvements from expert feedback

Analyzes expert reviews to extract patterns and generate skill improvements.
"""

import json
from typing import Optional
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.llm import _call_llm_with_fallback, _extract_json
from app.services.skill import get_active_skill, create_skill_version


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

Example:
[
  {{
    "rule_type": "question_improvement",
    "rule_text": "Kai klientas mini ežerą, visada paklausk apie lauko dušus ir maudymosi zoną",
    "rule_text_en": "When client mentions a lake, always ask about outdoor showers and bathing zone",
    "confidence": 0.85,
    "source_pattern": "3 reviews noted missed opportunity to ask about external water features",
    "affected_questions": ["Q_R2_INFRASTRUCTURE"]
  }}
]

Return ONLY the JSON array, no other text.
"""


async def analyze_reviews_and_generate_rules(
    db: AsyncSession,
    min_reviews: int = 3,
    since_days: int = 30,
) -> list[dict]:
    """
    Analyze accumulated expert reviews and generate improvement rules.

    Args:
        db: Database session
        min_reviews: Minimum reviews required before analysis
        since_days: Only analyze reviews from last N days

    Returns:
        List of generated rules
    """
    # Get recent expert reviews with their question reviews
    result = await db.execute(
        text("""
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
            WHERE er.created_at > NOW() - INTERVAL ':days days'
            ORDER BY er.created_at DESC
        """.replace(':days', str(since_days)))
    )

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

    if len(reviews) < min_reviews:
        return []

    # Get current skill version
    skill = await get_active_skill(db)
    skill_version = skill['version'] if skill else 'unknown'

    # Format reviews for LLM
    reviews_text = _format_reviews_for_analysis(reviews)

    # Generate rules using LLM
    prompt = RULE_GENERATION_PROMPT.format(
        reviews_text=reviews_text,
        skill_version=skill_version,
    )

    try:
        response = _call_llm_with_fallback(prompt)

        # Parse JSON response
        rules = json.loads(_extract_json(response))

        # Add metadata
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


def _format_reviews_for_analysis(reviews: list[dict]) -> str:
    """Format reviews into text for LLM analysis."""
    parts = []

    for i, review in enumerate(reviews, 1):
        part = f"### Review {i} (Overall: {review['overall_rating']}/5)\n"

        if review['overall_comments']:
            part += f"Overall comments: {review['overall_comments']}\n"

        # Question reviews
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

        # Summary review
        if review['summary_review']:
            sr = review['summary_review']
            part += f"\nReport Review: Accuracy {sr.get('accuracy_rating', 'N/A')}/5, Completeness {sr.get('completeness_rating', 'N/A')}/5\n"
            if sr.get('what_could_be_better'):
                part += f"Report could be better: {sr['what_could_be_better']}\n"
            if sr.get('missing_insights'):
                part += f"Missing: {', '.join(sr['missing_insights'])}\n"

        parts.append(part)

    return "\n---\n".join(parts)


async def save_generated_rules(
    db: AsyncSession,
    rules: list[dict],
) -> list[int]:
    """
    Save generated rules to the database for admin review.

    Args:
        db: Database session
        rules: List of generated rules

    Returns:
        List of created rule IDs
    """
    rule_ids = []

    for rule in rules:
        result = await db.execute(
            text("""
                INSERT INTO skill_learned_rules (
                    rule_text, rule_type, confidence_score,
                    source_pattern, metadata, approved
                )
                VALUES (
                    :rule_text, :rule_type, :confidence,
                    :source_pattern, :metadata, FALSE
                )
                RETURNING id
            """),
            {
                'rule_text': rule.get('rule_text', ''),
                'rule_type': rule.get('rule_type', 'general'),
                'confidence': rule.get('confidence', 0.5),
                'source_pattern': rule.get('source_pattern', ''),
                'metadata': json.dumps({
                    'rule_text_en': rule.get('rule_text_en', ''),
                    'affected_questions': rule.get('affected_questions', []),
                    'generated_at': rule.get('generated_at'),
                    'source_review_count': rule.get('source_review_count'),
                    'skill_version': rule.get('skill_version'),
                }),
            }
        )
        rule_ids.append(result.scalar_one())

    return rule_ids


async def get_pending_rules(db: AsyncSession) -> list[dict]:
    """
    Get all rules pending admin approval.

    Returns:
        List of pending rules with metadata
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
        metadata = row[5] if isinstance(row[5], dict) else (json.loads(row[5]) if row[5] else {})
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


async def get_approved_rules(db: AsyncSession) -> list[dict]:
    """Get all approved rules."""
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
        metadata = row[5] if isinstance(row[5], dict) else (json.loads(row[5]) if row[5] else {})
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
    """Approve a rule for inclusion in skill updates."""
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
    """Reject/delete a rule."""
    await db.execute(
        text("DELETE FROM skill_learned_rules WHERE id = :id"),
        {'id': rule_id}
    )
    return True


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


async def generate_updated_skill(
    db: AsyncSession,
    approved_rule_ids: list[int],
) -> Optional[dict]:
    """
    Generate an updated skill version incorporating approved rules.

    Args:
        db: Database session
        approved_rule_ids: List of approved rule IDs to incorporate

    Returns:
        Dict with 'new_content', 'change_summary', 'rules_applied'
    """
    # Get current skill
    skill = await get_active_skill(db)
    if not skill:
        return None

    # Get approved rules
    result = await db.execute(
        text("""
            SELECT id, rule_text, rule_type, source_pattern, metadata
            FROM skill_learned_rules
            WHERE id = ANY(:ids) AND approved = TRUE
        """),
        {'ids': approved_rule_ids}
    )

    rules = []
    for row in result.fetchall():
        metadata = row[4] if isinstance(row[4], dict) else (json.loads(row[4]) if row[4] else {})
        rules.append({
            'id': row[0],
            'rule_text': row[1],
            'rule_type': row[2],
            'source_pattern': row[3],
            'rule_text_en': metadata.get('rule_text_en', ''),
        })

    if not rules:
        return None

    # Format rules for LLM
    rules_text = "\n".join([
        f"- [{r['rule_type']}] {r['rule_text']}\n  (EN: {r['rule_text_en']})"
        for r in rules
    ])

    # Generate updated skill
    prompt = SKILL_UPDATE_PROMPT.format(
        current_skill=skill['content'][:15000],  # Limit to avoid token limits
        rules_text=rules_text,
    )

    try:
        new_content = _call_llm_with_fallback(prompt)

        # Generate change summary
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
    approved_rule_ids: list[int],
    approved_by: str,
) -> Optional[int]:
    """
    Create a new skill version incorporating approved rules.

    Args:
        db: Database session
        new_version: Version string for new skill (e.g., "3.2")
        approved_rule_ids: Rule IDs to incorporate
        approved_by: Name of person approving

    Returns:
        ID of new skill version, or None if failed
    """
    # Generate updated skill content
    update_result = await generate_updated_skill(db, approved_rule_ids)

    if not update_result:
        return None

    # Get parent skill ID
    skill = await get_active_skill(db)
    parent_id = skill['id'] if skill else None

    # Create new version
    skill_id = await create_skill_version(
        db=db,
        version=new_version,
        content=update_result['new_content'],
        approved_by=approved_by,
        change_summary=update_result['change_summary'],
        parent_version_id=parent_id,
        activate=False,  # Don't auto-activate, admin should review first
    )

    # Mark rules as incorporated
    await db.execute(
        text("""
            UPDATE skill_learned_rules
            SET metadata = jsonb_set(
                COALESCE(metadata::jsonb, '{}'::jsonb),
                '{incorporated_in_skill}',
                to_jsonb(:skill_id)
            )
            WHERE id = ANY(:rule_ids)
        """),
        {'skill_id': skill_id, 'rule_ids': approved_rule_ids}
    )

    return skill_id
