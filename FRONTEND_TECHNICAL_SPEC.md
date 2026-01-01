# Pirtis Voice Agent - Frontend Technical Specification

> **Purpose**: Complete technical documentation for AI agents to work on this frontend without breaking functionality.
>
> **Last Updated**: 2024
>
> **Framework**: Next.js 16.1.1 (App Router) + React 19 + Tailwind CSS 4

---

## 1. Overview

### 1.1 Application Purpose
AI-powered voice interview system for personalized sauna (pirtis) design recommendations. Users complete a 3-round voice interview, and receive a personalized report.

### 1.2 Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.1 | React framework with App Router |
| React | 19.2.3 | UI library |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | - | Component library (Radix primitives) |
| Sonner | 2.0.7 | Toast notifications |
| TypeScript | 5.x | Type safety |

### 1.3 Backend API
- **URL**: `http://65.108.246.252:8000` (production)
- **Local fallback**: `http://localhost:8000`
- **Set via**: `NEXT_PUBLIC_API_URL` environment variable

---

## 2. API Contract

### 2.1 Configuration

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
```

### 2.2 Error Handling

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

**Retry Logic**: Exponential backoff, retries on 5xx errors, NO retry on 4xx (client errors).

---

### 2.3 Endpoint: `startSession`

| Property | Value |
|----------|-------|
| **Function** | `startSession(language: string): Promise<StartSessionResponse>` |
| **HTTP Method** | POST |
| **URL** | `/session/start` |
| **Content-Type** | `application/json` |

**Request Body**:
```json
{
  "language": "lt" | "en" | "ru"
}
```

**Response Body** (`StartSessionResponse`):
```typescript
{
  session_id: string;      // UUID
  round: number;           // Always 1
  questions: Question[];   // Array of 3 questions
}

interface Question {
  id: string;   // e.g., "Q_R1_PURPOSE"
  text: string; // Question text in selected language
}
```

**Used By**: `app/page.tsx` (Landing page)

---

### 2.4 Endpoint: `transcribeAudio`

| Property | Value |
|----------|-------|
| **Function** | `transcribeAudio(sessionId: string, audioBlob: Blob): Promise<TranscribeResponse>` |
| **HTTP Method** | POST |
| **URL** | `/session/{sessionId}/transcribe` |
| **Content-Type** | `multipart/form-data` |

**Request Body**:
```
FormData:
  - audio: Blob (filename: "recording.webm")
```

**Response Body** (`TranscribeResponse`):
```typescript
{
  transcript: string;  // Transcribed text from Whisper STT
}
```

**WARNING**: No retry logic on this endpoint (uses raw fetch, not fetchWithRetry).

**Used By**: `app/session/[id]/page.tsx`

---

### 2.5 Endpoint: `submitAnswers`

| Property | Value |
|----------|-------|
| **Function** | `submitAnswers(sessionId: string, request: AnswerRequest): Promise<AnswerResponse>` |
| **HTTP Method** | POST |
| **URL** | `/session/{sessionId}/answer` |
| **Content-Type** | `application/json` |

**Request Body** (`AnswerRequest`):
```typescript
{
  transcripts: ConfirmedAnswer[];
}

interface ConfirmedAnswer {
  question_id: string;  // Must match question.id from API
  text: string;         // Confirmed/edited transcript
}
```

**Response Body** (`AnswerResponse`):
```typescript
{
  session_id: string;
  round: number;              // Next round number (2, 3, or same if complete)
  slots_updated: string[];    // Which slots were extracted
  next_questions: Question[]; // Next 3 questions (empty if complete)
  round_summary: string | null;
  is_complete: boolean;       // true after round 3
  risk_flags: RiskFlag[];
}

interface RiskFlag {
  code: string;
  severity: 'low' | 'medium' | 'high';
  note: string;
  evidence: string[];
}
```

**Used By**: `app/session/[id]/page.tsx`

---

### 2.6 Endpoint: `finalizeSession`

| Property | Value |
|----------|-------|
| **Function** | `finalizeSession(sessionId: string): Promise<FinalizeResponse>` |
| **HTTP Method** | POST |
| **URL** | `/session/{sessionId}/finalize` |
| **Content-Type** | `application/json` |

**Response Body** (`FinalizeResponse`):
```typescript
{
  session_id: string;
  final_markdown: string;           // Full report in markdown
  slots: Record<string, Slot>;      // All extracted slot values
  risk_flags: RiskFlag[];
}

