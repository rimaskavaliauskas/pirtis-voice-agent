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
  final_markdown: string;  // Contains summary for client (Sections I-III)
  slots: Record<string, Slot>;
  risk_flags: RiskFlag[];
  email_sent?: boolean;  // True if full report was sent to email
}

// GET /session/{id}/results
export interface ResultsResponse {
  session_id: string;
  final_markdown: string;  // Contains summary for client (Sections I-III)
  slots: Record<string, Slot>;
  risk_flags: RiskFlag[];
  completed_at: string | null;
  email_sent?: boolean;  // True if full report was sent to email
  contact_email?: string;  // Email address report was sent to
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

// ============================================
// Expert Review Types
// ============================================

export interface SessionListItem {
  session_id: string;
  language: string;
  interview_mode: string;
  created_at: string;
  completed_at: string | null;
  has_report: boolean;
  has_review: boolean;
  questions_count: number;
  slots_filled: number;
  contact_name: string | null;
}

export interface QuestionAnswer {
  question_id: string;
  question_text: string;
  answer_text: string;
  round: number;
}

export interface SessionReviewData {
  session_id: string;
  language: string;
  interview_mode: string;
  created_at: string;
  completed_at: string | null;
  contact_info: Record<string, string> | null;
  questions_answers: QuestionAnswer[];
  slots: Record<string, Slot>;
  risk_flags: RiskFlag[];
  final_report: string | null;
  existing_review: ExistingReview | null;
}

export interface ExistingReview {
  id: number;
  reviewer_name: string | null;
  overall_rating: number;
  overall_comments: string | null;
  created_at: string | null;
  question_reviews: QuestionReviewData[];
  summary_review: SummaryReviewData | null;
}

export interface QuestionReviewData {
  question_id: string;
  original_question: string;
  user_response: string | null;
  effectiveness_rating: number;
  what_could_be_better: string | null;
  suggested_alternative: string | null;
  missed_opportunities: string[] | null;
}

export interface SummaryReviewData {
  original_summary: string;
  accuracy_rating: number;
  completeness_rating: number;
  what_could_be_better: string | null;
  missing_insights: string[] | null;
}

export interface QuestionReviewInput {
  question_id: string;
  original_question: string;
  user_response: string | null;
  effectiveness_rating: number;
  what_could_be_better?: string;
  suggested_alternative?: string;
  missed_opportunities?: string[];
}

export interface SummaryReviewInput {
  original_summary: string;
  accuracy_rating: number;
  completeness_rating: number;
  what_could_be_better?: string;
  missing_insights?: string[];
}

export interface ExpertReviewInput {
  reviewer_name?: string;
  overall_rating: number;
  overall_comments?: string;
  question_reviews: QuestionReviewInput[];
  summary_review?: SummaryReviewInput;
}

export interface ExpertReviewResponse {
  success: boolean;
  review_id: number;
  message: string;
}

export interface ExpertReviewStats {
  total_reviews: number;
  avg_overall_rating: number;
  question_reviews: {
    total: number;
    avg_effectiveness: number;
  };
  summary_reviews: {
    total: number;
    avg_accuracy: number;
    avg_completeness: number;
  };
}

// ============================================
// Skill Management Types
// ============================================

export interface SkillVersion {
  id: number;
  version: string;
  is_active: boolean;
  created_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  change_summary: string | null;
  content_length: number;
}

export interface LearnedRule {
  id: number;
  rule_text: string;
  rule_type: string;
  confidence_score: number;
  source_pattern: string;
  rule_text_en: string;
  affected_questions: string[];
  created_at: string | null;
  status?: 'pending' | 'approved' | 'applied';
  approved_at?: string | null;
  incorporated_in_skill?: number | null;
}

export interface GenerateRulesResponse {
  rules_generated: number;
  rules: LearnedRule[];
  message: string;
}
