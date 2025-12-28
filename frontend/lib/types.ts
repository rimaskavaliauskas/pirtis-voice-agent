// Voice Agent Frontend Types
// Based on brain-contract.md specifications

// ============================================
// Core Types
// ============================================

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

// ============================================
// Session State (matches backend AgentState)
// ============================================

export interface AgentState {
  session_id: string;
  language: 'lt' | 'en' | 'ru';
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
export interface StartSessionResponse {
  session_id: string;
  round: number;
  questions: Question[];
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
}

// POST /session/{id}/finalize
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
  yaml: string;
}

export interface BrainConfigValidateRequest {
  yaml: string;
}

export interface BrainConfigValidateResponse {
  valid: boolean;
  errors?: string[];
}

export interface BrainConfigImportRequest {
  yaml: string;
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
  currentRound: number;
  questions: QuestionState[];
  roundSummary: string | null;
  riskFlags: RiskFlag[];
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
