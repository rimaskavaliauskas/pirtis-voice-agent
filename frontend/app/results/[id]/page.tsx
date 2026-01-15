'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReportPreview } from '@/components/report-preview';
import { FeedbackForm } from '@/components/feedback-form';
import { getResults, downloadReport, translateReport, isValidSessionId } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/translations';

// ============================================
// Types
// ============================================

type PageState = 'loading' | 'ready' | 'error';

// ============================================
// Component
// ============================================

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { t, language } = useTranslation();

  const [state, setState] = useState<PageState>('loading');
  const [markdown, setMarkdown] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [contactEmail, setContactEmail] = useState<string | null>(null);

  // Translation state
  const [translatedMarkdown, setTranslatedMarkdown] = useState<string | null>(null);
  const [translationLanguage, setTranslationLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [autoTranslated, setAutoTranslated] = useState(false);

  // Load results
  useEffect(() => {
    if (!isValidSessionId(sessionId)) {
      setState('error');
      setError('Invalid session ID');
      return;
    }

    async function loadResults() {
      try {
        const response = await getResults(sessionId);
        setMarkdown(response.final_markdown);
        setEmailSent(response.email_sent || false);
        setContactEmail(response.contact_email || null);
        setState('ready');
      } catch (err) {
        console.error('Failed to load results:', err);
        setError('Failed to load results. Please try again.');
        setState('error');
      }
    }

    loadResults();
  }, [sessionId]);

  // Auto-translate report when language is not Lithuanian
  useEffect(() => {
    if (language === 'lt' || !markdown || autoTranslated) return;

    const autoTranslate = async () => {
      setIsTranslating(true);
      try {
        const response = await translateReport(sessionId, language);
        setTranslatedMarkdown(response.translated_markdown);
        setTranslationLanguage(language);
        setShowTranslation(true);
        setAutoTranslated(true);
      } catch (err) {
        console.error('Auto-translation failed:', err);
      } finally {
        setIsTranslating(false);
      }
    };

    autoTranslate();
  }, [sessionId, language, markdown, autoTranslated]);

  // Handle download
  const handleDownload = useCallback(async () => {
    try {
      const blob = await downloadReport(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pirtis-report-${sessionId.slice(0, 8)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded!');
    } catch (err) {
      // Fallback: download from state
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pirtis-report-${sessionId.slice(0, 8)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded!');
    }
  }, [sessionId, markdown]);

  // Handle start new
  const handleStartNew = useCallback(() => {
    router.push('/');
  }, [router]);

  // Handle translation toggle
  const handleTranslate = useCallback(async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    if (translatedMarkdown) {
      setShowTranslation(true);
      return;
    }

    setIsTranslating(true);
    try {
      const response = await translateReport(sessionId, translationLanguage);
      setTranslatedMarkdown(response.translated_markdown);
      setShowTranslation(true);
      toast.success(
        `Translated to ${translationLanguage === 'en' ? 'English' : translationLanguage === 'ru' ? 'Russian' : translationLanguage}`,
      );
    } catch (err) {
      console.error('Translation failed:', err);
      toast.error('Failed to translate. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  }, [sessionId, translationLanguage, translatedMarkdown, showTranslation]);

  // Handle download translation
  const handleDownloadTranslation = useCallback(async () => {
    setIsTranslating(true);
    try {
      let mdToDownload = translatedMarkdown;

      if (!mdToDownload) {
        const response = await translateReport(sessionId, translationLanguage);
        mdToDownload = response.translated_markdown;
        setTranslatedMarkdown(mdToDownload);
      }

      const blob = new Blob([mdToDownload], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pirtis-report-${sessionId.slice(0, 8)}-${translationLanguage}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Translated report downloaded!');
    } catch (err) {
      console.error('Translation download failed:', err);
      toast.error('Failed to download translation. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  }, [sessionId, translationLanguage, translatedMarkdown]);

  // Render loading state (including auto-translation)
  if (state === 'loading' || (language !== 'lt' && !autoTranslated && markdown)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner className="w-10 h-10 mx-auto" />
          <p className="text-muted-foreground">
            {state === 'loading' ? t('results.loading') : t('results.translating')}
          </p>
        </div>
      </main>
    );
  }

  // Render error state
  if (state === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ErrorIcon className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">{t('session.error')}</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push('/')}>{t('session.goHome')}</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <SuccessIcon className="w-16 h-16 mx-auto text-green-500" />
          <h1 className="text-2xl font-bold">{t('results.complete')}</h1>
          <p className="text-muted-foreground">
            {t('results.reportReady')}
          </p>
        </div>

        {/* Email Sent Notice */}
        {emailSent && (
          <Card className="glass-panel border-green-500/30 bg-green-500/10">
            <CardContent className="pt-4 flex items-center gap-3">
              <EmailIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400">
                  {t('results.emailSent')}
                </p>
                {contactEmail && (
                  <p className="text-xs text-green-500/80">
                    {t('results.sentTo', { email: contactEmail })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Translation Controls */}
        <Card className="glass-panel border-white/5">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <TranslateIcon className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-gray-300">{t('results.translateLabel')}</span>
                <div className="flex gap-2">
                  {[
                    { code: 'en', label: 'English', flag: 'EN' },
                    { code: 'ru', label: 'Russian', flag: 'RU' },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTranslationLanguage(lang.code);
                        setTranslatedMarkdown(null);
                        setShowTranslation(false);
                      }}
                      className={`px-3 py-1 text-sm rounded transition-all ${translationLanguage === lang.code
                          ? 'border border-primary bg-primary/20 text-primary font-bold shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                          : 'border border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                        }`}
                    >
                      {lang.flag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="border-white/10 hover:bg-white/5 text-gray-300"
                >
                  {isTranslating ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      {t('results.translating')}
                    </>
                  ) : showTranslation ? (
                    t('results.showOriginal')
                  ) : (
                    t('results.showTranslation')
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTranslation}
                  disabled={isTranslating}
                  className="border-white/10 hover:bg-white/5 text-gray-300"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  {t('results.downloadTranslation')}
                </Button>
              </div>
            </div>
            {showTranslation && (
              <p className="text-xs text-amber-500 mt-2 font-mono">
                Showing {translationLanguage === 'en' ? 'English' : 'Russian'} translation
              </p>
            )}
          </CardContent>
        </Card>

        {/* Report */}
        <ReportPreview
          markdown={showTranslation && translatedMarkdown ? translatedMarkdown : markdown}
          sessionId={sessionId}
          onDownload={showTranslation && translatedMarkdown ? handleDownloadTranslation : handleDownload}
          onStartNew={handleStartNew}
        />

        {/* Feedback Section */}
        <FeedbackForm
          sessionId={sessionId}
          className="max-w-xl mx-auto"
        />

        {/* Session Info */}
        <p className="text-center text-sm text-muted-foreground">
          {t('results.sessionId', { id: sessionId.slice(0, 8) + '...' })}
        </p>
      </div>
    </main>
  );
}

// ============================================
// Icons
// ============================================

function TranslateIcon({ className }: { className?: string }) {
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
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
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

function ErrorIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
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
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function SuccessIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
