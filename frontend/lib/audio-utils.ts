// Audio Utilities for Voice Agent
// Handles audio recording, format conversion, and blob management

// ============================================
// Types
// ============================================

export interface AudioRecorderOptions {
  onDataAvailable?: (blob: Blob) => void;
  onStart?: () => void;
  onStop?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  mimeType?: string;
}

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
}

// ============================================
// Audio Recorder Class
// ============================================

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private options: AudioRecorderOptions;

  constructor(options: AudioRecorderOptions = {}) {
    this.options = options;
  }

  /**
   * Request microphone permission and initialize recorder
   */
  async initialize(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Determine best supported MIME type
      const mimeType = this.options.mimeType || this.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.options.onDataAvailable?.(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.startTime = Date.now();
        this.options.onStart?.();
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        this.options.onStop?.(blob);
      };

      this.mediaRecorder.onerror = (event) => {
        this.options.onError?.(new Error(`MediaRecorder error: ${event}`));
      };

      return true;
    } catch (error) {
      this.options.onError?.(error as Error);
      return false;
    }
  }

  /**
   * Get the best supported MIME type for audio recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Start recording
   */
  start(): void {
    if (!this.mediaRecorder) {
      throw new Error('Recorder not initialized. Call initialize() first.');
    }

    this.audioChunks = [];
    this.mediaRecorder.start(1000); // Collect data every second
  }

  /**
   * Stop recording and return the audio blob
   */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Recorder not initialized'));
        return;
      }

      if (this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recorder is not recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        resolve(blob);
        this.options.onStop?.(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  /**
   * Get current recording duration in seconds
   */
  getDuration(): number {
    if (this.startTime === 0) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Get current recorder state
   */
  getState(): RecorderState {
    return {
      isRecording: this.mediaRecorder?.state === 'recording',
      isPaused: this.mediaRecorder?.state === 'paused',
      duration: this.getDuration(),
    };
  }

  /**
   * Release all resources
   */
  destroy(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create an object URL for audio playback
 */
export function createAudioUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revoke an object URL to free memory
 */
export function revokeAudioUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Get audio blob size in human-readable format
 */
export function formatBlobSize(blob: Blob): string {
  const bytes = blob.size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if browser supports audio recording
 */
export function isAudioRecordingSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

/**
 * Check microphone permission status
 */
export async function checkMicrophonePermission(): Promise<
  'granted' | 'denied' | 'prompt'
> {
  try {
    const result = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return result.state;
  } catch {
    // Some browsers don't support permissions query for microphone
    return 'prompt';
  }
}

/**
 * Get audio duration from blob
 */
export function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = createAudioUrl(blob);

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      revokeAudioUrl(audio.src);
      resolve(duration);
    };

    audio.onerror = () => {
      revokeAudioUrl(audio.src);
      reject(new Error('Failed to load audio'));
    };
  });
}

// ============================================
// Audio Visualization (Simple)
// ============================================

/**
 * Create a simple audio level meter
 * Returns a function to get the current level (0-1)
 */
export function createAudioLevelMeter(
  stream: MediaStream
): () => number {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);

  source.connect(analyser);
  analyser.fftSize = 256;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  return () => {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    return average / 255;
  };
}
