'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useTranslation } from '@/lib/translations';
import type { RecordingState } from '@/lib/types';

// ============================================
// Types
// ============================================

interface QuestionCardProps {
  questionNumber: number;
  questionText: string;
  status: RecordingState | 'confirmed';
  isActive?: boolean;
  isTranslating?: boolean;
  className?: string;
}

// ============================================
// Status Badge Component
// ============================================

interface StatusConfig {
  bg: string;
  text: string;
  labelKey: string;
  pulse?: boolean;
}

function StatusBadge({ status, t }: { status: RecordingState | 'confirmed'; t: (key: string) => string }) {
  const config: Record<RecordingState | 'confirmed', StatusConfig> = {
    idle: {
      bg: 'bg-white/5',
      text: 'text-muted-foreground',
      labelKey: 'questionCard.pending',
    },
    recording: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      labelKey: 'questionCard.recording',
      pulse: true,
    },
    processing: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      labelKey: 'questionCard.processing',
    },
    done: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      labelKey: 'questionCard.review',
    },
    confirmed: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      labelKey: 'questionCard.done',
    },
  };

  const { bg, text, labelKey, pulse } = config[status] ?? config.idle;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md border border-white/5 ${bg} ${text}`}>
      {pulse && <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />}
      {t(labelKey)}
    </span>
  );
}

// ============================================
// Component
// ============================================

export function QuestionCard({
  questionNumber,
  questionText,
  status,
  isActive = false,
  isTranslating = false,
  className = '',
}: QuestionCardProps) {
  const { t } = useTranslation();

  // Dynamic styles based on state
  let stateStyles = 'border-white/5 hover:border-white/10 opacity-70'; // Default inactive

  if (isActive) {
    stateStyles = 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(251,191,36,0.1)] opacity-100 scale-[1.02]';
  } else if (status === 'confirmed') {
    stateStyles = 'border-green-500/30 bg-green-500/5 opacity-80';
  } else if (status === 'done') {
    stateStyles = 'border-blue-500/30 bg-blue-500/5 opacity-100';
  }

  return (
    <Card className={`glass-panel transition-all duration-300 ${stateStyles} ${className}`}>
      <CardHeader className="pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shadow-lg
                ${status === 'confirmed'
                  ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50'
                  : isActive
                    ? 'bg-primary text-primary-foreground ring-1 ring-primary'
                    : 'bg-white/10 text-muted-foreground'
                }`}
            >
              {status === 'confirmed' ? (
                <CheckmarkIcon className="w-5 h-5" />
              ) : (
                questionNumber
              )}
            </span>
            <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              {t('session.question', { number: questionNumber })}
            </span>
          </div>
          <StatusBadge status={status} t={t} />
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isTranslating ? (
          <div className="space-y-2">
            <div className="h-5 bg-white/10 rounded animate-pulse w-full" />
            <div className="h-5 bg-white/10 rounded animate-pulse w-3/4" />
          </div>
        ) : (
          <p className={`text-lg leading-relaxed ${isActive ? 'text-white' : 'text-gray-400'}`}>
            {questionText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Checkmark Icon
// ============================================

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default QuestionCard;
