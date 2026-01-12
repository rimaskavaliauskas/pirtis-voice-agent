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
import { InterviewProgress } from '@/components/interview-progress';
import { ContactForm } from '@/components/contact-form';
import { PreciseModeFlow } from '@/components/precise-mode-flow';
import { transcribeAudio, submitAnswers, finalizeSession, isValidSessionId, getSessionState, translateText } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/translations';
import { useUI } from '@/components/ui-provider';
import type { Question, QuestionState, RecordingState, RiskFlag, InterviewMode, SlotStatus, ContactInfo } from '@/lib/types';

// ============================================
// Types
// ============================================

type InterviewPhase =
  | 'loading'
  | 'active'
  | 'submitting'
  | 'collecting_contact'
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
  interviewMode: InterviewMode;
  slotStatus: SlotStatus[];
  progressPercent: number;
}

// Cache for translated texts
const translationCache = new Map<string, string>();

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
  const { t, language } = useTranslation();
  const { setSaunaPhase, setSaunaVisible } = useUI();

  // State for translated question texts (key: original text, value: translated)
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const [state, setState] = useState<InterviewState>({
    phase: 'loading',
    currentRound: 1,
    questions: [],
    activeQuestionIndex: 0,
    roundSummary: null,
    riskFlags: [],
    error: null,
    interviewMode: 'quick',
    slotStatus: [],
    progressPercent: 0,
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
          interviewMode: (response.interview_mode as InterviewMode) || 'quick',
          slotStatus: response.slot_status || [],
          progressPercent: response.progress_percent || 0,
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
    setSaunaPhase('active');
    setSaunaVisible(true);
  }, [sessionId, router, setSaunaPhase, setSaunaVisible]);

  // Translate questions when language changes or questions load
  useEffect(() => {
    // Clear translations immediately when content changes (prevents showing old/wrong text)
    if (language !== 'lt') {
      setTranslatedTexts({});
    }

    const translateQuestions = async () => {
      if (language === 'lt' || state.questions.length === 0) {
        setTranslatedTexts({});
        return;
      }

      // Collect texts that need translation
      const textsToTranslate: string[] = [];
      state.questions.forEach(q => {
        const cacheKey = `${language}:${q.question.text}`;
        if (!translationCache.has(cacheKey)) {
          textsToTranslate.push(q.question.text);
        }
      });
      if (state.roundSummary) {
        const cacheKey = `${language}:${state.roundSummary}`;
        if (!translationCache.has(cacheKey)) {
          textsToTranslate.push(state.roundSummary);
        }
      }

      if (textsToTranslate.length === 0) {
        // All already cached, just update state from cache
        const newTranslated: Record<string, string> = {};
        state.questions.forEach(q => {
          const cacheKey = `${language}:${q.question.text}`;
          if (translationCache.has(cacheKey)) {
            newTranslated[q.question.text] = translationCache.get(cacheKey)!;
          }
        });
        if (state.roundSummary) {
          const cacheKey = `${language}:${state.roundSummary}`;
          if (translationCache.has(cacheKey)) {
            newTranslated[state.roundSummary] = translationCache.get(cacheKey)!;
          }
        }
        setTranslatedTexts(newTranslated);
        return;
      }

      setIsTranslating(true);
      const newTranslated: Record<string, string> = {};

      // Translate all texts in parallel
      await Promise.all(
        textsToTranslate.map(async (text) => {
          const translated = await translateText(text, language as 'en' | 'ru');
          const cacheKey = `${language}:${text}`;
          translationCache.set(cacheKey, translated);
          newTranslated[text] = translated;
        })
      );

      // Add cached translations
      state.questions.forEach(q => {
        const cacheKey = `${language}:${q.question.text}`;
        if (translationCache.has(cacheKey) && !newTranslated[q.question.text]) {
          newTranslated[q.question.text] = translationCache.get(cacheKey)!;
        }
      });
      if (state.roundSummary) {
        const cacheKey = `${language}:${state.roundSummary}`;
        if (translationCache.has(cacheKey) && !newTranslated[state.roundSummary]) {
          newTranslated[state.roundSummary] = translationCache.get(cacheKey)!;
        }
      }

      setTranslatedTexts(newTranslated);
      setIsTranslating(false);
    };

    translateQuestions();
  }, [language, state.questions, state.roundSummary]);

  // Helper to get displayed text (translated or original)
  // Returns null if translation is needed but not yet available (to show skeleton)
  const getDisplayText = useCallback((originalText: string): string | null => {
    if (language === 'lt') return originalText;
    // If we have a translation, return it
    if (translatedTexts[originalText]) return translatedTexts[originalText];
    // Otherwise show skeleton (translation pending or in progress)
    return null;
  }, [language, translatedTexts]);

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
        // All rounds done, go to contact collection
        setState((s) => ({
          ...s,
          phase: 'collecting_contact',
          slotStatus: response.slot_status || s.slotStatus,
        }));
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
          slotStatus: response.slot_status || s.slotStatus,
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

  // Handle contact form submission
  const handleContactSubmit = useCallback(async (contactInfo: ContactInfo) => {
    setState((s) => ({ ...s, phase: 'finalizing' }));
    setSaunaVisible(false); // Hide just before result

    try {
      await finalizeSession(sessionId, contactInfo);
      router.push(`/results/${sessionId}`);
    } catch (error) {
      console.error('Finalize failed:', error);
      toast.error('Failed to generate report. Please try again.');
      setState((s) => ({ ...s, phase: 'collecting_contact' }));
    }
  }, [sessionId, router]);

  // Handle contact form skip
  const handleContactSkip = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'finalizing' }));
    setSaunaVisible(false); // Hide just before result

    try {
      await finalizeSession(sessionId);
      router.push(`/results/${sessionId}`);
    } catch (error) {
      console.error('Finalize failed:', error);
      toast.error('Failed to generate report. Please try again.');
      setState((s) => ({ ...s, phase: 'collecting_contact' }));
    }
  }, [sessionId, router]);

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
            <h2 className="text-xl font-semibold">{t('session.error')}</h2>
            <p className="text-muted-foreground">{state.error}</p>
            <Button onClick={() => router.push('/')}>{t('session.goHome')}</Button>
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

  // Show contact collection form
  if (state.phase === 'collecting_contact') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <ContactForm
          onSubmit={handleContactSubmit}
          onSkip={handleContactSkip}
          className="max-w-md w-full"
        />
      </main>
    );
  }

  // Precise mode: Typeform-style single question flow
  if (state.interviewMode === 'precise' && state.questions.length > 0) {
    return (
      <main className="min-h-screen p-4 md:p-8 pt-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">{t('session.title')}</h1>
        </div>
        <PreciseModeFlow
          sessionId={sessionId}
          initialQuestion={state.questions[0].question}
          initialProgress={state.progressPercent}
          initialSlotStatus={state.slotStatus}
          onComplete={() => router.push(`/results/${sessionId}`)}
          onCollectContact={() => setState((s) => ({ ...s, phase: 'collecting_contact' }))}
        />
      </main>
    );
  }

  // Quick mode: Original round-based flow
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2 pt-32">
          <h1 className="text-2xl font-bold">{t('session.title')}</h1>
          <RoundIndicator
            currentRound={state.currentRound}
            questionsAnswered={confirmedCount}
          />
        </div>

        {/* Interview Progress (Precise mode only) */}
        {state.interviewMode === 'precise' && state.slotStatus.length > 0 && (
          <InterviewProgress
            slotStatus={state.slotStatus}
            currentRound={state.currentRound}
          />
        )}

        {/* Round Summary (if available) */}
        {state.roundSummary && (
          <Card className="glass-panel border-white/5">
            <CardContent className="pt-4">
              <p className="text-sm text-gray-300">
                <span className="font-medium text-primary">{t('session.roundSummary')} </span>
                {getDisplayText(state.roundSummary) || (
                  <span className="inline-block h-4 w-48 bg-white/10 rounded animate-pulse" />
                )}
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
              className="cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <QuestionCard
                questionNumber={index + 1}
                questionText={getDisplayText(q.question.text) || ''}
                status={q.isConfirmed ? 'confirmed' : q.recordingState}
                isActive={index === state.activeQuestionIndex}
                isTranslating={getDisplayText(q.question.text) === null}
              />
            </div>
          ))}
        </div>

        {/* Active Question Area */}
        {currentQuestion && !currentQuestion.isConfirmed && (
          <Card className="glass-panel p-8 border-none shadow-2xl">
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-primary">
                  {t('session.question', { number: state.activeQuestionIndex + 1 })}
                </p>
                <p className="text-2xl font-light leading-relaxed text-white">
                  {getDisplayText(currentQuestion.question.text) || (
                    <span className="inline-block h-8 w-full max-w-xl bg-white/10 rounded animate-pulse" />
                  )}
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
                  questionText={getDisplayText(currentQuestion.question.text) || currentQuestion.question.text}
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
              {state.currentRound === 3 ? t('session.finishInterview') : t('session.submitRound', { number: state.currentRound })}
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
