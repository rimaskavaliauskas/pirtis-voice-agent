'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

// ============================================
// Types
// ============================================

interface TranscriptPreviewProps {
  transcript: string;
  questionText: string;
  onConfirm: (editedTranscript: string) => void;
  onRetry?: () => void;
  isLoading?: boolean;
  className?: string;
}

// ============================================
// Icons
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
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
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

// ============================================
// Component
// ============================================

export function TranscriptPreview({
  transcript,
  questionText,
  onConfirm,
  onRetry,
  isLoading = false,
  className = '',
}: TranscriptPreviewProps) {
  const [editedTranscript, setEditedTranscript] = useState(transcript);
  const [isEditing, setIsEditing] = useState(false);

  // Reset edited transcript when prop changes
  useState(() => {
    setEditedTranscript(transcript);
  });

  const handleConfirm = useCallback(() => {
    onConfirm(editedTranscript.trim());
  }, [editedTranscript, onConfirm]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditedTranscript(transcript);
    setIsEditing(false);
  }, [transcript]);

  const handleSaveEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const isModified = editedTranscript.trim() !== transcript.trim();

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Your answer to:
        </CardTitle>
        <p className="text-sm italic">&quot;{questionText}&quot;</p>
      </CardHeader>

      <CardContent className="pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            <span className="ml-2 text-muted-foreground">Transcribing...</span>
          </div>
        ) : isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Edit your transcript..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative group">
            <p className="text-sm leading-relaxed bg-muted/50 rounded-md p-3 min-h-[80px]">
              {editedTranscript || (
                <span className="text-muted-foreground italic">
                  No transcript available
                </span>
              )}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEdit}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <EditIcon className="w-4 h-4" />
            </Button>
          </div>
        )}

        {isModified && !isEditing && (
          <p className="text-xs text-amber-600 mt-1">
            * Transcript has been edited
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isLoading}
          >
            <RefreshIcon className="w-4 h-4 mr-1" />
            Re-record
          </Button>
        )}
        <div className={onRetry ? '' : 'ml-auto'}>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading || !editedTranscript.trim()}
          >
            <CheckIcon className="w-4 h-4 mr-1" />
            Confirm
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default TranscriptPreview;
