'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AudioRecorderComponent } from '@/components/audio-recorder';
import { TranscriptPreview } from '@/components/transcript-preview';
import { ProcessingOverlay } from '@/components/processing-overlay';
import { transcribeAudio, submitAnswers, translateText } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/translations';
import type { Question, SlotStatus, RiskFlag, ContactInfo } from '@/lib/types';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface PreciseModeFlowProps {
  sessionId: string;
  initialQuestion: Question;
  initialProgress: number;
  initialSlotStatus: SlotStatus[];
  onComplete: () => void;
  onCollectContact: () => void;
}

type FlowState = 'idle' | 'recording' | 'processing' | 'confirming' | 'transitioning';

// Cache for translated texts
const translationCache = new Map<string, string>();

// ============================================
// Component
// ============================================

export function PreciseModeFlow({
  sessionId,
  initialQuestion,
  initialProgress,
  initialSlotStatus,
  onComplete,
  onCollectContact,
}: PreciseModeFlowProps) {
  const { t, language } = useTranslation();

  // Current question state
  const [currentQuestion, setCurrentQuestion] = useState<Question>(initialQuestion);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);

  // Progress tracking
  const [progressPercent, setProgressPercent] = useState(initialProgress);
  const [slotStatus, setSlotStatus] = useState<SlotStatus[]>(initialSlotStatus);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);

  // Clarification
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);

  // Inline loading state for confirm button
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Translation state
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [pendingTransitionToIdle, setPendingTransitionToIdle] = useState(false);

  // Translate current question when it changes
  useEffect(() => {
    if (language === 'lt') {
      setTranslatedText(null);
      // If waiting for translation to complete, transition now
      if (pendingTransitionToIdle) {
        setFlowState('idle');
        setIsSubmitting(false);
        setPendingTransitionToIdle(false);
      }
      return;
    }

    // Clear previous translation immediately
    setTranslatedText(null);

    const textToTranslate = clarificationQuestion || currentQuestion.text;
    const cacheKey = `${language}:${textToTranslate}`;

    if (translationCache.has(cacheKey)) {
      setTranslatedText(translationCache.get(cacheKey)!);
      // If waiting for translation to complete, transition now
      if (pendingTransitionToIdle) {
        setFlowState('idle');
        setIsSubmitting(false);
        setPendingTransitionToIdle(false);
      }
      return;
    }

    setIsTranslating(true);
    translateText(textToTranslate, language as 'en' | 'ru')
      .then((translated) => {
        translationCache.set(cacheKey, translated);
        setTranslatedText(translated);
      })
      .finally(() => {
        setIsTranslating(false);
        // If waiting for translation to complete, transition now
        if (pendingTransitionToIdle) {
          setFlowState('idle');
          setIsSubmitting(false);
          setPendingTransitionToIdle(false);
        }
      });
  }, [currentQuestion.text, clarificationQuestion, language, pendingTransitionToIdle]);

  // Get display text
  const displayText = language === 'lt'
    ? (clarificationQuestion || currentQuestion.text)
    : translatedText;

  // Handle recording complete
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setAudioBlob(blob);
    setFlowState('processing');

    try {
      const response = await transcribeAudio(sessionId, blob);
      setTranscript(response.transcript);
      setFlowState('confirming');
    } catch (error) {
      console.error('Transcription failed:', error);
      toast.error(t('session.transcriptionFailed'));
      setFlowState('idle');
      setAudioBlob(null);
    }
  }, [sessionId, t]);

  // Handle transcript confirmation - auto-submit with inline loading
  const handleConfirmTranscript = useCallback(async (editedTranscript: string) => {
    setTranscript(editedTranscript);
    setIsSubmitting(true);

    try {
      const response = await submitAnswers(sessionId, {
        transcripts: [{
          question_id: clarificationQuestion ? `CLARIFY_${currentQuestion.id}` : currentQuestion.id,
          text: editedTranscript,
        }],
      });

      // Update progress
      if (response.progress_percent !== undefined) {
        setProgressPercent(response.progress_percent);
      }
      if (response.slot_status) {
        setSlotStatus(response.slot_status);
      }

      // Increment questions answered
      setQuestionsAnswered((prev) => prev + 1);

      // Check if interview is complete
      if (response.is_complete) {
        toast.success(t('session.interviewComplete'));
        onCollectContact();
        return;
      }

      // Check for clarification question
      if (response.clarification_question) {
        setClarificationQuestion(response.clarification_question);
        setAudioBlob(null);
        setTranscript(null);
        // Show transitioning state while waiting for translation
        setFlowState('transitioning');
        setPendingTransitionToIdle(true);
        return;
      }

      // Move to next question
      if (response.next_questions.length > 0) {
        setCurrentQuestion(response.next_questions[0]);
        setClarificationQuestion(null);
        setAudioBlob(null);
        setTranscript(null);
        // Show transitioning state while waiting for translation
        setFlowState('transitioning');
        setPendingTransitionToIdle(true);
      } else {
        // No more questions
        onCollectContact();
      }
    } catch (error) {
      console.error('Submit failed:', error);
      toast.error(t('session.submitFailed'));
      setIsSubmitting(false);
    }
  }, [sessionId, currentQuestion, clarificationQuestion, onCollectContact, t]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setFlowState('idle');
    setAudioBlob(null);
    setTranscript(null);
  }, []);

  // Calculate filled slots count for display
  const filledSlots = slotStatus.filter((s) => s.status === 'filled').length;
  const totalSlots = slotStatus.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{t('session.interviewProgress')}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{t('session.questionsAnswered', { count: questionsAnswered })}</span>
          <span>{t('session.slotsProgress', { filled: filledSlots, total: totalSlots })}</span>
        </div>
      </div>

      {/* Slot Status Pills (compact view) */}
      <div className="flex flex-wrap gap-2">
        {slotStatus.slice(0, 6).map((slot) => (
          <div
            key={slot.slot_key}
            className={cn(
              'px-2 py-1 rounded-full text-xs transition-colors',
              slot.status === 'filled' && 'bg-green-500/20 text-green-400',
              slot.status === 'partial' && 'bg-yellow-500/20 text-yellow-400',
              slot.status === 'empty' && 'bg-white/5 text-gray-500'
            )}
          >
            {slot.status === 'filled' && '✓ '}
            {slot.status === 'partial' && '◐ '}
            {t(`slots.${slot.slot_key}`)}
          </div>
        ))}
        {slotStatus.length > 6 && (
          <div className="px-2 py-1 rounded-full text-xs bg-white/5 text-gray-500">
            +{slotStatus.length - 6} {t('session.more')}
          </div>
        )}
      </div>

      {/* Main Question Card */}
      <Card className="glass-panel border-none shadow-2xl">
        <CardContent className="p-8 space-y-8">
          {/* Question Text - hide during confirmation and transitioning */}
          {flowState !== 'confirming' && flowState !== 'transitioning' && (
            <div className="text-center space-y-4">
              {clarificationQuestion && (
                <div className="inline-block px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
                  {t('session.clarifying')}
                </div>
              )}
              <p className="text-2xl font-light leading-relaxed text-white">
                {displayText || (
                  <span className="inline-block h-8 w-full max-w-xl bg-white/10 rounded animate-pulse" />
                )}
              </p>
            </div>
          )}

          {/* Flow States */}
          {flowState === 'idle' && (
            <AudioRecorderComponent
              onRecordingComplete={handleRecordingComplete}
              className="mx-auto max-w-sm"
            />
          )}

          {flowState === 'processing' && (
            <ProcessingOverlay type="transcription" className="mx-auto max-w-md" />
          )}

          {flowState === 'transitioning' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-400">{t('session.processing')}</p>
            </div>
          )}

          {flowState === 'confirming' && transcript && (
            <TranscriptPreview
              transcript={transcript}
              questionText={displayText || currentQuestion.text}
              onConfirm={handleConfirmTranscript}
              onRetry={handleRetry}
              isLoading={isSubmitting}
              className="mx-auto max-w-lg"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
