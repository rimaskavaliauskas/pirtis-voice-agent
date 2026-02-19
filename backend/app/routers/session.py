"""
Session Router - Interview Session Management

Handles the interview flow: start, transcribe, answer, finalize, feedback.
"""

import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    StartSessionRequest,
    StartSessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TranscribeResponse,
    FinalizeRequest,
    FinalizeResponse,
    FeedbackSubmission,
    FeedbackResponse,
    FeedbackStats,
    Question,
    SlotValue,
    SlotStatus,
    AgentState,
    ContactInfo,
)
from app.services.brain import brain_config
from app.services.whisper import transcribe_audio
from app.services.llm import extract_slots, generate_report, generate_clarification_question, generate_followup_question_v2
from app.services.skill import get_skill_for_prompts
from app.services.llm_v2 import generate_followup_question_v3
from app.services.scoring import select_next_questions, select_next_question_quick
from app.services.risk import evaluate_risk_rules
from app.services.quick_policy import evaluate_stop_conditions, calculate_low_info, calculate_quick_progress

router = APIRouter()


def calculate_slot_status(slots: dict, slot_definitions: list) -> list[SlotStatus]:
    """Calculate slot status for frontend display."""
    result = []
    for slot_def in slot_definitions:
        key = slot_def.get("slot_key")
        label = slot_def.get("label_lt", key)
        slot_data = slots.get(key, {})

        confidence = slot_data.get("confidence", 0.0)
        value = slot_data.get("value")

        if value is not None and confidence >= 0.7:
            status = "filled"
        elif value is not None and confidence >= 0.4:
            status = "partial"
        else:
            status = "empty"

        result.append(SlotStatus(
            slot_key=key,
            label=label,
            status=status,
            confidence=confidence,
        ))

    return result


def calculate_progress_percent(slots: dict, slot_definitions: list) -> int:
    """
    Calculate overall interview completion percentage.

    Required slots (is_required=True) contribute 60% weight.
    Optional slots contribute 40% weight.
    Confidence affects fill level: >0.7 = 100%, 0.4-0.7 = 50%, <0.4 = 0%
    """
    required_slots = [s for s in slot_definitions if s.get("is_required", False)]
    optional_slots = [s for s in slot_definitions if not s.get("is_required", False)]

    def slot_fill_level(slot_key: str) -> float:
        slot_data = slots.get(slot_key, {})
        value = slot_data.get("value")
        confidence = slot_data.get("confidence", 0.0)

        if value is None:
            return 0.0
        elif confidence >= 0.7:
            return 1.0
        elif confidence >= 0.4:
            return 0.5
        else:
            return 0.0

    # Calculate required slots progress (60% weight)
    if required_slots:
        required_filled = sum(slot_fill_level(s.get("slot_key")) for s in required_slots)
        required_progress = (required_filled / len(required_slots)) * 0.6
    else:
        required_progress = 0.6  # If no required slots, give full credit

    # Calculate optional slots progress (40% weight)
    if optional_slots:
        optional_filled = sum(slot_fill_level(s.get("slot_key")) for s in optional_slots)
        optional_progress = (optional_filled / len(optional_slots)) * 0.4
    else:
        optional_progress = 0.4  # If no optional slots, give full credit

    return int((required_progress + optional_progress) * 100)


