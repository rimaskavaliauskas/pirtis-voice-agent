import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSimulatedProgressOptions {
  /** Number of stages in the process */
  stageCount?: number;
  /** Whether the process is complete (jumps to 100%) */
  isComplete?: boolean;
  /** Callback when stage changes */
  onStageChange?: (stage: number) => void;
}

interface SimulatedProgressState {
  progress: number;
  currentStage: number;
  isAnimating: boolean;
}

/**
 * Hook for simulated progress with fast-start algorithm
 *
 * Progress curve:
 * - 0-30%: Fast (first 2 seconds) - gives immediate feedback
 * - 30-70%: Medium (next 4 seconds) - maintains engagement
 * - 70-90%: Slow (stalls here until complete) - prevents false expectations
 * - 90-100%: Only when isComplete=true
 */
export function useSimulatedProgress({
  stageCount = 4,
  isComplete = false,
  onStageChange,
}: UseSimulatedProgressOptions = {}): SimulatedProgressState {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Calculate stage based on progress
  const calculateStage = useCallback((prog: number): number => {
    const stageSize = 100 / stageCount;
    return Math.min(Math.floor(prog / stageSize), stageCount - 1);
  }, [stageCount]);

  // Fast-start easing function
  const easeProgress = useCallback((elapsed: number, maxProgress: number): number => {
    // Phase 1: 0-30% in first 2 seconds (fast start)
    if (elapsed < 2000) {
      const t = elapsed / 2000;
      // Ease-out for fast start feeling
      return 30 * (1 - Math.pow(1 - t, 3));
    }

    // Phase 2: 30-70% in next 4 seconds (medium pace)
    if (elapsed < 6000) {
      const t = (elapsed - 2000) / 4000;
      return 30 + 40 * t;
    }

    // Phase 3: 70-90% asymptotic approach (never quite reaches 90)
    const t = (elapsed - 6000) / 10000;
    const asymptotic = 90 * (1 - Math.exp(-t * 2));
    return Math.min(70 + asymptotic * 0.22, maxProgress);
  }, []);

  // Animation loop
  useEffect(() => {
    if (isComplete) {
      // Jump to 100% when complete
      setProgress(100);
      setCurrentStage(stageCount - 1);
      setIsAnimating(false);
      return;
    }

    startTimeRef.current = Date.now();
    setIsAnimating(true);

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const maxProgress = 88; // Never exceed 88% until complete
      const newProgress = easeProgress(elapsed, maxProgress);

      setProgress(newProgress);

      const newStage = calculateStage(newProgress);
      setCurrentStage((prev) => {
        if (newStage !== prev) {
          onStageChange?.(newStage);
          return newStage;
        }
        return prev;
      });

      if (newProgress < maxProgress) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isComplete, stageCount, easeProgress, calculateStage, onStageChange]);

  return {
    progress,
    currentStage,
    isAnimating,
  };
}

export default useSimulatedProgress;
