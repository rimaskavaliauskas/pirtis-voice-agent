'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AudioRecorderComponent } from '@/components/audio-recorder';
import { TranscriptPreview } from '@/components/transcript-preview';
import { QuestionCard } from '@/components/question-card';
import { RoundIndicator } from '@/components/round-indicator';
import { ProcessingOverlay } from '@/components/processing-overlay';
import { SessionSkeleton } from '@/components/session-skeleton';
import { transcribeAudio, submitAnswers, finalizeSession, isValidSessionId, getSessionState } from '@/lib/api';
import { toast } from 'sonner';
import type { Question, QuestionState, RecordingState, RiskFlag } from '@/lib/types';

// ============================================
// Types
// ============================================

type InterviewPhase =
  | 'loading'
  | 'active'
  | 'submitting'
  | 'finalizing'
  | 'error';

interface InterviewState {
  phase: InterviewPhase;
  currentRound: number;
  questions: QuestionState[];
  activeQuestionIndex: number;
  roundSummary: string | null;
  riskFlags: RiskFlag[];
  error: string | null;
}

// ============================================
// Initial State
// ============================================

function createInitialQuestionStates(questions: Question[]): QuestionState[] {
  return questions.map((q) => ({
    question: q,
    recordingState: 'idle' as RecordingState,
    audioBlob: null,
    transcript: null,
    isConfirmed: false,
  }));
}

