'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { startSession } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation, type Language } from '@/lib/translations';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'lt', label: 'Lietuvių', flag: '🇱🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { t, language, setLanguage } = useTranslation();

  const handleStartInterview = async () => {
    setIsLoading(true);
    try {
      const response = await startSession(language);
      router.push(`/session/${response.session_id}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDuration: '10s', animationDelay: '1s' }} />

        {/* Steam Particles */}
        <div className="steam-particle absolute bottom-0 left-1/3 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="steam-particle absolute bottom-0 right-1/3 w-40 h-40 bg-white/5 rounded-full blur-2xl" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-4xl w-full space-y-12 z-10">

        {/* Hero Section */}
        <div className="text-center space-y-6 animate-float">
          <div className="flex justify-center mb-6">
            <div className="p-6 rounded-full bg-card/30 backdrop-blur-md border border-primary/20 shadow-[0_0_30px_rgba(251,191,36,0.2)]">
              <SaunaIcon className="w-20 h-20 text-primary animate-pulse-glow" style={{ filter: 'drop-shadow(0 0 10px var(--primary))' }} />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
            {t('landing.title')}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {t('landing.subtitle')}
            <br />
            <span className="text-sm opacity-70">{t('landing.tagline')}</span>
          </p>
        </div>

        {/* Action Panel */}
        <Card className="glass-panel border-white/5 mx-auto max-w-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <CardContent className="p-8 space-y-8 relative">

            {/* Language Selection */}
            <div className="space-y-3 text-center">
              <span className="text-sm uppercase tracking-widest text-muted-foreground">{t('landing.selectLanguage')}</span>
              <div className="flex justify-center gap-3">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`
                       px-6 py-3 rounded-xl border transition-all duration-300 flex items-center gap-2
                       ${language === lang.code
                        ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-105'
                        : 'bg-black/20 text-gray-400 border-white/5 hover:border-white/20 hover:bg-black/40'}
                     `}
                  >
                    <span className="text-xl">{lang.flag}</span>
                    <span className="font-medium">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Action */}
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={handleStartInterview}
                disabled={isLoading}
                className={`
                   relative overflow-hidden transition-all duration-500
                   h-auto px-12 py-6 text-xl rounded-2xl
                   bg-gradient-to-r from-primary to-amber-600 hover:to-amber-500
                   text-black font-bold shadow-[0_0_40px_rgba(251,191,36,0.3)]
                   hover:shadow-[0_0_60px_rgba(251,191,36,0.5)] hover:scale-105
                   disabled:opacity-70 disabled:grayscale
                 `}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse-glow mix-blend-overlay" />
                <span className="relative flex items-center gap-3">
                  {isLoading ? (
                    <>
                      <LoadingSpinner className="w-6 h-6" />
                      {t('landing.initializing')}
                    </>
                  ) : (
                    <>
                      <MicIcon className="w-6 h-6" />
                      {t('landing.startButton')}
                    </>
                  )}
                </span>
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm text-gray-400 opacity-60">
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5">
            <span className="block text-primary text-lg mb-1">①</span>
            {t('landing.steps.share')}
          </div>
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5">
            <span className="block text-primary text-lg mb-1">②</span>
            {t('landing.steps.discuss')}
          </div>
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5">
            <span className="block text-primary text-lg mb-1">③</span>
            {t('landing.steps.plan')}
          </div>
        </div>
      </div>
    </main>
  );
}

// Icons
function SaunaIcon({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M4 21V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11" />
      <path d="M9 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
