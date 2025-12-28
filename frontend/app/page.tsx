'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startSession } from '@/lib/api';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'lt', label: 'Lietuvių', flag: '🇱🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('lt');

  const handleStartInterview = async () => {
    setIsLoading(true);
    try {
      const response = await startSession(selectedLanguage);
      router.push(`/session/${response.session_id}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <SaunaIcon className="w-20 h-20 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Pirtis Design Interview
          </h1>
          <p className="text-xl text-muted-foreground">
            AI-powered voice interview for personalized sauna recommendations
          </p>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              A short voice interview to understand your sauna needs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <StepCard
                number={1}
                title="Round 1"
                description="Tell us about your usage scenario, who will use the sauna, and your rituals"
              />
              <StepCard
                number={2}
                title="Round 2"
                description="Discuss location, infrastructure, and technical requirements"
              />
              <StepCard
                number={3}
                title="Round 3"
                description="Clarify details, priorities, budget, and timeline"
              />
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">What you will get:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Personalized sauna design direction</li>
                <li>• Recommendations for stove type and microclimate</li>
                <li>• Room program and size guidance</li>
                <li>• Checklist of items to clarify</li>
                <li>• Identified risks and how to address them</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Language Selector */}
        <div className="flex justify-center gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLanguage(lang.code)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                selectedLanguage === lang.code
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>

        {/* Start Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleStartInterview}
            disabled={isLoading}
            className="px-8 py-6 text-lg"
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="w-5 h-5 mr-2" />
                Starting...
              </>
            ) : (
              <>
                <MicIcon className="w-5 h-5 mr-2" />
                Start Interview
              </>
            )}
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          The interview takes approximately 5-10 minutes.
          <br />
          Your responses are processed securely.
        </p>
      </div>
    </main>
  );
}

// ============================================
// Helper Components
// ============================================

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-4 rounded-lg bg-muted/50">
      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
        {number}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function SaunaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
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
