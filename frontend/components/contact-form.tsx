'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/translations';
import { useUI } from '@/components/ui-provider';
import type { ContactInfo } from '@/lib/types';

interface ContactFormProps {
  onSubmit: (contactInfo: ContactInfo) => void;
  onSkip: () => void;
  isLoading?: boolean;
  className?: string;
}

export function ContactForm({
  onSubmit,
  onSkip,
  isLoading = false,
  className = '',
}: ContactFormProps) {
  const { t } = useTranslation();
  const { userData } = useUI();

  const [name, setName] = useState(userData?.name || '');
  const [email, setEmail] = useState(userData?.email || '');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <Card className={`glass-panel border-white/5 ${className}`}>
      <CardContent className="pt-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-white">{t('contact.title')}</h2>
          <p className="text-sm text-gray-400">{t('contact.subtitle')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (required) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              {t('contact.name')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('contact.namePlaceholder')}
              required
              className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>

          {/* Email (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              {t('contact.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('contact.emailPlaceholder')}
              className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>

          {/* Phone (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              {t('contact.phone')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('contact.phonePlaceholder')}
              className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onSkip}
              disabled={isLoading}
              className="flex-1 border-white/10 hover:bg-white/5 text-gray-300"
            >
              {t('contact.skip')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="flex-1 bg-gradient-to-r from-primary to-amber-600 hover:to-amber-500 text-black font-semibold"
            >
              {isLoading ? (
                <LoadingSpinner className="w-5 h-5" />
              ) : (
                t('contact.submit')
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserIcon({ className }: { className?: string }) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
