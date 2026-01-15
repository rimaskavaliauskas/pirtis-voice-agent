'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/translations';
import type { SlotStatus } from '@/lib/types';

interface InterviewProgressProps {
  slotStatus: SlotStatus[];
  currentRound: number;
  className?: string;
}

export function InterviewProgress({
  slotStatus,
  currentRound,
  className = '',
}: InterviewProgressProps) {
  const { t } = useTranslation();

  // Calculate progress percentage
  const filledCount = slotStatus.filter((s) => s.status === 'filled').length;
  const partialCount = slotStatus.filter((s) => s.status === 'partial').length;
  const totalSlots = slotStatus.length;

  // Filled = 100%, Partial = 50%, Empty = 0%
  const progressPercent = totalSlots > 0
    ? Math.round(((filledCount + partialCount * 0.5) / totalSlots) * 100)
    : 0;

  return (
    <Card className={`glass-panel border-white/5 ${className}`}>
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-primary">
            {t('session.interviewProgress')}
          </span>
          <span className="text-xs text-gray-400">
            {t('round.label', { number: currentRound })}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Slot Status Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slotStatus.map((slot) => (
            <div
              key={slot.slot_key}
              className={`
                px-2 py-1.5 rounded-lg text-xs transition-all
                ${slot.status === 'filled'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : slot.status === 'partial'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/5'}
              `}
            >
              <div className="flex items-center gap-1.5">
                <StatusIcon status={slot.status} />
                <span className="truncate">{t(`slots.${slot.slot_key}`)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 text-xs text-gray-500 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1">
            <StatusIcon status="filled" />
            <span>{t('session.slotFilled')}</span>
          </div>
          <div className="flex items-center gap-1">
            <StatusIcon status="partial" />
            <span>{t('session.slotPartial')}</span>
          </div>
          <div className="flex items-center gap-1">
            <StatusIcon status="empty" />
            <span>{t('session.slotEmpty')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: 'filled' | 'partial' | 'empty' }) {
  if (status === 'filled') {
    return (
      <svg className="w-3 h-3 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'partial') {
    return (
      <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2a10 10 0 0 1 0 20" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
