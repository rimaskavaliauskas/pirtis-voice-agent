"""
Expert Review Endpoints - Session Review and Feedback Management

Allows experts to review completed sessions and provide feedback
that will be used to improve the skill.
"""

import json
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services.brain import brain_config

router = APIRouter()
settings = get_settings()


async def _build_question_lookup(db: AsyncSession, language: str) -> dict:
    """Build a lookup dictionary from question_id to question text."""
    await brain_config.load_all(db)
    lookup = {}
    text_field = "text_lt" if language == "lt" else "text_en"
    for q in brain_config.questions:
        qid = q.get("question_id")
        text = q.get(text_field) or q.get("text_lt", "")
        if qid and text:
            lookup[qid] = text
    return lookup


async def verify_admin_key(x_admin_key: str = Header(...)):
    """Verify the admin API key."""
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return True


# ============================================
# Models
# ============================================

class SessionListItem(BaseModel):
    """Session summary for list view."""
    session_id: UUID
    language: str
    interview_mode: str
    created_at: datetime
    completed_at: Optional[datetime]
    has_report: bool
    has_review: bool
    questions_count: int
    slots_filled: int
    contact_name: Optional[str]


class QuestionAnswer(BaseModel):
    """A question-answer pair from the interview."""
    question_id: str
    question_text: str
    answer_text: str
    round: int


class SessionReviewData(BaseModel):
    """Full session data for expert review."""
    session_id: UUID
    language: str
    interview_mode: str
    created_at: datetime
    completed_at: Optional[datetime]
    contact_info: Optional[dict]
    questions_answers: List[QuestionAnswer]
    slots: dict
    risk_flags: List[dict]
    final_report: Optional[str]
    existing_review: Optional[dict]


class QuestionReviewInput(BaseModel):
    """Expert feedback on a single question."""
    question_id: str
    original_question: str
    user_response: Optional[str] = None
    effectiveness_rating: int = Field(..., ge=1, le=5)
    what_could_be_better: Optional[str] = None
    suggested_alternative: Optional[str] = None
    missed_opportunities: Optional[List[str]] = None


class SummaryReviewInput(BaseModel):
    """Expert feedback on the final summary/report."""
    original_summary: str
    accuracy_rating: int = Field(..., ge=1, le=5)
    completeness_rating: int = Field(..., ge=1, le=5)
    what_could_be_better: Optional[str] = None
    missing_insights: Optional[List[str]] = None


class ExpertReviewInput(BaseModel):
    """Complete expert review submission."""
    reviewer_name: Optional[str] = None
    overall_rating: int = Field(..., ge=1, le=5)
    overall_comments: Optional[str] = None
    question_reviews: List[QuestionReviewInput]
    summary_review: Optional[SummaryReviewInput] = None


class ExpertReviewResponse(BaseModel):
    """Response after submitting review."""
    success: bool
    review_id: int
    message: str


# ============================================
# Endpoints
# ============================================

