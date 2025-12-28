'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { RecordingState } from '@/lib/types';

// ============================================
// Types
// ============================================

interface QuestionCardProps {
  questionNumber: number;
  questionText: string;
  status: RecordingState | 'confirmed';
  isActive?: boolean;
  className?: string;
}

// ============================================
// Status Badge Component
// ============================================

interface StatusConfig {
  bg: string;
  text: string;
  label: string;
  pulse?: boolean;
}

function StatusBadge({ status }: { status: RecordingState | 'confirmed' }) {
  const config: Record<RecordingState | 'confirmed', StatusConfig> = {
    idle: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      label: 'Pending',
    },
    recording: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      label: 'Recording',
      pulse: true,
    },
    processing: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-600 dark:text-yellow-400',
      label: 'Processing',
    },
    done: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      label: 'Review',
    },
    confirmed: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
      label: 'Confirmed',
    },
  };

  const { bg, text, label, pulse } = config[status] ?? config.idle;

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      {pulse && (
        <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse" />
      )}
      {label}
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
  className = '',
}: QuestionCardProps) {
  const borderClass = isActive
    ? 'border-primary ring-2 ring-primary/20'
    : status === 'confirmed'
      ? 'border-green-300 dark:border-green-800'
      : 'border-border';

  return (
    <Card
      className={`transition-all duration-200 ${borderClass} ${className}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold
                ${
                  status === 'confirmed'
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
            >
              {status === 'confirmed' ? (
                <CheckmarkIcon className="w-4 h-4" />
              ) : (
                questionNumber
              )}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              Question {questionNumber}
            </span>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-base leading-relaxed">{questionText}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Checkmark Icon
// ============================================

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default QuestionCard;
