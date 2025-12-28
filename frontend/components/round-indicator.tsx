'use client';

import { Progress } from '@/components/ui/progress';

// ============================================
// Types
// ============================================

interface RoundIndicatorProps {
  currentRound: number;
  totalRounds?: number;
  questionsAnswered?: number;
  totalQuestions?: number;
  className?: string;
}

// ============================================
// Component
// ============================================

export function RoundIndicator({
  currentRound,
  totalRounds = 3,
  questionsAnswered = 0,
  totalQuestions = 3,
  className = '',
}: RoundIndicatorProps) {
  // Calculate overall progress
  const completedRounds = currentRound - 1;
  const questionsPerRound = totalQuestions;
  const totalQuestionsOverall = totalRounds * questionsPerRound;
  const answeredOverall = completedRounds * questionsPerRound + questionsAnswered;
  const progressPercent = (answeredOverall / totalQuestionsOverall) * 100;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Round Pills */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalRounds }, (_, i) => {
          const roundNum = i + 1;
          const isCompleted = roundNum < currentRound;
          const isCurrent = roundNum === currentRound;

          return (
            <div
              key={roundNum}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
            >
              {isCompleted ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <span className="w-4 text-center">{roundNum}</span>
              )}
              <span>Round {roundNum}</span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Question {questionsAnswered}/{totalQuestions} in Round {currentRound}
          </span>
          <span>{Math.round(progressPercent)}% complete</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Check Icon
// ============================================

function CheckIcon({ className }: { className?: string }) {
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

export default RoundIndicator;
