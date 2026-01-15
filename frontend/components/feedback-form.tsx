'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AudioRecorderComponent } from '@/components/audio-recorder';
import { useTranslation } from '@/lib/translations';
import { transcribeAudio, submitFeedback } from '@/lib/api';
import { toast } from 'sonner';

interface FeedbackFormProps {
  sessionId: string;
  onSubmitted?: () => void;
  className?: string;
}

export function FeedbackForm({
  sessionId,
  onSubmitted,
  className = '',
}: FeedbackFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const response = await transcribeAudio(sessionId, blob);
      setFeedbackText(response.transcript);
    } catch (error) {
      console.error('Transcription failed:', error);
      toast.error('Failed to transcribe feedback');
    } finally {
      setIsTranscribing(false);
    }
  }, [sessionId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);

    try {
      await submitFeedback(sessionId, {
        rating,
        feedback_text: feedbackText.trim() || undefined,
      });

      setIsSubmitted(true);
      toast.success(t('feedback.thankYou'));
      onSubmitted?.();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className={`glass-panel border-white/5 ${className}`}>
        <CardContent className="py-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckIcon className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-lg font-medium text-white">{t('feedback.thankYou')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`glass-panel border-white/5 ${className}`}>
      <CardContent className="pt-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">{t('feedback.title')}</h3>
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <StarIcon
                className="w-10 h-10"
                filled={star <= (hoverRating || rating)}
              />
            </button>
          ))}
        </div>

        {/* Voice Recording or Text */}
        {!feedbackText && !isEditing && !isTranscribing && (
          <div className="space-y-3">
            <p className="text-sm text-center text-gray-400">
              {t('feedback.recordFeedback')}
            </p>
            <AudioRecorderComponent
              onRecordingComplete={handleRecordingComplete}
              className="mx-auto max-w-sm"
            />
          </div>
        )}

        {/* Transcribing State */}
        {isTranscribing && (
          <div className="flex items-center justify-center gap-2 py-4">
            <LoadingSpinner className="w-5 h-5" />
            <span className="text-gray-400">{t('transcript.transcribing')}</span>
          </div>
        )}

        {/* Feedback Text Preview/Edit */}
        {feedbackText && !isTranscribing && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">
              {t('feedback.yourFeedback')}
            </label>
            {isEditing ? (
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
              />
            ) : (
              <div className="px-4 py-3 rounded-lg bg-black/20 border border-white/5 text-gray-300">
                &ldquo;{feedbackText}&rdquo;
              </div>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="text-gray-400 hover:text-white"
              >
                {isEditing ? t('transcript.save') : t('feedback.edit')}
              </Button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
          className="w-full bg-gradient-to-r from-primary to-amber-600 hover:to-amber-500 text-black font-semibold"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner className="w-5 h-5 mr-2" />
              {t('feedback.submitting')}
            </>
          ) : (
            t('feedback.submit')
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function StarIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg
      className={`${className} transition-colors ${filled ? 'text-amber-400' : 'text-gray-600'}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