interface Slot {
  value: string | number | boolean | Record<string, unknown> | null;
  confidence: number;  // 0.0 - 1.0
}
```

**Used By**: `app/session/[id]/page.tsx` (after round 3 complete)

---

### 2.7 Endpoint: `getSessionState`

| Property | Value |
|----------|-------|
| **Function** | `getSessionState(sessionId: string): Promise<SessionStateResponse>` |
| **HTTP Method** | GET |
| **URL** | `/session/{sessionId}/state` |

**Response Body**:
```typescript
{
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
  completed_at: string | null;  // If set, session is complete
}
```

**Used By**: `app/session/[id]/page.tsx` (initial load)

---

### 2.8 Endpoint: `getResults`

| Property | Value |
|----------|-------|
| **Function** | `getResults(sessionId: string): Promise<ResultsResponse>` |
| **HTTP Method** | GET |
| **URL** | `/session/{sessionId}/results` |

**Response Body** (`ResultsResponse`):
```typescript
{
  session_id: string;
  final_markdown: string;
  slots: Record<string, Slot>;
  risk_flags: RiskFlag[];
  completed_at: string | null;
}
```

**Used By**: `app/results/[id]/page.tsx`

---

### 2.9 Endpoint: `downloadReport`

| Property | Value |
|----------|-------|
| **Function** | `downloadReport(sessionId: string): Promise<Blob>` |
| **HTTP Method** | GET |
| **URL** | `/session/{sessionId}/download` |

**Response**: Raw Blob (text/markdown)

**Used By**: `app/results/[id]/page.tsx`

---

### 2.10 Endpoint: `translateReport`

| Property | Value |
|----------|-------|
| **Function** | `translateReport(sessionId: string, targetLanguage: string): Promise<TranslateResponse>` |
| **HTTP Method** | POST |
| **URL** | `/session/{sessionId}/translate?target_language={lang}` |

**Response Body**:
```typescript
{
  translated_markdown: string;
  target_language: string;
}
```

**Used By**: `app/results/[id]/page.tsx`

---

### 2.11 Admin Endpoints

All admin endpoints require `X-Admin-Key` header (stored in localStorage as `admin_key`).

| Endpoint | Method | URL | Purpose |
|----------|--------|-----|---------|
| `exportBrainConfig` | GET | `/brain/config/export` | Returns `{ yaml: string }` |
| `validateBrainConfig` | POST | `/brain/config/validate` | Body: `{ yaml: string }`, Returns: `{ valid: boolean, errors?: string[] }` |
| `importBrainConfig` | POST | `/brain/config/import` | Body: `{ yaml: string }`, Returns: `{ success: boolean, message: string }` |

**Used By**: `app/admin/page.tsx`

---

### 2.12 Utility: Session ID Validation

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidSessionId(id: string): boolean {
  return UUID_REGEX.test(id);
}
```

**Used By**: All session-related pages

---

## 3. Type Definitions

### 3.1 Core Types (`lib/types.ts`)

```typescript
// Question from API
interface Question {
  id: string;    // e.g., "Q_R1_PURPOSE"
  text: string;  // Localized question text
}

// Question-Answer pair for submission
interface QA {
  question_id: string;
  question_text: string;
  transcript: string;
  round_number: number;
}

// Slot value with confidence
interface Slot {
  value: string | number | boolean | Record<string, unknown> | null;
  confidence: number;  // 0.0 to 1.0
}

// Risk detected in answers
interface RiskFlag {
  code: string;                        // e.g., "RISK_SOFT_STEAM_CONFLICT"
  severity: 'low' | 'medium' | 'high';
  note: string;
  evidence: string[];
}
```

### 3.2 UI State Types

```typescript
// Recording button states
type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

// Per-question UI state
interface QuestionState {
  question: Question;
  recordingState: RecordingState;
  audioBlob: Blob | null;
  transcript: string | null;
  isConfirmed: boolean;
}

// Interview phases (session page)
type InterviewPhase =
  | 'loading'
  | 'round_active'
  | 'round_submitting'
  | 'finalizing'
  | 'complete'
  | 'error';
```