@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new interview session.

    Creates a new session in the database and returns the first questions.
    In quick mode: 3 questions at once
    In precise mode: 1 question at a time
    """
    language = request.language if request else "lt"
    interview_mode = request.interview_mode if request else "quick"

    # Load brain config
    await brain_config.load_all(db)

    # Initialize empty slots
    initial_slots = {}
    for slot_def in brain_config.slots:
        key = slot_def.get("slot_key")
        initial_slots[key] = {"value": None, "confidence": 0.0}

    # Create initial state
    initial_state = {
        "language": language,
        "interview_mode": interview_mode,
        "round": 1,
        "history": [],
        "slots": initial_slots,
        "unknown_slots": [s["slot_key"] for s in brain_config.slots],
        "risk_flags": [],
        "round_summary": None,
        "asked_question_ids": [],
        "next_questions": [],
        "contact_info": None,
        "questions_asked_count": 0,  # Track total questions asked in precise mode
    }

    # Insert session into database
    result = await db.execute(
        text("""
            INSERT INTO sessions (language, round, state)
            VALUES (:language, 1, :state)
            RETURNING session_id
        """),
        {"language": language, "state": json.dumps(initial_state)},
    )
    session_id = result.scalar_one()

    # Convert slots dict to SlotValue objects for scoring
    slots_for_scoring = {
        k: SlotValue(value=v["value"], confidence=v["confidence"])
        for k, v in initial_slots.items()
    }

    # Both modes now use 1 question at a time
    question_count = 1

    # Initialize quick_state for Quick mode
    if interview_mode == "quick":
        initial_state["quick_state"] = {
            "asked_count": 0,
            "low_info_streak": 0,
            "last_question_id": None,
            "stop_reason": None,
        }

    # Select first question(s)
    questions = select_next_questions(
        questions=brain_config.questions,
        slots=slots_for_scoring,
        risk_flags=[],
        asked_question_ids=[],
        current_round=1,
        weights=brain_config.scoring_weights,
        slot_definitions=brain_config.slots,
        skip_rules=brain_config.skip_rules,
        count=question_count,
    )

    # Update state with selected questions
    initial_state["next_questions"] = [
        {"id": q.id, "text": q.text, "round_hint": q.round_hint}
        for q in questions
    ]
    # Add initial questions to history for expert review
    for q in questions:
        initial_state["history"].append({
            "role": "agent",
            "question_id": q.id,
            "text": q.text,
            "round": 1,
        })

    await db.execute(
        text("UPDATE sessions SET state = :state WHERE session_id = :id"),
        {"state": json.dumps(initial_state), "id": session_id},
    )

    return StartSessionResponse(
        session_id=session_id,
        round=1,
        questions=questions,
        interview_mode=interview_mode,
    )


@router.post("/{session_id}/transcribe", response_model=TranscribeResponse)
async def transcribe_audio_endpoint(
    session_id: UUID,
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Transcribe uploaded audio to text using Whisper.

    Returns the transcribed text for user review/editing.
    """
    # Verify session exists
    result = await db.execute(
        text("SELECT language FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    session_language = language or row[0] or None  # Auto-detect if not specified

    # Read audio data
    audio_data = await audio.read()

    if len(audio_data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Transcribe
    try:
        transcript, confidence = await transcribe_audio(
            audio_data=audio_data,
            language=session_language,
            filename=audio.filename,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    return TranscribeResponse(
        transcript=transcript,
        language=session_language,
        confidence=confidence,
    )


@router.post("/{session_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    session_id: UUID,
    request: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit confirmed transcripts for the current round.

    Extracts slots using LLM, evaluates risks, selects next questions.
    In precise mode, may return clarification question if confidence is low.
    """
    # Load session
    result = await db.execute(
        text("SELECT round, state FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    current_round = row[0]
    state = row[1] if isinstance(row[1], dict) else json.loads(row[1])
    interview_mode = state.get("interview_mode", "quick")

    # Load brain config
    await brain_config.load_all(db)
    # Load skill for enhanced question generation
    skill_content = None
    try:
        skill_content = await get_skill_for_prompts(db)
        if skill_content and skill_content.get('version'):
            print(f"Loaded skill v{skill_content['version']} for question generation")
    except Exception as e:
        print(f"Warning: Could not load skill: {e}")


    # Combine all transcripts into one answer
    combined_answer = "\n\n".join([
        f"[{t.question_id}]: {t.text}"
        for t in request.transcripts
    ])

    # Update history with user responses
    for t in request.transcripts:
        state["history"].append({
            "role": "user",
            "question_id": t.question_id,
            "text": t.text,
            "round": current_round,
        })
        if t.question_id not in state["asked_question_ids"]:
            state["asked_question_ids"].append(t.question_id)

    # Track questions asked in precise mode
    if interview_mode == "precise":
        state["questions_asked_count"] = state.get("questions_asked_count", 0) + len(request.transcripts)

    # Extract slots using LLM
    extraction_result = await extract_slots(state, combined_answer)

    # Update slots
    slots_updated = []
    for key, slot_value in extraction_result.updated_slots.items():
        if key in state["slots"]:
            state["slots"][key] = {
                "value": slot_value.value,
                "confidence": slot_value.confidence,
            }
            slots_updated.append(key)

    # Update unknown slots
    state["unknown_slots"] = extraction_result.unknown_slots

    # Update round summary
    state["round_summary"] = extraction_result.round_summary

    # Convert slots for risk evaluation
    slots_for_eval = {
        k: SlotValue(value=v["value"], confidence=v["confidence"])
        for k, v in state["slots"].items()
    }

    # Evaluate risk rules
    risk_flags = evaluate_risk_rules(slots_for_eval, brain_config.risk_rules)
    state["risk_flags"] = [rf.model_dump() for rf in risk_flags]

    # Calculate slot status for frontend
    slot_status = calculate_slot_status(state["slots"], brain_config.slots)

    # Calculate progress percentage
    progress_percent = calculate_progress_percent(state["slots"], brain_config.slots)

    # Check if clarification is needed (precise mode only)
    clarification_question = None
    confidence_threshold = 0.6

    if interview_mode == "precise" and extraction_result.updated_slots:
        # Find recently updated slots with low confidence
        low_confidence_slots = []
        for slot_key in extraction_result.updated_slots:
            slot_data = state["slots"].get(slot_key)
            if slot_data and slot_data["confidence"] < confidence_threshold:
                low_confidence_slots.append((slot_key, slot_data))

        # Generate clarification for lowest confidence slot
        if low_confidence_slots:
            low_confidence_slots.sort(key=lambda x: x[1]["confidence"])
            slot_key, slot_data = low_confidence_slots[0]

            # Find the original question from history
            original_question = ""
            user_answer = ""
            for h in reversed(state["history"]):
                if h["role"] == "agent":
                    original_question = h["text"]
                    break
                elif h["role"] == "user":
                    user_answer = h["text"]

            clarification_question = await generate_clarification_question(
                slot_key=slot_key,
                current_value=str(slot_data["value"]),
                confidence=slot_data["confidence"],
                original_question=original_question,
                user_answer=user_answer,
            )

    # Determine completion logic
    if interview_mode == "precise":
        # Precise mode: Continuous flow, no rounds
        # Complete when: progress >= 85% OR asked 12+ questions OR no more relevant questions
        questions_asked = state.get("questions_asked_count", 0)
        max_questions = 12  # Maximum questions in precise mode

        # Check for all required slots filled with high confidence
        required_slots_filled = all(
            state["slots"].get(s.get("slot_key"), {}).get("confidence", 0) >= 0.7
            for s in brain_config.slots if s.get("is_required", False)
        )

        # More conservative completion: require 90% progress OR 12+ questions
        # AND minimum 6 questions asked to ensure thorough interview
        is_complete = (
            questions_asked >= 6 and (
                progress_percent >= 90 or
                questions_asked >= max_questions
            )
        )

        if is_complete:
            next_questions = []
            state["next_questions"] = []
        else:
            # First, try AI-generated follow-up question (hybrid approach)
            ai_followup = None

            # Get session language for multilingual support
            session_language = state.get("language", "lt")

            # Language-specific role labels
            role_labels = {
                "lt": {"consultant": "Konsultantas", "client": "Klientas"},
                "en": {"consultant": "Consultant", "client": "Client"},
                "ru": {"consultant": "Консультант", "client": "Клиент"},
            }.get(session_language, {"consultant": "Consultant", "client": "Client"})

            # Format full conversation history for AI context
            formatted_history = []
            for h in state["history"]:
                if h["role"] == "agent":
                    formatted_history.append(f"{role_labels['consultant']}: {h['text']}")
                elif h["role"] == "user":
                    formatted_history.append(f"{role_labels['client']}: {h['text']}")

            # Try AI generation with full context
            if formatted_history:
                # Try skill-enhanced AI generation (v3) if skill is loaded
                if skill_content:
                    ai_followup = await generate_followup_question_v3(
                        conversation_history=formatted_history,
                        collected_slots=state["slots"],
                        missing_slots=state.get("unknown_slots", []),
                        skill_content=skill_content,
                        language=session_language,
                    )
                else:
                    ai_followup = await generate_followup_question_v2(
                        conversation_history=formatted_history,
                        collected_slots=state["slots"],
                        missing_slots=state.get("unknown_slots", []),
                    )
            
            if ai_followup:
                # Use AI-generated question
                ai_question_id = f"AI_FOLLOWUP_{questions_asked}"
                next_questions = [Question(id=ai_question_id, text=ai_followup)]
                state["next_questions"] = [
                    {"id": ai_question_id, "text": ai_followup, "round_hint": None}
                ]
                # Add agent question to history for expert review
                state["history"].append({
                    "role": "agent",
                    "question_id": ai_question_id,
                    "text": ai_followup,
                    "round": current_round,
                })
            else:
                # Fall back to predefined question selection
                next_questions = select_next_questions(
                    questions=brain_config.questions,
                    slots=slots_for_eval,
                    risk_flags=risk_flags,
                    asked_question_ids=state["asked_question_ids"],
                    current_round=current_round,  # Keep for scoring compatibility
                    weights=brain_config.scoring_weights,
                    slot_definitions=brain_config.slots,
                    skip_rules=brain_config.skip_rules,
                    count=1,
                )

                # If no more questions available, complete the interview
                if not next_questions:
                    is_complete = True

                state["next_questions"] = [
                    {"id": q.id, "text": q.text, "round_hint": q.round_hint}
                    for q in next_questions
                ]
                # Add agent questions to history for expert review
                for q in next_questions:
                    state["history"].append({
                        "role": "agent",
                        "question_id": q.id,
                        "text": q.text,
                        "round": current_round,
                    })
    else:
        # Quick mode: Iterative top-1 loop with stop conditions
        import copy as _copy

        # Track questions asked
        state["questions_asked_count"] = state.get("questions_asked_count", 0) + len(request.transcripts)

        # Initialize quick_state if missing (backward compat)
        quick_state = state.get("quick_state", {
            "asked_count": 0,
            "low_info_streak": 0,
            "last_question_id": None,
            "stop_reason": None,
        })

        # Capture slots before extraction for low_info detection
        # (slots were already updated above, so compare with what we had)
        # Use slots_updated list to determine if info was gained
        answer_text = request.transcripts[0].text if request.transcripts else ""
        is_low_info = len(slots_updated) == 0 or len(answer_text.strip()) < 15

        if is_low_info:
            quick_state["low_info_streak"] = quick_state.get("low_info_streak", 0) + 1
        else:
            quick_state["low_info_streak"] = 0

        quick_state["asked_count"] = quick_state.get("asked_count", 0) + 1

        # Load quick policy
        quick_policy = brain_config.quick_policy

        if quick_policy:
            # Evaluate stop conditions
            should_stop, stop_reason = evaluate_stop_conditions(
                policy=quick_policy,
                slots=state["slots"],
                asked_count=quick_state["asked_count"],
                low_info_streak=quick_state["low_info_streak"],
            )

            # Calculate progress based on critical slots
            progress_percent = calculate_quick_progress(quick_policy, state["slots"])

            if should_stop:
                quick_state["stop_reason"] = stop_reason
                is_complete = True
                next_questions = []
                state["next_questions"] = []
            else:
                # Select next question using quick scoring
                next_q = select_next_question_quick(
                    questions=brain_config.questions,
                    slots=slots_for_eval,
                    slots_raw=state["slots"],
                    risk_flags=risk_flags,
                    asked_question_ids=state["asked_question_ids"],
                    weights=brain_config.scoring_weights,
                    slot_definitions=brain_config.slots,
                    skip_rules=brain_config.skip_rules,
                    policy=quick_policy,
                    last_question_id=quick_state.get("last_question_id"),
                )

                if next_q:
                    quick_state["last_question_id"] = next_q.id
                    next_questions = [next_q]
                    state["next_questions"] = [
                        {"id": next_q.id, "text": next_q.text, "round_hint": next_q.round_hint}
                    ]
                    # Add to history for expert review
                    state["history"].append({
                        "role": "agent",
                        "question_id": next_q.id,
                        "text": next_q.text,
                        "round": 1,
                    })
                    is_complete = False
                else:
                    # No more questions available
                    quick_state["stop_reason"] = "no_questions"
                    is_complete = True
                    next_questions = []
                    state["next_questions"] = []
        else:
            # No quick policy configured — fallback to simple max 8 questions
            if quick_state["asked_count"] >= 8:
                is_complete = True
                next_questions = []
                state["next_questions"] = []
            else:
                next_questions = select_next_questions(
                    questions=brain_config.questions,
                    slots=slots_for_eval,
                    risk_flags=risk_flags,
                    asked_question_ids=state["asked_question_ids"],
                    current_round=1,
                    weights=brain_config.scoring_weights,
                    slot_definitions=brain_config.slots,
                    skip_rules=brain_config.skip_rules,
                    count=1,
                )
                if next_questions:
                    quick_state["last_question_id"] = next_questions[0].id
                    state["next_questions"] = [
                        {"id": q.id, "text": q.text, "round_hint": q.round_hint}
                        for q in next_questions
                    ]
                    for q in next_questions:
                        state["history"].append({
                            "role": "agent",
                            "question_id": q.id,
                            "text": q.text,
                            "round": 1,
                        })
                    is_complete = False
                else:
                    is_complete = True
                    state["next_questions"] = []

        state["quick_state"] = quick_state

    # Save updated state
    await db.execute(
        text("""
            UPDATE sessions
            SET round = :round, state = :state, updated_at = NOW()
            WHERE session_id = :id
        """),
        {
            "round": state.get("round", current_round),
            "state": json.dumps(state),
            "id": session_id,
        },
    )

    return SubmitAnswerResponse(
        session_id=session_id,
        round=state.get("round", current_round),
        slots_updated=slots_updated,
        risk_flags=risk_flags,
        round_summary=state["round_summary"],
        next_questions=next_questions,
        is_complete=is_complete,
        clarification_question=clarification_question,
        slot_status=slot_status,
        progress_percent=progress_percent,
    )


@router.post("/{session_id}/finalize", response_model=FinalizeResponse)
async def finalize_session(
    session_id: UUID,
    request: FinalizeRequest = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Finalize the session and generate the final report.

    Uses LLM to create a comprehensive Markdown report.
    - Stores full report in database
    - Extracts summary (Sections I-III) for client display
    - Sends full report via email if email provided
    """
    from app.services.email import send_report_email, extract_report_summary
    from datetime import datetime

    # Load session
    result = await db.execute(
        text("SELECT state, language FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    state = row[0] if isinstance(row[0], dict) else json.loads(row[0])
    language = row[1] or "lt"

    # Extract contact info
    contact_name = None
    contact_email = None
    contact_phone = None

    if request and request.contact_info:
        contact_info = request.contact_info.model_dump()
        state["contact_info"] = contact_info
        contact_name = contact_info.get("name")
        contact_email = contact_info.get("email")
        contact_phone = contact_info.get("phone")

    # Load brain config for report footer
    await brain_config.load_all(db)
    report_footer = brain_config.get_config_value("report_footer", "")

    # Load skill for enhanced report generation
    skill_content = None
    try:
        skill_content = await get_skill_for_prompts(db)
        if skill_content and skill_content.get('version'):
            print(f"Loaded skill v{skill_content['version']} for report generation")
    except Exception as e:
        print(f"Warning: Could not load skill for report: {e}")

    # Generate full report using LLM with skill template
    final_markdown = await generate_report(
        state,
        contact_info=state.get("contact_info"),
        report_footer=report_footer,
        skill_content=skill_content,
    )

    # Extract summary (Sections I-III) for client display
    report_summary = extract_report_summary(final_markdown)

    # Send email if email provided
    email_sent_at = None
    if contact_email:
        try:
            # Translate report if not Lithuanian
            email_report = final_markdown
            if language and language != "lt":
                from app.services.llm import translate_markdown
                print(f"Translating report to {language} for email...")
                email_report = await translate_markdown(final_markdown, language)
                print(f"Report translated to {language}")

            success = send_report_email(
                to_email=contact_email,
                to_name=contact_name or "Client",
                report_markdown=email_report,
                session_id=str(session_id),
                language=language,
            )
            if success:
                email_sent_at = datetime.now()
                print(f"Email sent to {contact_email} for session {session_id}")
        except Exception as e:
            print(f"Failed to send email: {e}")

    # Convert slots to SlotValue objects
    slots = {
        k: SlotValue(value=v["value"], confidence=v["confidence"])
        for k, v in state.get("slots", {}).items()
    }

    # Convert risk flags
    risk_flags = [
        {"code": rf["code"], "severity": rf["severity"], "note": rf.get("note"), "evidence": rf.get("evidence", [])}
        for rf in state.get("risk_flags", [])
    ]

    # Save to database with all new fields
    await db.execute(
        text("""
            UPDATE sessions
            SET final_report = :report,
                report_summary = :summary,
                state = :state,
                contact_name = :contact_name,
                contact_email = :contact_email,
                contact_phone = :contact_phone,
                email_sent_at = :email_sent_at,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE session_id = :id
        """),
        {
            "report": final_markdown,
            "summary": report_summary,
            "state": json.dumps(state),
            "contact_name": contact_name,
            "contact_email": contact_email,
            "contact_phone": contact_phone,
            "email_sent_at": email_sent_at,
            "id": session_id,
        },
    )

    # Return summary to client (not full report)
    # Full report was sent to email and is visible in admin
    return FinalizeResponse(
        session_id=session_id,
        final_markdown=report_summary,  # Client sees summary only
        slots=slots,
        risk_flags=risk_flags,
        email_sent=email_sent_at is not None,
    )



@router.post("/{session_id}/feedback")
async def submit_feedback(
    session_id: UUID,
    request: FeedbackSubmission,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit user feedback for a completed session.
    """
    # Verify session exists and is completed
    result = await db.execute(
        text("SELECT completed_at FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    if not row[0]:
        raise HTTPException(status_code=400, detail="Session not yet completed")

    # Check if feedback already exists
    existing = await db.execute(
        text("SELECT id FROM feedback WHERE session_id = :id"),
        {"id": session_id},
    )
    if existing.fetchone():
        raise HTTPException(status_code=400, detail="Feedback already submitted")

    # Insert feedback
    await db.execute(
        text("""
            INSERT INTO feedback (session_id, rating, feedback_text)
            VALUES (:session_id, :rating, :text)
        """),
        {
            "session_id": session_id,
            "rating": request.rating,
            "text": request.feedback_text,
        },
    )

    return {"success": True, "message": "Feedback submitted successfully"}


@router.get("/{session_id}/state")
async def get_session_state(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the current state of a session (debug endpoint).
    """
    result = await db.execute(
        text("SELECT round, state, final_report, created_at, completed_at FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    state = row[1] if isinstance(row[1], dict) else json.loads(row[1])

    # Load brain config to calculate slot status and progress
    await brain_config.load_all(db)
    slot_status = calculate_slot_status(state.get("slots", {}), brain_config.slots)
    progress_percent = calculate_progress_percent(state.get("slots", {}), brain_config.slots)

    return {
        "session_id": str(session_id),
        "round": row[0],
        "state": state,
        "final_report": row[2],
        "created_at": row[3].isoformat() if row[3] else None,
        "completed_at": row[4].isoformat() if row[4] else None,
        "interview_mode": state.get("interview_mode", "quick"),
        "slot_status": [s.model_dump() for s in slot_status],
        "progress_percent": progress_percent,
    }


@router.get("/{session_id}/results")
async def get_session_results(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the final results of a completed session.

    Returns the report summary (Sections I-III) for client display.
    Full report is sent via email and visible in admin panel.
    """
    result = await db.execute(
        text("""
            SELECT state, final_report, report_summary, completed_at, email_sent_at, contact_email
            FROM sessions WHERE session_id = :id
        """),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    if not row[3]:  # completed_at
        raise HTTPException(status_code=400, detail="Session not yet completed")

    state = row[0] if isinstance(row[0], dict) else json.loads(row[0])

    # Use summary if available, otherwise fall back to full report
    display_markdown = row[2] if row[2] else row[1]

    return {
        "session_id": str(session_id),
        "final_markdown": display_markdown,
        "slots": state.get("slots", {}),
        "risk_flags": state.get("risk_flags", []),
        "completed_at": row[3].isoformat() if row[3] else None,
        "email_sent": row[4] is not None,  # email_sent_at
        "contact_email": row[5],  # For showing "sent to..." message
    }




@router.get("/{session_id}/download")
async def download_report(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Download the final report as a Markdown file.
    """
    from fastapi.responses import Response

    result = await db.execute(
        text("SELECT final_report, completed_at FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    if not row[0]:
        raise HTTPException(status_code=400, detail="Report not yet generated")

    return Response(
        content=row[0],
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="pirtis-report-{str(session_id)[:8]}.md"'
        },
    )


@router.post("/{session_id}/translate")
async def translate_report(
    session_id: UUID,
    target_language: str = "en",
    db: AsyncSession = Depends(get_db),
):
    """
    Translate the final report to target language.
    """
    from app.services.llm import translate_markdown

    result = await db.execute(
        text("SELECT final_report, state FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    if not row[0]:
        raise HTTPException(status_code=400, detail="Report not yet generated")

    translated = await translate_markdown(row[0], target_language)

    return {
        "session_id": str(session_id),
        "original_language": "lt",
        "target_language": target_language,
        "translated_markdown": translated,
    }
