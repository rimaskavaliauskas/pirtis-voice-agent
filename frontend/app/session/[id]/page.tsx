'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProcessingOverlay } from '@/components/processing-overlay';
import { SessionSkeleton } from '@/components/session-skeleton';
import { ContactForm } from '@/components/contact-form';
import { PreciseModeFlow } from '@/components/precise-mode-flow';
import { finalizeSession, isValidSessionId, getSessionState } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/translations';
import { useUI } from '@/components/ui-provider';
import type { Question, InterviewMode, SlotStatus, ContactInfo } from '@/lib/types';

// ============================================
// Types
// ============================================

type PagePhase =
  | 'loading'
  | 'active'
  | 'collecting_contact'
  | 'finalizing'
  | 'error';

interface PageState {
  phase: PagePhase;
  firstQuestion: Question | null;
  interviewMode: InterviewMode;
  slotStatus: SlotStatus[];
  progressPercent: number;
  error: string | null;
}

// ============================================
// Component
// ============================================

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { t } = useTranslation();
  const { setSaunaPhase, setSaunaVisible } = useUI();

  const [state, setState] = useState<PageState>({
    phase: 'loading',
    firstQuestion: null,
    interviewMode: 'quick',
    slotStatus: [],
    progressPercent: 0,
    error: null,
  });

  // Fetch session state from backend
  useEffect(() => {
    if (!isValidSessionId(sessionId)) {
      setState((s) => ({ ...s, phase: 'error', error: 'Invalid session ID' }));
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await getSessionState(sessionId);

        if (response.completed_at) {
          router.push(`/results/${sessionId}`);
          return;
        }

        const questions: Question[] = response.state.next_questions.map((q) => ({
          id: q.id,
          text: q.text,
        }));

        if (questions.length === 0) {
          setState((s) => ({ ...s, phase: 'error', error: 'No questions available' }));
          return;
        }

        setState((s) => ({
          ...s,
          phase: 'active',
          firstQuestion: questions[0],
          interviewMode: (response.interview_mode as InterviewMode) || 'quick',
          slotStatus: response.slot_status || [],
          progressPercent: response.progress_percent || 0,
        }));
      } catch (error) {
        console.error('Failed to fetch session:', error);
        setState((s) => ({ ...s, phase: 'error', error: 'Failed to load session. Please try again.' }));
      }
    };

    fetchSession();
    setSaunaPhase('active');
    setSaunaVisible(true);
  }, [sessionId, router, setSaunaPhase, setSaunaVisible]);

  // Handle contact form submission
  const handleContactSubmit = useCallback(async (contactInfo: ContactInfo) => {
    setState((s) => ({ ...s, phase: 'finalizing' }));
    setSaunaVisible(false);

    try {
      await finalizeSession(sessionId, contactInfo);
      router.push(`/results/${sessionId}`);
    } catch (error) {
      console.error('Finalize failed:', error);
      toast.error('Failed to generate report. Please try again.');
      setState((s) => ({ ...s, phase: 'collecting_contact' }));
    }
  }, [sessionId, router, setSaunaVisible]);

  // Handle contact form skip
  const handleContactSkip = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'finalizing' }));
    setSaunaVisible(false);

    try {
      await finalizeSession(sessionId);
      router.push(`/results/${sessionId}`);
    } catch (error) {
      console.error('Finalize failed:', error);
      toast.error('Failed to generate report. Please try again.');
      setState((s) => ({ ...s, phase: 'collecting_contact' }));
    }
  }, [sessionId, router, setSaunaVisible]);

  // Loading
  if (state.phase === 'loading') {
    return <SessionSkeleton />;
  }

  // Error
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

  // Finalizing
  if (state.phase === 'finalizing') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <ProcessingOverlay type="report" className="max-w-md w-full" />
      </main>
    );
  }

  // Contact collection
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

  // Active interview — both Quick and Precise use single-question flow
  if (state.firstQuestion) {
    return (
      <main className="min-h-screen p-4 md:p-8 pt-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">{t('session.title')}</h1>
        </div>
        <PreciseModeFlow
          sessionId={sessionId}
          initialQuestion={state.firstQuestion}
          initialProgress={state.progressPercent}
          initialSlotStatus={state.slotStatus}
          onComplete={() => router.push(`/results/${sessionId}`)}
          onCollectContact={() => setState((s) => ({ ...s, phase: 'collecting_contact' }))}
        />
      </main>
    );
  }

  return null;
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