---

## 4. State Management

### 4.1 Landing Page (`app/page.tsx`)

| State | Type | Initial | Updated By | Used For |
|-------|------|---------|------------|----------|
| `isLoading` | `boolean` | `false` | Button click | Disable button during API call |
| `selectedLanguage` | `string` | `'lt'` | Language button click | Pass to `startSession()` |

**Persistence**: `selectedLanguage` is NOT persisted (localStorage is used elsewhere for `pirtis-language`).

---

### 4.2 Session Page (`app/session/[id]/page.tsx`)

| State | Type | Initial | Updated By | Used For |
|-------|------|---------|------------|----------|
| `phase` | `InterviewPhase` | `'loading'` | API responses, errors | Render different UI states |
| `currentRound` | `number` | `1` | `submitAnswers` response | Display round indicator |
| `questions` | `QuestionState[]` | `[]` | API response | Render question cards |
| `activeQuestionIndex` | `number` | `0` | User clicks, auto-advance | Highlight active question |
| `roundSummary` | `string \| null` | `null` | API response | Show previous round summary |
| `riskFlags` | `RiskFlag[]` | `[]` | API response | Display detected risks |
| `error` | `string \| null` | `null` | Errors | Show error message |

**Key Derived Values**:
```typescript
const currentQuestion = state.questions[state.activeQuestionIndex];
const allConfirmed = state.questions.every((q) => q.isConfirmed);
const confirmedCount = state.questions.filter((q) => q.isConfirmed).length;
```

---

### 4.3 Results Page (`app/results/[id]/page.tsx`)

| State | Type | Initial | Updated By | Used For |
|-------|------|---------|------------|----------|
| `state` | `'loading' \| 'ready' \| 'error'` | `'loading'` | API response | Page loading state |
| `markdown` | `string` | `''` | `getResults` response | Display report |
| `error` | `string \| null` | `null` | Errors | Error message |
| `translatedMarkdown` | `string \| null` | `null` | `translateReport` response | Translated report |
| `translationLanguage` | `string` | `'en'` | Button click | Target language |
| `isTranslating` | `boolean` | `false` | During API call | Loading indicator |
| `showTranslation` | `boolean` | `false` | Toggle button | Which version to display |

---

### 4.4 Admin Page (`app/admin/page.tsx`)

| State | Type | Initial | Updated By |
|-------|------|---------|------------|
| `authState` | `'not_authenticated' \| 'authenticated' \| 'loading'` | `'loading'` | localStorage check, login |
| `adminKeyInput` | `string` | `''` | User input |
| `showAuthDialog` | `boolean` | `false` | Auth state |
| `yamlContent` | `string` | `''` | Export/user edit |
| `isLoading` | `boolean` | `false` | During API calls |
| `validationErrors` | `string[]` | `[]` | Validate response |

---

## 5. Component Architecture

### 5.1 Component Tree

```
app/layout.tsx
├── Toaster (sonner)
└── {children}

app/page.tsx (Landing)
├── SaunaIcon
├── Card (shadcn)
│   └── StepCard (×3)
├── Language buttons
└── Button (Start Interview)

app/session/[id]/page.tsx
├── SessionSkeleton (loading)
├── Card + ErrorIcon (error)
├── ProcessingOverlay (submitting/finalizing)
└── Main interview UI:
    ├── RoundIndicator
    │   └── Progress (shadcn)
    ├── QuestionCard (×3)
    │   └── StatusBadge
    └── Card (active question area)
        ├── AudioRecorderComponent
        ├── ProcessingOverlay (transcription)
        └── TranscriptPreview
            └── Textarea (shadcn)

app/results/[id]/page.tsx
├── LoadingSpinner
├── Card (error)
├── Translation controls
└── ReportPreview
    ├── Copy/Download buttons
    └── Markdown renderer

app/admin/page.tsx
├── Dialog (auth)
├── Action buttons
├── Validation errors Card
├── YAML Textarea
└── Help Card
```

### 5.2 Component Props Interfaces

