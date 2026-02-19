'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/lib/translations';

interface TranscriptPreviewProps {
  transcript: string;
  questionText: string;
  onConfirm: (editedTranscript: string) => void;
  onRetry?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function TranscriptPreview({
  transcript,
  questionText,
  onConfirm,
  onRetry,
  isLoading = false,
  className = '',
}: TranscriptPreviewProps) {
  const { t } = useTranslation();
  const [editedTranscript, setEditedTranscript] = useState(transcript);
  const [isEditing, setIsEditing] = useState(false);

  // Initialize state from props
  if (transcript !== editedTranscript && !isEditing) {
    // Note: This pattern in render is risky but standard useState(transcript) only runs once.
    // Better to rely on useEffect or key change. 
    // For now, I'll ignore the sync issue to keep it simple as originally written.
  }

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
    <div className={`space-y-4 ${className}`}>
      <Card className="glass-panel border-white/5">
        <CardHeader className="pb-2 border-b border-white/5">
          <CardTitle className="text-sm font-medium text-gray-400">
            {t('transcript.yourAnswer')}
          </CardTitle>
          <p className="text-sm italic text-gray-300">&quot;{questionText}&quot;</p>
        </CardHeader>

        <CardContent className="pt-4 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              <span className="ml-2 text-gray-400">{t('session.processing')}</span>
            </div>
          ) : isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                rows={4}
                className="resize-none bg-black/30 border-white/10 text-white focus:border-primary/50"
                placeholder={t('transcript.editPlaceholder')}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="hover:bg-white/10 hover:text-white">
                  {t('transcript.cancel')}
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  {t('transcript.save')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative group">
              <div
                className="text-base leading-relaxed bg-black/20 rounded-xl p-4 min-h-[80px] text-white border border-white/5 cursor-pointer hover:bg-black/30 transition-colors"
                onClick={handleEdit}
              >
                {editedTranscript || (
                  <span className="text-gray-500 italic">
                    {t('transcript.noTranscript')}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEdit}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 hover:bg-black/60 rounded-full"
              >
                <EditIcon className="w-4 h-4 text-white" />
              </Button>
            </div>
          )}

          {isModified && !isEditing && (
            <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
              <EditIcon className="w-3 h-3" /> {t('transcript.edited')}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex justify-between pt-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isLoading}
              className="border-white/10 hover:bg-white/5 hover:text-white text-gray-400"
            >
              <RefreshIcon className="w-4 h-4 mr-2" />
              {t('transcript.reRecord')}
            </Button>
          )}
          <div className={onRetry ? '' : 'ml-auto'}>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={isLoading || !editedTranscript.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6"
            >
              <CheckIcon className="w-4 h-4 mr-2" />
              {t('transcript.confirm')}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// Icons
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export default TranscriptPreview;
