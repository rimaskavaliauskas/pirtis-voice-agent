'use client';

import { useMemo } from 'react';
import { SteamAnimation } from './steam-animation';
import { useSimulatedProgress } from '@/lib/use-simulated-progress';
import {
  getMessages,
  getLanguageFromStorage,
  type ProcessingType,
  type Language,
} from '@/lib/loading-messages';

interface ProcessingOverlayProps {
  /** Type of processing: transcription, analysis, or report */
  type: ProcessingType;
  /** Whether processing is complete (triggers finish animation) */
  isComplete?: boolean;
  /** Optional language override (defaults to localStorage) */
  language?: Language;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Processing overlay with animated progress, stages, and steam effects
 * Psychologically reduces perceived wait time through:
 * - Fast-start progress animation
 * - Clear stage indicators
 * - Engaging visual feedback
 */
export function ProcessingOverlay({
  type,
  isComplete = false,
  language,
  className = '',
}: ProcessingOverlayProps) {
  const lang = language || getLanguageFromStorage();
  const messages = useMemo(() => getMessages(type, lang), [type, lang]);
  const stageCount = messages.stages.length;

  const { progress, currentStage } = useSimulatedProgress({
    stageCount,
    isComplete,
  });

  return (
    <div
      className={`relative bg-gradient-to-b from-amber-950/95 via-orange-950/90 to-amber-900/95
        dark:from-stone-950/98 dark:via-stone-900/95 dark:to-stone-950/98
        rounded-2xl overflow-hidden shadow-2xl ${className}`}
      role="status"
      aria-live="polite"
      aria-label={messages.title}
    >
      {/* Steam background animation */}
      <SteamAnimation />

      {/* Content */}
      <div className="relative z-10 p-8 md:p-10">
        {/* Title */}
        <h3 className="text-xl md:text-2xl font-semibold text-amber-100 dark:text-amber-200 text-center mb-8">
          {messages.title}
        </h3>

        {/* Progress bar */}
        <div className="relative mb-8">
          <div className="h-3 bg-amber-900/50 dark:bg-stone-800/50 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500
                dark:from-amber-500 dark:via-orange-500 dark:to-amber-400
                rounded-full transition-all duration-300 ease-out
                shadow-lg shadow-amber-500/30"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Progress percentage */}
          <div className="absolute -right-1 -top-8 text-sm font-mono text-amber-200/80 dark:text-amber-300/80">
            {Math.round(progress)}%
          </div>
        </div>

        {/* Stages list */}
        <div className="space-y-3">
          {messages.stages.map((stage, index) => {
            const isCompleted = index < currentStage || isComplete;
            const isCurrent = index === currentStage && !isComplete;

            return (
              <div
                key={index}
                className={`flex items-center gap-3 transition-all duration-300 ${
                  isCompleted
                    ? 'opacity-100'
                    : isCurrent
                      ? 'opacity-100'
                      : 'opacity-40'
                }`}
              >
                {/* Stage indicator */}
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                    transition-all duration-300 ${
                      isCompleted
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : isCurrent
                          ? 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/40 animate-pulse'
                          : 'bg-amber-900/30 dark:bg-stone-700/30 text-amber-300/50'
                    }`}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : isCurrent ? (
                    <div className="w-2 h-2 bg-current rounded-full" />
                  ) : (
                    <div className="w-1.5 h-1.5 bg-current rounded-full opacity-50" />
                  )}
                </div>

                {/* Stage text */}
                <span
                  className={`text-sm md:text-base transition-colors duration-300 ${
                    isCompleted
                      ? 'text-green-300 line-through opacity-70'
                      : isCurrent
                        ? 'text-amber-100 dark:text-amber-200 font-medium'
                        : 'text-amber-200/50 dark:text-stone-400/50'
                  }`}
                >
                  {stage}
                </span>
              </div>
            );
          })}
        </div>

        {/* Decorative bottom element */}
        <div className="mt-8 flex justify-center">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-amber-400/60 dark:bg-amber-500/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
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

export default ProcessingOverlay;
