'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AudioRecorder as AudioRecorderUtil,
  formatDuration,
  isAudioRecordingSupported,
  createAudioUrl,
  revokeAudioUrl,
} from '@/lib/audio-utils';
import type { RecordingState } from '@/lib/types';

// ============================================
// Types
// ============================================

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
  maxDuration?: number; // in seconds
  className?: string;
}

// ============================================
// Icons (inline SVG for simplicity)
// ============================================

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

// ============================================
// Component
// ============================================

export function AudioRecorderComponent({
  onRecordingComplete,
  onRecordingStart,
  disabled = false,
  maxDuration = 120,
  className = '',
}: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recorderRef = useRef<AudioRecorderUtil | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check browser support
  useEffect(() => {
    setIsSupported(isAudioRecordingSupported());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        revokeAudioUrl(audioUrl);
      }
    };
  }, [audioUrl]);

  // Start recording
  const startRecording = useCallback(async () => {
    setError(null);
    setState('recording');

    const recorder = new AudioRecorderUtil({
      onError: (err) => {
        setError(err.message);
        setState('idle');
      },
    });

    const initialized = await recorder.initialize();
    if (!initialized) {
      setError('Failed to access microphone. Please check permissions.');
      setState('idle');
      return;
    }

    recorderRef.current = recorder;
    recorder.start();
    onRecordingStart?.();

    // Start duration timer
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((d) => {
        const newDuration = d + 1;
        // Auto-stop at max duration
        if (newDuration >= maxDuration) {
          stopRecording();
        }
        return newDuration;
      });
    }, 1000);
  }, [maxDuration, onRecordingStart]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    setState('processing');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const blob = await recorderRef.current.stop();
      setAudioBlob(blob);

      // Create URL for playback
      const url = createAudioUrl(blob);
      setAudioUrl(url);

      setState('done');
      onRecordingComplete(blob);
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    } finally {
      recorderRef.current.destroy();
      recorderRef.current = null;
    }
  }, [onRecordingComplete]);

  // Reset recording
  const resetRecording = useCallback(() => {
    if (audioUrl) {
      revokeAudioUrl(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setState('idle');
    setIsPlaying(false);
    setError(null);
  }, [audioUrl]);

  // Play/pause audio preview
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [audioUrl, isPlaying]);

  // Handle audio ended
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  if (!isSupported) {
    return (
      <Card className={`p-4 ${className}`}>
        <p className="text-red-500 text-center">
          Audio recording is not supported in this browser.
        </p>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm mb-2 text-center">{error}</p>
      )}

      {/* Recording interface */}
      <div className="flex flex-col items-center gap-4">
        {/* Duration display */}
        <div className="text-2xl font-mono tabular-nums">
          {formatDuration(duration)}
        </div>

        {/* Recording indicator */}
        {state === 'recording' && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Recording...</span>
          </div>
        )}

        {state === 'processing' && (
          <span className="text-sm text-muted-foreground">Processing...</span>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {state === 'idle' && (
            <Button
              size="lg"
              onClick={startRecording}
              disabled={disabled}
              className="rounded-full w-16 h-16"
            >
              <MicIcon className="w-6 h-6" />
            </Button>
          )}

          {state === 'recording' && (
            <Button
              size="lg"
              variant="destructive"
              onClick={stopRecording}
              className="rounded-full w-16 h-16"
            >
              <StopIcon className="w-6 h-6" />
            </Button>
          )}

          {state === 'done' && (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={togglePlayback}
                className="rounded-full w-12 h-12"
              >
                {isPlaying ? (
                  <StopIcon className="w-5 h-5" />
                ) : (
                  <PlayIcon className="w-5 h-5" />
                )}
              </Button>

              <Button
                size="lg"
                variant="ghost"
                onClick={resetRecording}
                className="rounded-full w-12 h-12"
              >
                <TrashIcon className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {/* Max duration hint */}
        {state === 'idle' && (
          <p className="text-xs text-muted-foreground">
            Max {Math.floor(maxDuration / 60)} minutes
          </p>
        )}
      </div>
    </Card>
  );
}

export default AudioRecorderComponent;