#### AudioRecorderComponent
```typescript
interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;  // REQUIRED - called with audio blob
  onRecordingStart?: () => void;
  disabled?: boolean;
  maxDuration?: number;  // seconds, default 120
  className?: string;
}
```

#### QuestionCard
```typescript
interface QuestionCardProps {
  questionNumber: number;           // 1, 2, or 3
  questionText: string;             // From question.text
  status: RecordingState | 'confirmed';
  isActive?: boolean;               // Highlight border
  className?: string;
}
```

#### RoundIndicator
```typescript
interface RoundIndicatorProps {
  currentRound: number;
  totalRounds?: number;       // default 3
  questionsAnswered?: number; // default 0
  totalQuestions?: number;    // default 3
  className?: string;
}
```

#### TranscriptPreview
```typescript
interface TranscriptPreviewProps {
  transcript: string;
  questionText: string;
  onConfirm: (editedTranscript: string) => void;  // REQUIRED
  onRetry?: () => void;
  isLoading?: boolean;
  className?: string;
}
```

#### ReportPreview
```typescript
interface ReportPreviewProps {
  markdown: string;
  sessionId: string;
  onDownload?: () => void;
  onStartNew?: () => void;
  className?: string;
}
```

#### ProcessingOverlay
```typescript
interface ProcessingOverlayProps {
  type: 'transcription' | 'analysis' | 'report';
  isComplete?: boolean;
  language?: 'lt' | 'en' | 'ru';
  className?: string;
}
```

---

## 6. Audio Recording System

### 6.1 Browser API Requirements
- `navigator.mediaDevices.getUserMedia`
- `MediaRecorder` API
- `AudioContext` (for level meter)

### 6.2 Audio Configuration

```typescript
// Microphone settings
const micConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

// MIME type priority (first supported is used)
const mimeTypes = [
  'audio/webm;codecs=opus',  // Preferred
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

// Data collection interval
mediaRecorder.start(1000);  // Collect chunk every 1 second
```

### 6.3 Recording Flow

```
1. User clicks record button
   └─> startRecording()
       ├─> new AudioRecorderUtil()
       ├─> recorder.initialize()
       │   └─> getUserMedia() → MediaRecorder setup
       ├─> recorder.start()
       └─> Start duration timer (1s interval)

2. User clicks stop button (or max duration reached)
   └─> stopRecording()
       ├─> recorder.stop() → Returns Promise<Blob>
       ├─> Clear timer
       ├─> Call onRecordingComplete(blob)
       └─> Create audio URL for playback preview

3. Audio sent to backend
   └─> transcribeAudio(sessionId, blob)
       ├─> Create FormData
       ├─> Append blob as 'audio' with filename 'recording.webm'
       └─> POST to /session/{id}/transcribe

4. User can:
   ├─> Play audio preview
   ├─> Edit transcript in Textarea
   ├─> Re-record (resets to step 1)
   └─> Confirm (saves editedTranscript, marks isConfirmed=true)
```

### 6.4 Error States

| Error | Detection | User Message |
|-------|-----------|--------------|
| No microphone permission | `getUserMedia` throws | "Failed to access microphone. Please check permissions." |
| MediaRecorder not supported | `isAudioRecordingSupported()` returns false | "Audio recording is not supported in this browser." |
| Transcription failed | API error | Toast: "Failed to transcribe audio. Please try again." |

### 6.5 Audio Utilities (`lib/audio-utils.ts`)

```typescript
// Format seconds to MM:SS
formatDuration(seconds: number): string

// Create playback URL
createAudioUrl(blob: Blob): string

// Free memory
revokeAudioUrl(url: string): void

// Human-readable size
formatBlobSize(blob: Blob): string

// Check browser support
isAudioRecordingSupported(): boolean

// Check permission status
checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'>

// Get audio duration from blob
getAudioDuration(blob: Blob): Promise<number>
```

---

## 7. Session Lifecycle

### 7.1 Landing Page (`/`)

```
1. User lands on page
   ├─> Language default: 'lt'
   └─> No API calls

2. User selects language (optional)
   └─> setSelectedLanguage(code)

3. User clicks "Start Interview"
   ├─> setIsLoading(true)
   ├─> startSession(selectedLanguage)
   │   └─> POST /session/start
   │       └─> Returns { session_id, round: 1, questions: [...] }
   ├─> On success: router.push(`/session/${session_id}`)
   └─> On error: toast.error(), setIsLoading(false)
```

