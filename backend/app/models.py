"""
Pydantic models for API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================
# Interview Mode
# ============================================

InterviewMode = Literal["quick", "precise"]


# ============================================
# Slot Models
# ============================================

class SlotValue(BaseModel):
    """A single slot with value and confidence."""
    value: Optional[Any] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class SlotDefinition(BaseModel):
    """Slot definition from brain config."""
    key: str
    label_lt: Optional[str] = None
    label_en: Optional[str] = None
    description: Optional[str] = None
    is_required: bool = False
    priority_weight: float = 1.0


class SlotStatus(BaseModel):
    """Slot status for frontend display."""
    slot_key: str
    label: str
    status: Literal["filled", "partial", "empty"]
    confidence: float


# ============================================
# Question Models
# ============================================

class Question(BaseModel):
    """A question to present to the user."""
    id: str
    text: str
    round_hint: Optional[int] = None


class QuestionDefinition(BaseModel):
    """Full question definition from brain config."""
    question_id: str
    text_lt: str
    text_en: Optional[str] = None
    base_priority: int = 50
    round_hint: Optional[int] = None
    slot_coverage: List[str] = []
    risk_coverage: List[str] = []
    enabled: bool = True


# ============================================
# Risk Models
# ============================================

class RiskFlag(BaseModel):
    """An active risk/conflict detected."""
    code: str
    severity: str = "medium"
    note: Optional[str] = None
    evidence: List[str] = []


class RiskRule(BaseModel):
    """Risk detection rule from brain config."""
    rule_id: str
    code: str
    severity: str = "medium"
    rule_json: Dict[str, Any]
    note_template: Optional[str] = None
    enabled: bool = True


# ============================================
# Contact Info Models
# ============================================

class ContactInfo(BaseModel):
    """Contact information collected at end of interview."""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


# ============================================
# Feedback Models
# ============================================

class FeedbackSubmission(BaseModel):
    """Feedback submission from user."""
    rating: int = Field(..., ge=1, le=5)
    feedback_text: Optional[str] = None


class FeedbackResponse(BaseModel):
    """Feedback entry for admin view."""
    id: UUID
    session_id: UUID
    rating: int
    feedback_text: Optional[str]
    created_at: datetime


class FeedbackStats(BaseModel):
    """Aggregated feedback statistics."""
    total_count: int
    average_rating: float
    rating_distribution: Dict[int, int]


# ============================================
# Message Models
# ============================================

class Message(BaseModel):
    """A single message in the conversation."""
    role: str  # "agent" or "user"
    question_id: Optional[str] = None
    text: str
    round: int


# ============================================
# Agent State
# ============================================

class AgentState(BaseModel):
    """Complete agent state for a session."""
    session_id: UUID
    language: str = "lt"
    interview_mode: InterviewMode = "quick"
    round: int = 1
    history: List[Message] = []
    slots: Dict[str, SlotValue] = {}
    unknown_slots: List[str] = []
    risk_flags: List[RiskFlag] = []
    round_summary: Optional[str] = None
    asked_question_ids: List[str] = []
    next_questions: List[Question] = []
    contact_info: Optional[ContactInfo] = None


# ============================================
# API Request Models
# ============================================

class StartSessionRequest(BaseModel):
    """Request to start a new session."""
    language: str = "lt"
    interview_mode: InterviewMode = "quick"


class TranscriptConfirmation(BaseModel):
    """A confirmed transcript for a question."""
    question_id: str
    text: str


class SubmitAnswerRequest(BaseModel):
    """Request to submit confirmed transcripts."""
    transcripts: List[TranscriptConfirmation]


class FinalizeRequest(BaseModel):
    """Request to finalize session with contact info."""
    contact_info: Optional[ContactInfo] = None


class BrainConfigImportRequest(BaseModel):
    """Request to import brain configuration."""
    yaml_content: str


# ============================================
# API Response Models
# ============================================

class StartSessionResponse(BaseModel):
    """Response after starting a session."""
    session_id: UUID
    round: int
    questions: List[Question]
    interview_mode: InterviewMode = "quick"


class TranscribeResponse(BaseModel):
    """Response after transcribing audio."""
    transcript: str
    language: str
    confidence: Optional[float] = None


class SubmitAnswerResponse(BaseModel):
    """Response after submitting answers."""
    session_id: UUID
    round: int
    slots_updated: List[str]
    risk_flags: List[RiskFlag]
    round_summary: Optional[str] = None
    next_questions: List[Question]
    is_complete: bool = False
    clarification_question: Optional[str] = None
    slot_status: Optional[List[SlotStatus]] = None
    progress_percent: Optional[int] = None  # Overall completion percentage (0-100)


class FinalizeResponse(BaseModel):
    """Response after finalizing the session."""
    session_id: UUID
    final_markdown: str  # Contains summary for client (Sections I-III)
    slots: Dict[str, SlotValue]
    risk_flags: List[RiskFlag]
    email_sent: bool = False  # True if full report was sent to email


class BrainConfigExportResponse(BaseModel):
    """Response with exported brain configuration."""
    yaml_content: str
    slots_count: int
    questions_count: int
    risk_rules_count: int


class BrainConfigValidationResponse(BaseModel):
    """Response after validating brain configuration."""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class BrainConfigImportResponse(BaseModel):
    """Response after importing brain configuration."""
    success: bool
    slots_imported: int
    questions_imported: int
    risk_rules_imported: int


# ============================================
# LLM Response Models (Internal)
# ============================================

class LLMExtractionResponse(BaseModel):
    """Response from LLM slot extraction."""
    updated_slots: Dict[str, SlotValue]
    round_summary: str
    unknown_slots: List[str]
    notes_for_backend: List[str] = []


class LLMReportResponse(BaseModel):
    """Response from LLM report generation."""
    final_markdown: str
