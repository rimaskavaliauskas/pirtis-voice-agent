'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { startSession } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation, type Language } from '@/lib/translations';
import { useUI } from '@/components/ui-provider';
import type { InterviewMode } from '@/lib/types';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'lt', label: 'Lietuvių', flag: '🇱🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectionPhase, setSelectionPhase] = useState<'choosing' | 'acting'>('choosing');
  const [selectedModel, setSelectedModel] = useState<'short' | 'premium' | null>(null);
  const { t, language, setLanguage } = useTranslation();
  const { setSaunaPhase, setSaunaVisible, setUserMode, setUserData } = useUI();

  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // Reset phase when landing
  useEffect(() => {
    setSaunaPhase('idle');
    setSaunaVisible(true);
  }, [setSaunaPhase, setSaunaVisible]);

  const handleSelectModel = (model: 'short' | 'premium') => {
    setSelectedModel(model);
    setSelectionPhase('acting');
  };

  const handleStartInterview = async () => {
    setIsLoading(true);
    const isGuest = selectedModel === 'short';

    if (!isGuest && (!emailInput || !nameInput)) {
      toast.error('Please enter your details');
      setIsLoading(false);
      return;
    }

    if (!isGuest) {
      setUserData({ name: nameInput, email: emailInput });
      setUserMode('auth');
    } else {
      setUserMode('guest');
    }

    try {
      // Use 'quick' for guest, 'precise' for premium (assuming backend supports/maps these)
      // If the backend only uses 'quick' for both, we keep 'quick'
      const response = await startSession(language, isGuest ? 'quick' : 'precise');
      router.push(`/session/${response.session_id}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[oklch(0.1_0.02_260)]">
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Global Navigation Labels */}
      <nav className="fixed top-6 left-6 z-[100] hidden md:flex items-center gap-6">
        <button className="text-sm font-bold uppercase tracking-widest text-white/40 hover:text-primary transition-colors cursor-not-allowed" title="Coming Soon">
          Portfolio
        </button>
        <button className="text-sm font-bold uppercase tracking-widest text-white/40 hover:text-primary transition-colors cursor-not-allowed" title="Coming Soon">
          Expertise
        </button>
      </nav>

      <nav className="fixed top-6 right-6 z-[100] hidden md:flex items-center gap-6">
        <div className="flex bg-black/40 backdrop-blur-md border border-white/5 rounded-full p-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${language === lang.code ? 'bg-primary text-black font-bold' : 'text-gray-400 hover:text-white'}`}
            >
              {lang.code.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-5xl w-full space-y-12 z-10 transition-all duration-700">

        {/* Hero Section */}
        <div className={`text-center space-y-4 animate-float ${selectionPhase === 'acting' ? 'opacity-40 scale-95 blur-sm mt-[-10vh]' : 'pt-32'}`}>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-2xl">
            {t('landing.title')}
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {t('landing.subtitle')}
          </p>
        </div>

        {selectionPhase === 'choosing' ? (
          /* Step 1: Model Selection */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto animate-in fade-in zoom-in duration-500">

            {/* Short Model Choice */}
            <div
              onClick={() => handleSelectModel('short')}
              className="group cursor-pointer glass-panel p-10 border-white/5 bg-white/5 hover:bg-white/10 hover:border-primary/30 transition-all duration-500 rounded-3xl relative overflow-hidden flex flex-col items-center text-center space-y-6"
            >
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <FlashIcon className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white group-hover:text-primary transition-colors">{t('landing.shortInterview')}</h2>
                <p className="text-gray-400 leading-relaxed">{t('landing.shortInterviewDesc')}</p>
              </div>
              <div className="pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-primary text-sm font-bold uppercase tracking-widest">{t('landing.selectModel')}</span>
              </div>
            </div>

            {/* Premium Model Choice */}
            <div
              onClick={() => handleSelectModel('premium')}
              className="group cursor-pointer glass-panel p-10 border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-500 rounded-3xl relative overflow-hidden flex flex-col items-center text-center space-y-6"
            >
              <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                <ExpertIcon className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white group-hover:text-amber-500 transition-colors">{t('landing.professionalSession')}</h2>
                <p className="text-gray-400 leading-relaxed">{t('landing.professionalSessionDesc')}</p>
              </div>
              <div className="pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-amber-500 text-sm font-bold uppercase tracking-widest">{t('landing.selectModel')}</span>
              </div>
            </div>

          </div>
        ) : (
          /* Step 2: Configuration & Start */
          <div className="max-w-xl mx-auto animate-in slide-in-from-bottom-12 fade-in duration-700">
            <Card className={`glass-panel border-white/10 overflow-hidden ${selectedModel === 'premium' ? 'border-primary/20' : ''}`}>
              <CardContent className="p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white">
                      {selectedModel === 'short' ? t('landing.shortInterview') : t('landing.professionalSession')}
                    </h2>
                    <p className="text-sm text-gray-500">{t('landing.configureSession')}</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectionPhase('choosing')}
                    className="text-gray-500 hover:text-white"
                  >
                    {t('landing.switchMode')}
                  </Button>
                </div>

                {selectedModel === 'premium' && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-primary font-bold">{t('landing.yourName')}</label>
                      <input
                        type="text"
                        placeholder={t('landing.enterName')}
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-primary font-bold">{t('landing.emailAddress')}</label>
                      <input
                        type="email"
                        placeholder={t('landing.enterEmail')}
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleStartInterview}
                  disabled={isLoading}
                  className={`w-full h-16 text-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${selectedModel === 'premium' ? 'bg-primary text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {isLoading ? <LoadingSpinner /> : t('landing.launchPhase')}
                </Button>

                <p className="text-center text-xs text-gray-600">
                  {t('landing.agreeTerms')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer info (only visible in choosing phase) */}
        {selectionPhase === 'choosing' && (
          <div className="flex flex-wrap justify-center gap-8 text-center text-sm text-gray-500 opacity-60 animate-in fade-in duration-1000">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              AI Architect
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Infrastructure Analysis
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Icons
function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function FlashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function ExpertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
