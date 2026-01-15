'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  AudioRecorder as AudioRecorderUtil,
  formatDuration,
  isAudioRecordingSupported,
  createAudioUrl,
  revokeAudioUrl,
} from '@/lib/audio-utils';
import { useTranslation } from '@/lib/translations';
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
// Icons
// ============================================

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const { t } = useTranslation();
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
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

  // Cleanup
  useEffect(() => {
    return () => {
      recorderRef.current?.destroy();
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) revokeAudioUrl(audioUrl);
    };
  }, [audioUrl]);

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
      setError('Check microphone permissions.');
      setState('idle');
      return;
    }

    recorderRef.current = recorder;
    recorder.start();
    onRecordingStart?.();

    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((d) => {
        const newDuration = d + 1;
        if (newDuration >= maxDuration) stopRecording();
        return newDuration;
      });
    }, 1000);
  }, [maxDuration, onRecordingStart]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return;
    setState('processing');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const blob = await recorderRef.current.stop();
      setAudioUrl(createAudioUrl(blob));
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

  const resetRecording = useCallback(() => {
    if (audioUrl) revokeAudioUrl(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setState('idle');
    setIsPlaying(false);
    setError(null);
  }, [audioUrl]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  }, [audioUrl, isPlaying]);

  if (!isSupported) {
    return (
      <div className={`p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-center ${className}`}>
        {t('audio.notSupported')}
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-center py-8 ${className}`}>
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}

      {error && <p className="text-destructive text-sm mb-4 bg-destructive/10 px-3 py-1 rounded-full">{error}</p>}

      {/* Main Orb Container */}
      <div className="relative">

        {/* Ripples when recording */}
        {state === 'recording' && (
          <>
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
          </>
        )}

        {/* Control Button */}
        <div className="relative z-10 transition-all duration-300 transform">

          {state === 'idle' && (
            <div className="flex flex-col items-center group">
              <button
                onClick={startRecording}
                disabled={disabled}
                className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-amber-600 shadow-[0_0_30px_rgba(251,191,36,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all outline-none"
              >
                <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse-glow" />
                <MicIcon className="w-10 h-10 text-white drop-shadow-md relative z-10" />
              </button>
              <span className="mt-4 text-sm font-medium text-white/50 tracking-widest group-hover:text-primary transition-colors">{t('audio.tapToSpeak')}</span>
            </div>
          )}

          {state === 'recording' && (
            <button
              onClick={stopRecording}
              className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-center justify-center animate-pulse hover:bg-red-500/20 transition-all outline-none"
            >
              <StopIcon className="w-10 h-10 text-red-500" />
            </button>
          )}

          {state === 'processing' && (
            <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-primary animate-spin" />
          )}

          {state === 'done' && (
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={resetRecording} className="h-14 w-14 rounded-full border-white/10 hover:bg-white/5 hover:text-destructive">
                <TrashIcon className="w-6 h-6" />
              </Button>

              <button
                onClick={togglePlayback}
                className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_20px_rgba(251,191,36,0.3)]"
              >
                {isPlaying ? <StopIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timer / Status Text */}
      <div className="mt-8 text-center h-8">
        {state === 'recording' && (
          <span className="text-2xl font-mono tabular-nums text-white tracking-widest animate-pulse">
            {formatDuration(duration)}
          </span>
        )}
        {state === 'processing' && <span className="text-sm text-white/50 animate-pulse">{t('audio.processing')}</span>}
        {state === 'done' && <span className="text-sm text-green-400">{t('audio.captured')}</span>}
      </div>
    </div>
  );
}

export default AudioRecorderComponent;
