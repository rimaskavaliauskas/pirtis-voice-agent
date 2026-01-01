'use client';

import { Progress } from '@/components/ui/progress';
import { useTranslation } from '@/lib/translations';

interface RoundIndicatorProps {
  currentRound: number;
  totalRounds?: number;
  questionsAnswered?: number;
  totalQuestions?: number;
  className?: string;
}

export function RoundIndicator({
  currentRound,
  totalRounds = 3,
  questionsAnswered = 0,
  totalQuestions = 3,
  className = '',
}: RoundIndicatorProps) {
  const { t } = useTranslation();
  const completedRounds = currentRound - 1;
  const questionsPerRound = totalQuestions;
  const totalQuestionsOverall = totalRounds * questionsPerRound;
  const answeredOverall = completedRounds * questionsPerRound + questionsAnswered;
  const progressPercent = (answeredOverall / totalQuestionsOverall) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-center gap-3">
        {Array.from({ length: totalRounds }, (_, i) => {
          const roundNum = i + 1;
          const isCompleted = roundNum < currentRound;
          const isCurrent = roundNum === currentRound;

          return (
            <div
              key={roundNum}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                ${isCompleted
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : isCurrent
                    ? 'bg-primary text-primary-foreground border border-primary shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-105'
                    : 'bg-white/5 text-muted-foreground border border-white/5'
                }`}
            >
              {isCompleted ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <span className={`w-4 text-center font-bold ${isCurrent ? 'bg-primary-foreground/20 rounded-full' : ''}`}>{roundNum}</span>
              )}
              <span className="uppercase tracking-wider text-xs">{t('round.label', { number: roundNum })}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 max-w-lg mx-auto">
        <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(251,191,36,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-gray-500 uppercase tracking-widest">
          <span>{t('round.progress', { answered: questionsAnswered, total: totalQuestions })}</span>
          <span>{Math.round(progressPercent)}{t('round.done')}</span>
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default RoundIndicator;