@router.get("/sessions", response_model=List[SessionListItem])
async def list_sessions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    completed_only: bool = Query(True),
    has_review: Optional[bool] = Query(None),
    language: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    List sessions available for expert review.

    Args:
        limit: Max results to return
        offset: Pagination offset
        completed_only: Only show completed sessions (default True)
        has_review: Filter by whether session has been reviewed
        language: Filter by language (lt, en, ru)
    """
    query = """
        SELECT
            s.session_id,
            s.language,
            s.state->>'interview_mode' as interview_mode,
            s.created_at,
            s.completed_at,
            s.final_report IS NOT NULL as has_report,
            EXISTS(SELECT 1 FROM expert_reviews er WHERE er.session_id = s.session_id) as has_review,
            COALESCE(jsonb_array_length(s.state->'history'), 0) / 2 as questions_count,
            (
                SELECT COUNT(*)
                FROM jsonb_each(s.state->'slots') slot
                WHERE (slot.value->>'confidence')::float >= 0.7
            ) as slots_filled,
            s.state->'contact_info'->>'name' as contact_name
        FROM sessions s
        WHERE 1=1
    """
    params = {"limit": limit, "offset": offset}

    if completed_only:
        query += " AND s.completed_at IS NOT NULL"

    if has_review is not None:
        if has_review:
            query += " AND EXISTS(SELECT 1 FROM expert_reviews er WHERE er.session_id = s.session_id)"
        else:
            query += " AND NOT EXISTS(SELECT 1 FROM expert_reviews er WHERE er.session_id = s.session_id)"

    if language:
        query += " AND s.language = :language"
        params["language"] = language

    query += " ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    return [
        SessionListItem(
            session_id=row[0],
            language=row[1] or 'lt',
            interview_mode=row[2] or 'quick',
            created_at=row[3],
            completed_at=row[4],
            has_report=row[5],
            has_review=row[6],
            questions_count=row[7] or 0,
            slots_filled=row[8] or 0,
            contact_name=row[9],
        )
        for row in rows
    ]


@router.get("/sessions/{session_id}/review", response_model=SessionReviewData)
async def get_session_for_review(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Get full session data for expert review.

    Returns all questions asked, user answers, extracted slots,
    final report, and any existing review.
    """
    # Get session data
    result = await db.execute(
        text("""
            SELECT
                s.session_id,
                s.language,
                s.state,
                s.created_at,
                s.completed_at,
                s.final_report
            FROM sessions s
            WHERE s.session_id = :id
        """),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    state = row[2] if isinstance(row[2], dict) else json.loads(row[2])

    # Extract question-answer pairs from history
    history = state.get("history", [])
    questions_answers = []

    # Check if history has agent messages (new format) or only user messages (legacy)
    has_agent_messages = any(entry.get("role") == "agent" for entry in history)

    if has_agent_messages:
        # New format: match questions to answers by question_id
        # Build a lookup of agent questions by question_id
        agent_questions = {}
        for entry in history:
            if entry.get("role") == "agent":
                qid = entry.get("question_id", "unknown")
                agent_questions[qid] = {
                    "question_id": qid,
                    "question_text": entry.get("text", ""),
                    "round": entry.get("round", 1),
                }

        # Match user answers to questions by question_id
        for entry in history:
            if entry.get("role") == "user":
                qid = entry.get("question_id", "unknown")
                if qid in agent_questions:
                    q = agent_questions[qid]
                    questions_answers.append(QuestionAnswer(
                        question_id=q["question_id"],
                        question_text=q["question_text"],
                        answer_text=entry.get("text", ""),
                        round=q["round"],
                    ))
                else:
                    # User answer without matching agent question (shouldn't happen)
                    questions_answers.append(QuestionAnswer(
                        question_id=qid,
                        question_text=f"[Question ID: {qid}]",
                        answer_text=entry.get("text", ""),
                        round=entry.get("round", 1),
                    ))
    else:
        # Legacy format: only user messages exist, look up question text from brain config
        session_language = row[1] or 'lt'
        question_lookup = await _build_question_lookup(db, session_language)

        for entry in history:
            if entry.get("role") == "user":
                question_id = entry.get("question_id", "unknown")
                # Look up actual question text from brain config
                if question_id in question_lookup:
                    question_text = question_lookup[question_id]
                elif question_id.startswith("AI_FOLLOWUP"):
                    # AI-generated questions - text not stored in legacy sessions
                    question_text = "[AI-generated follow-up question - text not recorded in legacy sessions]"
                else:
                    question_text = f"[Question ID: {question_id}]"

                questions_answers.append(QuestionAnswer(
                    question_id=question_id,
                    question_text=question_text,
                    answer_text=entry.get("text", ""),
                    round=entry.get("round", 1),
                ))

    # Get existing review if any
    existing_review = None
    review_result = await db.execute(
        text("""
            SELECT
                er.id,
                er.reviewer_name,
                er.overall_rating,
                er.overall_comments,
                er.created_at
            FROM expert_reviews er
            WHERE er.session_id = :id
            ORDER BY er.created_at DESC
            LIMIT 1
        """),
        {"id": session_id},
    )
    review_row = review_result.fetchone()
    if review_row:
        # Get question reviews
        qr_result = await db.execute(
            text("""
                SELECT
                    question_id,
                    original_question,
                    user_response,
                    effectiveness_rating,
                    what_could_be_better,
                    suggested_alternative,
                    missed_opportunities
                FROM question_reviews
                WHERE expert_review_id = :review_id
            """),
            {"review_id": review_row[0]},
        )
        question_reviews = [
            {
                "question_id": qr[0],
                "original_question": qr[1],
                "user_response": qr[2],
                "effectiveness_rating": qr[3],
                "what_could_be_better": qr[4],
                "suggested_alternative": qr[5],
                "missed_opportunities": qr[6],
            }
            for qr in qr_result.fetchall()
        ]

        # Get summary review
        sr_result = await db.execute(
            text("""
                SELECT
                    original_summary,
                    accuracy_rating,
                    completeness_rating,
                    what_could_be_better,
                    missing_insights
                FROM summary_reviews
                WHERE expert_review_id = :review_id
                LIMIT 1
            """),
            {"review_id": review_row[0]},
        )
        sr_row = sr_result.fetchone()
        summary_review = None
        if sr_row:
            summary_review = {
                "original_summary": sr_row[0],
                "accuracy_rating": sr_row[1],
                "completeness_rating": sr_row[2],
                "what_could_be_better": sr_row[3],
                "missing_insights": sr_row[4],
            }

        existing_review = {
            "id": review_row[0],
            "reviewer_name": review_row[1],
            "overall_rating": review_row[2],
            "overall_comments": review_row[3],
            "created_at": review_row[4].isoformat() if review_row[4] else None,
            "question_reviews": question_reviews,
            "summary_review": summary_review,
        }

    return SessionReviewData(
        session_id=row[0],
        language=row[1] or 'lt',
        interview_mode=state.get("interview_mode", "quick"),
        created_at=row[3],
        completed_at=row[4],
        contact_info=state.get("contact_info"),
        questions_answers=questions_answers,
        slots=state.get("slots", {}),
        risk_flags=state.get("risk_flags", []),
        final_report=row[5],
        existing_review=existing_review,
    )


@router.post("/sessions/{session_id}/review", response_model=ExpertReviewResponse)
async def submit_expert_review(
    session_id: UUID,
    review: ExpertReviewInput,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Submit expert review for a session.

    Creates a new review record with:
    - Overall rating and comments
    - Individual question reviews with ratings and improvement suggestions
    - Summary/report review with accuracy and completeness ratings
    """
    # Verify session exists
    result = await db.execute(
        text("SELECT session_id FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")

    # Check if review already exists
    existing = await db.execute(
        text("SELECT id FROM expert_reviews WHERE session_id = :id"),
        {"id": session_id},
    )
    if existing.fetchone():
        raise HTTPException(
            status_code=400,
            detail="Review already exists for this session. Use PUT to update."
        )

    # Create expert review
    result = await db.execute(
        text("""
            INSERT INTO expert_reviews (session_id, reviewer_name, overall_rating, overall_comments)
            VALUES (:session_id, :reviewer_name, :overall_rating, :overall_comments)
            RETURNING id
        """),
        {
            "session_id": session_id,
            "reviewer_name": review.reviewer_name,
            "overall_rating": review.overall_rating,
            "overall_comments": review.overall_comments,
        },
    )
    review_id = result.scalar_one()

    # Insert question reviews
    for qr in review.question_reviews:
        await db.execute(
            text("""
                INSERT INTO question_reviews (
                    expert_review_id, question_id, original_question, user_response,
                    effectiveness_rating, what_could_be_better, suggested_alternative,
                    missed_opportunities
                )
                VALUES (
                    :review_id, :question_id, :original_question, :user_response,
                    :effectiveness_rating, :what_could_be_better, :suggested_alternative,
                    :missed_opportunities
                )
            """),
            {
                "review_id": review_id,
                "question_id": qr.question_id,
                "original_question": qr.original_question,
                "user_response": qr.user_response,
                "effectiveness_rating": qr.effectiveness_rating,
                "what_could_be_better": qr.what_could_be_better,
                "suggested_alternative": qr.suggested_alternative,
                "missed_opportunities": qr.missed_opportunities or [],
            },
        )

    # Insert summary review if provided
    if review.summary_review:
        await db.execute(
            text("""
                INSERT INTO summary_reviews (
                    expert_review_id, original_summary, accuracy_rating,
                    completeness_rating, what_could_be_better, missing_insights
                )
                VALUES (
                    :review_id, :original_summary, :accuracy_rating,
                    :completeness_rating, :what_could_be_better, :missing_insights
                )
            """),
            {
                "review_id": review_id,
                "original_summary": review.summary_review.original_summary,
                "accuracy_rating": review.summary_review.accuracy_rating,
                "completeness_rating": review.summary_review.completeness_rating,
                "what_could_be_better": review.summary_review.what_could_be_better,
                "missing_insights": review.summary_review.missing_insights or [],
            },
        )

    return ExpertReviewResponse(
        success=True,
        review_id=review_id,
        message=f"Review submitted successfully with {len(review.question_reviews)} question reviews",
    )


@router.get("/reviews/stats")
async def get_review_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Get aggregated statistics from expert reviews.

    Returns:
    - Total reviews count
    - Average ratings
    - Common improvement suggestions
    """
    # Get overall stats
    result = await db.execute(
        text("""
            SELECT
                COUNT(*) as total_reviews,
                COALESCE(AVG(overall_rating), 0) as avg_overall_rating
            FROM expert_reviews
        """)
    )
    row = result.fetchone()

    # Get question review stats
    qr_result = await db.execute(
        text("""
            SELECT
                COUNT(*) as total_question_reviews,
                COALESCE(AVG(effectiveness_rating), 0) as avg_effectiveness
            FROM question_reviews
        """)
    )
    qr_row = qr_result.fetchone()

    # Get summary review stats
    sr_result = await db.execute(
        text("""
            SELECT
                COUNT(*) as total_summary_reviews,
                COALESCE(AVG(accuracy_rating), 0) as avg_accuracy,
                COALESCE(AVG(completeness_rating), 0) as avg_completeness
            FROM summary_reviews
        """)
    )
    sr_row = sr_result.fetchone()

    # Get common improvement suggestions (most frequent words in what_could_be_better)
    return {
        "total_reviews": row[0],
        "avg_overall_rating": round(float(row[1]), 2),
        "question_reviews": {
            "total": qr_row[0],
            "avg_effectiveness": round(float(qr_row[1]), 2),
        },
        "summary_reviews": {
            "total": sr_row[0],
            "avg_accuracy": round(float(sr_row[1]), 2),
            "avg_completeness": round(float(sr_row[2]), 2),
        },
    }


class DeleteSessionResponse(BaseModel):
    """Response after deleting a session."""
    success: bool
    message: str
    deleted_counts: dict


@router.delete("/sessions/{session_id}", response_model=DeleteSessionResponse)
async def delete_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """
    Delete a session and all related data.

    This permanently removes:
    - The session record
    - All messages associated with the session
    - All transcripts associated with the session
    - All feedback associated with the session
    - All expert reviews (and their question/summary reviews)

    This action cannot be undone.
    """
    # Verify session exists
    result = await db.execute(
        text("SELECT session_id FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")

    deleted_counts = {}

    # Delete expert reviews first (no CASCADE on this FK)
    # question_reviews and summary_reviews will be deleted by CASCADE
    review_result = await db.execute(
        text("DELETE FROM expert_reviews WHERE session_id = :id"),
        {"id": session_id},
    )
    deleted_counts["expert_reviews"] = review_result.rowcount

    # Delete the session (messages, transcripts, feedback will CASCADE)
    # Count related records before deletion for reporting
    msg_count = await db.execute(
        text("SELECT COUNT(*) FROM messages WHERE session_id = :id"),
        {"id": session_id},
    )
    deleted_counts["messages"] = msg_count.scalar() or 0

    trans_count = await db.execute(
        text("SELECT COUNT(*) FROM transcripts WHERE session_id = :id"),
        {"id": session_id},
    )
    deleted_counts["transcripts"] = trans_count.scalar() or 0

    feedback_count = await db.execute(
        text("SELECT COUNT(*) FROM feedback WHERE session_id = :id"),
        {"id": session_id},
    )
    deleted_counts["feedback"] = feedback_count.scalar() or 0

    # Now delete the session (cascades to messages, transcripts, feedback)
    await db.execute(
        text("DELETE FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    deleted_counts["sessions"] = 1

    await db.commit()

    return DeleteSessionResponse(
        success=True,
        message=f"Session {session_id} and all related data deleted successfully",
        deleted_counts=deleted_counts,
    )