### 7.2 Session Page (`/session/[id]`)

```
1. Initial Load
   ├─> Validate session ID (UUID regex)
   │   └─> Invalid: Show error, "Go Home" button
   ├─> getSessionState(sessionId)
   │   └─> If completed_at set: router.push(`/results/${id}`)
   └─> Initialize state with questions from response

2. Per-Question Flow (×3 per round)
   ├─> User clicks on question card (or auto-selects first unanswered)
   ├─> User clicks record button
   │   └─> AudioRecorderComponent handles recording
   ├─> User stops recording
   │   └─> handleRecordingComplete(blob)
   │       ├─> Set recordingState: 'processing'
   │       ├─> transcribeAudio(sessionId, blob)
   │       └─> Set recordingState: 'done', transcript: response.transcript
   ├─> User reviews/edits transcript in TranscriptPreview
   └─> User clicks "Confirm"
       └─> handleConfirmTranscript(editedTranscript)
           ├─> Mark question isConfirmed: true
           └─> Auto-advance to next unanswered question

3. Submit Round (when all 3 confirmed)
   ├─> "Submit Round X" button appears
   ├─> User clicks button
   │   └─> handleSubmitRound()
   │       ├─> Set phase: 'submitting'
   │       ├─> Show ProcessingOverlay (type: 'analysis')
   │       └─> submitAnswers(sessionId, { transcripts: [...] })
   ├─> Response handling:
   │   ├─> is_complete: false
   │   │   ├─> Set currentRound: response.round
   │   │   ├─> Replace questions with response.next_questions
   │   │   ├─> Reset activeQuestionIndex: 0
   │   │   └─> Toast: "Round X complete!"
   │   └─> is_complete: true
   │       ├─> Set phase: 'finalizing'
   │       ├─> Show ProcessingOverlay (type: 'report')
   │       ├─> finalizeSession(sessionId)
   │       └─> router.push(`/results/${id}`)
   └─> On error: toast.error(), set phase: 'active'

4. Round Loop (rounds 1, 2, 3)
   └─> Repeat step 2-3 for each round
```

### 7.3 Results Page (`/results/[id]`)

```
1. Initial Load
   ├─> Validate session ID
   ├─> getResults(sessionId)
   │   └─> Returns { final_markdown, slots, risk_flags }
   └─> Set markdown, state: 'ready'

2. View Report
   └─> ReportPreview renders markdown

3. Translation (optional)
   ├─> User selects language (EN/RU buttons)
   ├─> User clicks "Show Translation"
   │   └─> translateReport(sessionId, language)
   │       └─> Returns { translated_markdown }
   └─> Toggle between original and translated

4. Download
   ├─> User clicks "Download" (original or translated)
   │   ├─> Try downloadReport(sessionId) for original
   │   └─> Create Blob from markdown for translated
   └─> Trigger browser download

5. Start New
   └─> User clicks "Start New Interview"
       └─> router.push('/')
```

---

## 8. Environment Configuration

### 8.1 Environment Variables

| Variable | Required | Default | Purpose | Used In |
|----------|----------|---------|---------|---------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Backend API base URL | `lib/api.ts` |

### 8.2 Local Development (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 8.3 Production (Vercel)

```bash
NEXT_PUBLIC_API_URL=http://65.108.246.252:8000
```

---

## 9. Dependencies

### 9.1 Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.1 | React framework |
| `react` | 19.2.3 | UI library |
| `react-dom` | 19.2.3 | React DOM |
| `@radix-ui/react-dialog` | ^1.1.15 | Dialog component primitive |
| `@radix-ui/react-progress` | ^1.1.8 | Progress bar primitive |
| `@radix-ui/react-slot` | ^1.2.4 | Slot component for composition |
| `class-variance-authority` | ^0.7.1 | Variant styling utility |
| `clsx` | ^2.1.1 | Conditional class names |
| `tailwind-merge` | ^3.4.0 | Merge Tailwind classes |
| `sonner` | ^2.0.7 | Toast notifications |
| `lucide-react` | ^0.562.0 | Icon library (available but inline SVGs used) |
| `next-themes` | ^0.4.6 | Theme switching (dark mode) |
| `uuid` | ^13.0.0 | UUID utilities |

