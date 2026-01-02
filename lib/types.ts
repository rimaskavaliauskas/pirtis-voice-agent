// Voice Agent Frontend Types
// Based on brain-contract.md specifications

// ============================================
// Core Types
// ============================================

export type InterviewMode = 'quick' | 'precise';

export interface Question {
  id: string;
  text: string;
}

export interface QA {
  question_id: string;
  question_text: string;
  transcript: string;
  round_number: number;
}

export interface Slot {
  value: string | number | boolean | Record<string, unknown> | null;
  confidence: number;
}

export interface RiskFlag {
  code: string;
  severity: 'low' | 'medium' | 'high';
  note: string;
  evidence: string[];
}

export interface SlotStatus {
  slot_key: string;
  label: string;
  status: 'filled' | 'partial' | 'empty';
  confidence: number;
}

export interface ContactInfo {
  name: string;
  email?: string;
  phone?: string;
}

export interface FeedbackSubmission {
  rating: number;
  feedback_text?: string;
}

export interface FeedbackEntry {
  id: string;
  session_id: string;
  rating: number;
  feedback_text?: string;
  created_at: string;
}

export interface FeedbackStats {
  total_count: number;
  average_rating: number;
  rating_distribution: Record<number, number>;
}

// ============================================
// Session State (matches backend AgentState)
// ============================================

export interface AgentState {
  session_id: string;
  language: 'lt' | 'en' | 'ru';
  interview_mode: InterviewMode;
  round: number;
  history: HistoryEntry[];
  slots: Record<string, Slot>;
  unknown_slots: string[];
  risk_flags: RiskFlag[];
  round_summary: string | null;
  asked_question_ids: string[];
  next_questions: Question[];
  report_markdown?: string;
  report_json?: Record<string, unknown>;
  is_complete: boolean;
  contact_info?: ContactInfo;
}

export interface HistoryEntry {
  role: 'agent' | 'user';
  question_id?: string;
  text: string;
  round: number;
}

// ============================================
// API Request/Response Types
// ============================================

// POST /session/start
export interface StartSessionRequest {
  language: 'lt' | 'en' | 'ru';
  interview_mode: InterviewMode;
}

export interface StartSessionResponse {
  session_id: string;
  round: number;
  questions: Question[];
  interview_mode: InterviewMode;
}

// POST /session/transcribe
export interface TranscribeResponse {
  transcript: string;
}

// POST /session/{id}/answer
export interface AnswerRequest {
  transcripts: ConfirmedAnswer[];
}

export interface ConfirmedAnswer {
  question_id: string;
  text: string;
}

export interface AnswerResponse {
  session_id: string;
  round: number;
  slots_updated: string[];
  next_questions: Question[];
  round_summary: string | null;
  is_complete: boolean;
  risk_flags: RiskFlag[];
  clarification_question?: string;
  slot_status?: SlotStatus[];
  progress_percent?: number;
}

// POST /session/{id}/finalize
export interface FinalizeRequest {
  contact_info?: ContactInfo;
}

export interface FinalizeResponse {
  session_id: string;
  final_markdown: string;
  slots: Record<string, Slot>;
  risk_flags: RiskFlag[];
}

// GET /session/{id}/results
export interface ResultsResponse {
  session_id: string;
  final_markdown: string;
  slots: Record<string, Slot>;
  risk_flags: RiskFlag[];
  completed_at: string | null;
}

// ============================================
// Admin API Types (Brain Config)
// ============================================

export interface BrainConfigExportResponse {
  yaml_content: string;
  slots_count?: number;
  questions_count?: number;
  risk_rules_count?: number;
}

export interface BrainConfigValidateRequest {
  yaml_content: string;
}

export interface BrainConfigValidateResponse {
  valid: boolean;
  errors?: string[];
}

export interface BrainConfigImportRequest {
  yaml_content: string;
}

export interface BrainConfigImportResponse {
  success: boolean;
  message: string;
}

// ============================================
// UI State Types
// ============================================

export type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

export interface QuestionState {
  question: Question;
  recordingState: RecordingState;
  audioBlob: Blob | null;
  transcript: string | null;
  isConfirmed: boolean;
}

export type InterviewPhase =
  | 'loading'
  | 'round_active'
  | 'round_submitting'
  | 'finalizing'
  | 'complete'
  | 'error';

export interface InterviewState {
  sessionId: string;
  phase: InterviewPhase;
  interviewMode: InterviewMode;
  currentRound: number;
  questions: QuestionState[];
  roundSummary: string | null;
  riskFlags: RiskFlag[];
  slotStatus: SlotStatus[];
  clarificationQuestion: string | null;
  error: string | null;
}

// ============================================
// Health Check
// ============================================

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  stt_ready: boolean;
  db_ready: boolean;
}
