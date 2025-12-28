"""
Session Router - Interview Session Management

Handles the interview flow: start, transcribe, answer, finalize.
"""

import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    StartSessionRequest,
    StartSessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TranscribeResponse,
    FinalizeResponse,
    Question,
    SlotValue,
    AgentState,
)
from app.services.brain import brain_config
from app.services.whisper import transcribe_audio
from app.services.llm import extract_slots, generate_report
from app.services.scoring import select_next_questions
from app.services.risk import evaluate_risk_rules

router = APIRouter()


@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new interview session.

    Creates a new session in the database and returns the first 3 questions.
    """
    language = request.language if request else "lt"

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
        "round": 1,
        "history": [],
        "slots": initial_slots,
        "unknown_slots": [s["slot_key"] for s in brain_config.slots],
        "risk_flags": [],
        "round_summary": None,
        "asked_question_ids": [],
        "next_questions": [],
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

    # Select first 3 questions
    questions = select_next_questions(
        questions=brain_config.questions,
        slots=slots_for_scoring,
        risk_flags=[],
        asked_question_ids=[],
        current_round=1,
        weights=brain_config.scoring_weights,
        slot_definitions=brain_config.slots,
        count=3,
    )

    # Update state with selected questions
    initial_state["next_questions"] = [
        {"id": q.id, "text": q.text, "round_hint": q.round_hint}
        for q in questions
    ]
    # Track asked questions and agent messages for context
    initial_state["asked_question_ids"] = [q.id for q in questions]
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

    session_language = language or row[0] or "lt"

    # Read audio data
    audio_data = await audio.read()

    if len(audio_data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    # Guardrails on size
    from app.config import get_settings
    settings = get_settings()
    if len(audio_data) > settings.max_audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file too large")

    # Transcribe
    try:
        transcript, confidence = await transcribe_audio(
            audio_data=audio_data,
            language=session_language,
            filename=audio.filename,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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

    # Load brain config
    await brain_config.load_all(db)

    # Combine all transcripts into one answer
    # Attach question text for better context
    question_text_lookup = {
        q["id"]: q.get("text", "")
        for q in state.get("next_questions", [])
    }
    combined_answer = "\n\n".join([
        f"[{t.question_id}] {question_text_lookup.get(t.question_id, '')} -> {t.text}"
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

    # Determine if complete (round 3 done)
    is_complete = current_round >= 3

    if is_complete:
        # No more questions
        next_questions = []
        state["next_questions"] = []
    else:
        # Advance to next round
        next_round = current_round + 1
        state["round"] = next_round

        # Select next questions
        next_questions = select_next_questions(
            questions=brain_config.questions,
            slots=slots_for_eval,
            risk_flags=risk_flags,
            asked_question_ids=state["asked_question_ids"],
            current_round=next_round,
            weights=brain_config.scoring_weights,
            slot_definitions=brain_config.slots,
            count=3,
        )

        # Track agent questions in history and asked list
        for q in next_questions:
            if q.id not in state["asked_question_ids"]:
                state["asked_question_ids"].append(q.id)
            state["history"].append({
                "role": "agent",
                "question_id": q.id,
                "text": q.text,
                "round": next_round,
            })

        state["next_questions"] = [
            {"id": q.id, "text": q.text, "round_hint": q.round_hint}
            for q in next_questions
        ]

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
    )


@router.post("/{session_id}/finalize", response_model=FinalizeResponse)
async def finalize_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Finalize the session and generate the final report.

    Uses LLM to create a comprehensive Markdown report.
    """
    # Load session
    result = await db.execute(
        text("SELECT state FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    state = row[0] if isinstance(row[0], dict) else json.loads(row[0])

    # Generate report using LLM
    final_markdown = await generate_report(state)

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

    # Save report to database
    await db.execute(
        text("""
            UPDATE sessions
            SET final_report = :report, completed_at = NOW(), updated_at = NOW()
            WHERE session_id = :id
        """),
        {"report": final_markdown, "id": session_id},
    )

    return FinalizeResponse(
        session_id=session_id,
        final_markdown=final_markdown,
        slots=slots,
        risk_flags=risk_flags,
    )


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

    return {
        "session_id": str(session_id),
        "round": row[0],
        "state": state,
        "final_report": row[2],
        "created_at": row[3].isoformat() if row[3] else None,
        "completed_at": row[4].isoformat() if row[4] else None,
    }


@router.get("/{session_id}/results")
async def get_session_results(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the final results of a completed session.
    """
    result = await db.execute(
        text("SELECT state, final_report, completed_at FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    if not row[2]:
        raise HTTPException(status_code=400, detail="Session not yet completed")

    state = row[0] if isinstance(row[0], dict) else json.loads(row[0])

    return {
        "session_id": str(session_id),
        "final_markdown": row[1],
        "slots": state.get("slots", {}),
        "risk_flags": state.get("risk_flags", []),
        "completed_at": row[2].isoformat() if row[2] else None,
    }


@router.get("/{session_id}/download")
async def download_report(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Download the final markdown report as text.
    """
    result = await db.execute(
        text("SELECT final_report FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if not row[0]:
        raise HTTPException(status_code=400, detail="Session not yet completed")

    return PlainTextResponse(row[0], media_type="text/markdown")


@router.post("/{session_id}/translate")
async def translate_report(
    session_id: UUID,
    target_language: str = "en",
    db: AsyncSession = Depends(get_db),
):
    """
    Dummy translation endpoint for frontend compatibility.
    """
    result = await db.execute(
        text("SELECT final_report FROM sessions WHERE session_id = :id"),
        {"id": session_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if not row[0]:
        raise HTTPException(status_code=400, detail="Session not yet completed")

    # For now, return the original markdown; real translation can be wired to LLM later.
    return {
        "translated_markdown": row[0],
        "target_language": target_language,
    }