### 9.2 Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | Type checking |
| `tailwindcss` | ^4 | CSS framework |
| `@tailwindcss/postcss` | ^4 | PostCSS integration |
| `tw-animate-css` | ^1.4.0 | Animation utilities |
| `jest` | ^30.2.0 | Testing framework |
| `@testing-library/react` | ^16.3.1 | React testing |
| `@testing-library/dom` | ^10.4.1 | DOM testing |
| `@testing-library/jest-dom` | ^6.9.1 | Jest matchers |
| `jest-environment-jsdom` | ^30.2.0 | Browser environment |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.1.1 | Next.js ESLint config |

---

## 10. Styling System

### 10.1 Tailwind Configuration

The app uses **Tailwind CSS v4** with the new CSS-first configuration.

**Custom Theme Tokens** (defined in `globals.css`):
- Colors use OKLCH color space
- Design tokens: `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`
- Radius tokens: `--radius` (0.625rem base)
- Font variables: `--font-geist-sans`, `--font-geist-mono`

### 10.2 Dark Mode

Enabled via CSS class `.dark` on parent element:
```css
@custom-variant dark (&:is(.dark *));
```

### 10.3 Custom Animations

```css
/* Steam animation for loading overlays */
@keyframes steam-rise {
  0% { transform: translateY(0) scale(0.8); opacity: 0; }
  15% { opacity: 0.6; }
  50% { opacity: 0.4; transform: translateY(-100px) scale(1.2); }
  100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
}

.steam-particle {
  animation: steam-rise 5s ease-out infinite;
}
```

### 10.4 shadcn/ui Components Used

| Component | File | Customizations |
|-----------|------|----------------|
| Button | `components/ui/button.tsx` | Variants: default, destructive, outline, secondary, ghost, link |
| Card | `components/ui/card.tsx` | CardHeader, CardContent, CardFooter, CardTitle, CardDescription |
| Dialog | `components/ui/dialog.tsx` | For admin auth |
| Progress | `components/ui/progress.tsx` | Round indicator |
| Textarea | `components/ui/textarea.tsx` | Transcript editing |
| Toaster (Sonner) | `components/ui/sonner.tsx` | Toast notifications |

### 10.5 Utility Function

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 11. Error Handling

### 11.1 API Error Handling

```typescript
// All API calls wrapped in try/catch
try {
  const response = await apiFunction();
  // Handle success
} catch (error) {
  console.error('Operation failed:', error);
  toast.error('User-friendly message');
  // Update UI state
}
```

### 11.2 Error States by Page

| Page | Error Type | Display |
|------|------------|---------|
| Landing | Session start failed | Toast error |
| Session | Invalid session ID | Full-page error card + "Go Home" button |
| Session | Session load failed | Full-page error card |
| Session | Transcription failed | Toast error, reset recording state |
| Session | Submit failed | Toast error, return to active state |
| Results | Invalid session ID | Full-page error card |
| Results | Results load failed | Full-page error card |
| Results | Translation failed | Toast error |
| Admin | Auth failed | Toast error |
| Admin | Export/Import failed | Toast with fallback behavior |

### 11.3 Audio Permission Errors

```typescript
// In AudioRecorderComponent
if (!initialized) {
  setError('Failed to access microphone. Please check permissions.');
  setState('idle');
  return;
}
```

### 11.4 Network Timeout

Handled by retry logic in `fetchWithRetry`:
- 3 retries max
- Exponential backoff (1s, 2s, 4s)
- Only retries on 5xx errors

---

## 12. Routing

### 12.1 Route Structure

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `app/page.tsx` | Landing page, language selection |
| `/session/[id]` | `app/session/[id]/page.tsx` | Interview session (dynamic) |
| `/results/[id]` | `app/results/[id]/page.tsx` | Final report (dynamic) |
| `/admin` | `app/admin/page.tsx` | Brain config management |

### 12.2 Navigation Flows

```
/ ──────────────────────┬──> /session/{id} ──> /results/{id}
                        │         ↑                  │
                        │         └── (if complete)──┘
                        │
                        └──> /admin
```

### 12.3 URL Parameters

