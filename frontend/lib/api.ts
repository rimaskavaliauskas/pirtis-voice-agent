// Voice Agent API Client
// Handles all communication with the FastAPI backend on VPS

import type {
  StartSessionResponse,
  TranscribeResponse,
  AnswerRequest,
  AnswerResponse,
  FinalizeResponse,
  ResultsResponse,
  HealthResponse,
  BrainConfigExportResponse,
  BrainConfigValidateRequest,
  BrainConfigValidateResponse,
  BrainConfigImportRequest,
  BrainConfigImportResponse,
} from './types';

// ============================================
// Configuration
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================
// Error Handling
// ============================================

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Base Fetch with Retry
// ============================================

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP error ${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Wait before retrying
      if (attempt < retries - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

// ============================================
// Session API
// ============================================

/**
 * Start a new interview session
 * Returns session_id and first 3 questions
 */
export async function startSession(language: string = 'lt'): Promise<StartSessionResponse> {
  return fetchWithRetry<StartSessionResponse>(`${API_BASE_URL}/session/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ language }),
  });
}

/**
 * Transcribe audio to text using Whisper
 * Returns transcript for preview/confirmation
 */
export async function transcribeAudio(
  sessionId: string,
  audioBlob: Blob
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || 'Transcription failed',
      response.status,
      errorData
    );
  }

  return response.json();
}

/**
 * Submit confirmed answers for a round
 * Returns next questions or indicates completion
 */
export async function submitAnswers(
  sessionId: string,
  request: AnswerRequest
): Promise<AnswerResponse> {
  return fetchWithRetry<AnswerResponse>(
    `${API_BASE_URL}/session/${sessionId}/answer`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );
}

/**
 * Finalize the session and generate the report
 * Called after all 3 rounds are complete
 */
export async function finalizeSession(
  sessionId: string
): Promise<FinalizeResponse> {
  return fetchWithRetry<FinalizeResponse>(
    `${API_BASE_URL}/session/${sessionId}/finalize`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Get the current state of a session
 */
export async function getSessionState(sessionId: string): Promise<{
  session_id: string;
  round: number;
  state: {
    language: string;
    round: number;
    history: Array<{ role: string; question_id?: string; text: string; round: number }>;
    slots: Record<string, { value: unknown; confidence: number }>;
    unknown_slots: string[];
    risk_flags: Array<{ code: string; severity: string; note?: string; evidence: string[] }>;
    round_summary: string | null;
    asked_question_ids: string[];
    next_questions: Array<{ id: string; text: string; round_hint?: number }>;
  };
  final_report: string | null;
  created_at: string | null;
  completed_at: string | null;
}> {
  return fetchWithRetry(
    `${API_BASE_URL}/session/${sessionId}/state`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Get the final results for a completed session
 */
export async function getResults(sessionId: string): Promise<ResultsResponse> {
  return fetchWithRetry<ResultsResponse>(
    `${API_BASE_URL}/session/${sessionId}/results`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Download the markdown report as a file
 */
export async function downloadReport(sessionId: string): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/session/${sessionId}/download`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    throw new ApiError('Download failed', response.status);
  }

  return response.blob();
}

/**
 * Translate the report to target language
 */
export async function translateReport(
  sessionId: string,
  targetLanguage: string
): Promise<{ translated_markdown: string; target_language: string }> {
  return fetchWithRetry<{ translated_markdown: string; target_language: string }>(
    `${API_BASE_URL}/session/${sessionId}/translate?target_language=${targetLanguage}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// ============================================
// Health Check
// ============================================

export async function checkHealth(): Promise<HealthResponse> {
  return fetchWithRetry<HealthResponse>(`${API_BASE_URL}/health`, {
    method: 'GET',
  });
}

// ============================================
// Admin API (Brain Config)
// ============================================

const ADMIN_KEY_HEADER = 'X-Admin-Key';

function getAdminKey(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_key');
  }
  return null;
}

export function setAdminKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_key', key);
  }
}

export function clearAdminKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_key');
  }
}

/**
 * Export current brain config as YAML
 */
export async function exportBrainConfig(): Promise<BrainConfigExportResponse> {
  const adminKey = getAdminKey();
  if (!adminKey) {
    throw new ApiError('Admin key required', 401);
  }

  return fetchWithRetry<BrainConfigExportResponse>(
    `${API_BASE_URL}/brain/config/export`,
    {
      method: 'GET',
      headers: {
        [ADMIN_KEY_HEADER]: adminKey,
      },
    }
  );
}

/**
 * Validate YAML config without saving
 */
export async function validateBrainConfig(
  request: BrainConfigValidateRequest
): Promise<BrainConfigValidateResponse> {
  const adminKey = getAdminKey();
  if (!adminKey) {
    throw new ApiError('Admin key required', 401);
  }

  return fetchWithRetry<BrainConfigValidateResponse>(
    `${API_BASE_URL}/brain/config/validate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [ADMIN_KEY_HEADER]: adminKey,
      },
      body: JSON.stringify(request),
    }
  );
}

/**
 * Import YAML config to database
 */
export async function importBrainConfig(
  request: BrainConfigImportRequest
): Promise<BrainConfigImportResponse> {
  const adminKey = getAdminKey();
  if (!adminKey) {
    throw new ApiError('Admin key required', 401);
  }

  return fetchWithRetry<BrainConfigImportResponse>(
    `${API_BASE_URL}/brain/config/import`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [ADMIN_KEY_HEADER]: adminKey,
      },
      body: JSON.stringify(request),
    }
  );
}

// ============================================
// Utility: Validate Session ID
// ============================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(id: string): boolean {
  return UUID_REGEX.test(id);
}