// ============================================
// Component
// ============================================

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [state, setState] = useState<InterviewState>({
    phase: 'loading',
    currentRound: 1,
    questions: [],
    activeQuestionIndex: 0,
    roundSummary: null,
    riskFlags: [],
    error: null,
  });

  // Fetch session state from backend
  useEffect(() => {
    if (!isValidSessionId(sessionId)) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: 'Invalid session ID',
      }));
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await getSessionState(sessionId);

        // Check if session is already complete
        if (response.completed_at) {
          // Redirect to results
          router.push(`/results/${sessionId}`);
          return;
        }

        // Get questions from session state
        const questions: Question[] = response.state.next_questions.map((q) => ({
          id: q.id,
          text: q.text,
        }));

        if (questions.length === 0) {
          setState((s) => ({
            ...s,
            phase: 'error',
            error: 'No questions available',
          }));
          return;
        }

        setState((s) => ({
          ...s,
          phase: 'active',
          currentRound: response.state.round,
          questions: createInitialQuestionStates(questions),
          roundSummary: response.state.round_summary,
          riskFlags: response.state.risk_flags.map((rf) => ({
            code: rf.code,
            severity: rf.severity as 'low' | 'medium' | 'high',
            note: rf.note || '',
            evidence: rf.evidence,
          })),
        }));
      } catch (error) {
        console.error('Failed to fetch session:', error);
        setState((s) => ({
          ...s,
          phase: 'error',
          error: 'Failed to load session. Please try again.',
        }));
      }
    };

    fetchSession();
  }, [sessionId, router]);

  // Get current question
  const currentQuestion = state.questions[state.activeQuestionIndex];
  const allConfirmed = state.questions.every((q) => q.isConfirmed);
  const confirmedCount = state.questions.filter((q) => q.isConfirmed).length;

  // Handle recording complete
  const handleRecordingComplete = useCallback(
    async (blob: Blob) => {
      const index = state.activeQuestionIndex;

      // Update state to processing
      setState((s) => ({
        ...s,
        questions: s.questions.map((q, i) =>
          i === index ? { ...q, recordingState: 'processing', audioBlob: blob } : q
        ),
      }));

      try {
        // Transcribe audio
        const response = await transcribeAudio(sessionId, blob);

        setState((s) => ({
          ...s,
          questions: s.questions.map((q, i) =>
            i === index
              ? { ...q, recordingState: 'done', transcript: response.transcript }
              : q
          ),
        }));
      } catch (error) {
        console.error('Transcription failed:', error);
        toast.error('Failed to transcribe audio. Please try again.');

        setState((s) => ({
          ...s,
          questions: s.questions.map((q, i) =>
            i === index ? { ...q, recordingState: 'idle', audioBlob: null } : q
          ),
        }));
      }
    },
    [state.activeQuestionIndex, sessionId]
  );

  // Handle transcript confirm
  const handleConfirmTranscript = useCallback(
    (editedTranscript: string) => {
      const index = state.activeQuestionIndex;

      setState((s) => {
        const newQuestions = s.questions.map((q, i) =>
          i === index ? { ...q, transcript: editedTranscript, isConfirmed: true } : q
        );

        // Move to next unanswered question
        const nextIndex = newQuestions.findIndex((q) => !q.isConfirmed);

        return {
          ...s,
          questions: newQuestions,
          activeQuestionIndex: nextIndex >= 0 ? nextIndex : index,
        };
      });

      toast.success('Answer confirmed!');
    },
    [state.activeQuestionIndex]
  );

  // Handle retry recording
  const handleRetryRecording = useCallback(() => {
    const index = state.activeQuestionIndex;

    setState((s) => ({
      ...s,
      questions: s.questions.map((q, i) =>
        i === index
          ? { ...q, recordingState: 'idle', audioBlob: null, transcript: null }
          : q
      ),
    }));
  }, [state.activeQuestionIndex]);

  // Handle submit round
  const handleSubmitRound = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'submitting' }));

    try {
      const answersRequest = {
        transcripts: state.questions.map((q) => ({
          question_id: q.question.id,
          text: q.transcript || '',
        })),
      };

      const response = await submitAnswers(sessionId, answersRequest);

      if (response.is_complete) {
        // All rounds done, finalize
        setState((s) => ({ ...s, phase: 'finalizing' }));

        await finalizeSession(sessionId);

        // Redirect to results
        router.push(`/results/${sessionId}`);
      } else {
        // Move to next round
        setState((s) => ({
          ...s,
          phase: 'active',
          currentRound: response.round,
          questions: createInitialQuestionStates(response.next_questions),
          activeQuestionIndex: 0,
          roundSummary: response.round_summary,
          riskFlags: response.risk_flags,
        }));

        toast.success(`Round ${response.round - 1} complete! Starting Round ${response.round}`);
      }
    } catch (error) {
      console.error('Submit failed:', error);
      toast.error('Failed to submit answers. Please try again.');
      setState((s) => ({ ...s, phase: 'active' }));
    }
  }, [sessionId, state.questions, router]);

  // Handle question click
  const handleQuestionClick = useCallback((index: number) => {
    setState((s) => ({ ...s, activeQuestionIndex: index }));
  }, []);

  // Render loading state with skeleton
  if (state.phase === 'loading') {
    return <SessionSkeleton />;
  }

  // Render error state
  if (state.phase === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ErrorIcon className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Error</h2>
            <p className="text-muted-foreground">{state.error}</p>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Show full-screen overlay for submitting/finalizing phases
  if (state.phase === 'submitting' || state.phase === 'finalizing') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <ProcessingOverlay
          type={state.phase === 'finalizing' ? 'report' : 'analysis'}
          className="max-w-md w-full"
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Pirtis Design Interview</h1>
          <RoundIndicator
            currentRound={state.currentRound}
            questionsAnswered={confirmedCount}
          />
        </div>

        {/* Round Summary (if available) */}
        {state.roundSummary && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="text-sm">
                <span className="font-medium">Previous round summary: </span>
                {state.roundSummary}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Questions Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {state.questions.map((q, index) => (
            <div
              key={q.question.id}
              onClick={() => handleQuestionClick(index)}
              className="cursor-pointer"
            >
              <QuestionCard
                questionNumber={index + 1}
                questionText={q.question.text}
                status={q.isConfirmed ? 'confirmed' : q.recordingState}
                isActive={index === state.activeQuestionIndex}
              />
            </div>
          ))}
        </div>

        {/* Active Question Area */}
        {currentQuestion && !currentQuestion.isConfirmed && (
          <Card className="p-6">
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">
                  Question {state.activeQuestionIndex + 1}
                </p>
                <p className="text-muted-foreground">
                  {currentQuestion.question.text}
                </p>
              </div>

              {/* Recording or Transcript */}
              {currentQuestion.recordingState === 'idle' && (
                <AudioRecorderComponent
                  onRecordingComplete={handleRecordingComplete}
                  className="mx-auto max-w-sm"
                />
              )}

              {currentQuestion.recordingState === 'processing' && (
                <ProcessingOverlay
                  type="transcription"
                  className="mx-auto max-w-md"
                />
              )}

              {currentQuestion.recordingState === 'done' && currentQuestion.transcript && (
                <TranscriptPreview
                  transcript={currentQuestion.transcript}
                  questionText={currentQuestion.question.text}
                  onConfirm={handleConfirmTranscript}
                  onRetry={handleRetryRecording}
                  className="mx-auto max-w-lg"
                />
              )}
            </div>
          </Card>
        )}

        {/* Submit Button */}
        {allConfirmed && (
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleSubmitRound}
              className="px-8"
            >
              {state.currentRound === 3 ? 'Finish Interview' : `Submit Round ${state.currentRound}`}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================
// Icons
// ============================================

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