| Route | Param | Validation |
|-------|-------|------------|
| `/session/[id]` | `id` | UUID format via `isValidSessionId()` |
| `/results/[id]` | `id` | UUID format via `isValidSessionId()` |

### 12.4 Redirects

```typescript
// Session page: redirect to results if session complete
if (response.completed_at) {
  router.push(`/results/${sessionId}`);
  return;
}

// After final round: redirect to results
if (response.is_complete) {
  await finalizeSession(sessionId);
  router.push(`/results/${sessionId}`);
}
```

---

## 13. Browser Compatibility

### 13.1 Required APIs

| API | Purpose | Fallback |
|-----|---------|----------|
| `MediaRecorder` | Audio recording | Show "not supported" message |
| `getUserMedia` | Microphone access | Show permission error |
| `AudioContext` | Audio level meter | Level meter won't work |
| `fetch` | API calls | Required, no fallback |
| `localStorage` | Admin key, language preference | Features may not persist |
| `Blob` | Audio handling | Required |
| `URL.createObjectURL` | Audio playback | Required |

### 13.2 Support Check

```typescript
function isAudioRecordingSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  );
}
```

### 13.3 Mobile Considerations

- Audio recording works on mobile browsers (Chrome, Safari)
- iOS Safari requires user gesture to start recording
- Responsive design handles mobile viewports
- Touch events work with all interactive elements

---

## 14. Critical Warnings for Future Development

### 14.1 DO NOT MODIFY

| File | Reason |
|------|--------|
| `lib/api.ts` | All API integration. Changes break backend communication. |
| `lib/types.ts` | Type definitions match backend exactly. |
| `lib/audio-utils.ts` | Core audio functionality for recording. |

### 14.2 MUST PRESERVE

```typescript
// API function signatures - exact parameter types and return types
startSession(language: string): Promise<StartSessionResponse>
transcribeAudio(sessionId: string, audioBlob: Blob): Promise<TranscribeResponse>
submitAnswers(sessionId: string, request: AnswerRequest): Promise<AnswerResponse>
// ... etc.

// Import statements in pages
import { startSession, submitAnswers, ... } from '@/lib/api';
import type { Question, QuestionState, ... } from '@/lib/types';

// Props that come from API data
question.id    // from Question interface
question.text  // from Question interface
```

### 14.3 STATE DEPENDENCIES

```typescript
// These states hold API response data - don't change their types
const [questions, setQuestions] = useState<QuestionState[]>([]);
const [markdown, setMarkdown] = useState<string>('');
const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
```

### 14.4 USEEFFECT PATTERNS

```typescript
// Don't modify useEffect dependencies that trigger API calls
useEffect(() => {
  fetchSession();
}, [sessionId, router]);  // These dependencies are critical
```

### 14.5 CALLBACK PATTERNS

```typescript
// Callbacks must pass correct data to parent components
const handleRecordingComplete = useCallback(async (blob: Blob) => {
  // blob MUST be passed to transcribeAudio exactly as received
  const response = await transcribeAudio(sessionId, blob);
  // ...
}, [sessionId]);
```

---

## 15. Testing

### 15.1 Test Setup

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
npm run test:coverage # With coverage
```

### 15.2 Existing Tests

- `__tests__/components/question-card.test.tsx`
- `__tests__/components/round-indicator.test.tsx`
- `__tests__/lib/api.test.ts`

### 15.3 Testing After Changes

Always run:
```bash
npm run build  # TypeScript compilation
npm test       # Unit tests
```

---

## 16. Verification Checklist

Before completing work, verify:

- [ ] `npm run build` passes without errors
- [ ] No TypeScript errors
- [ ] Landing page loads and language selection works
- [ ] Can start a new session (creates session, navigates to /session/[id])
- [ ] Recording works (start, stop, audio captured)
- [ ] Transcription returns and displays
- [ ] Can edit transcript and confirm
- [ ] Submit round advances to next questions
- [ ] After round 3, navigates to results
- [ ] Results page displays report
- [ ] Translation buttons work
- [ ] Download works
- [ ] Admin page auth and YAML editing work
- [ ] Mobile responsive at 375px width
- [ ] No console errors in browser

---

*End of Technical Specification*
