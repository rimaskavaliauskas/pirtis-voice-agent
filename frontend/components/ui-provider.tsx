'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export type UserMode = 'guest' | 'auth';

interface UIContextType {
  isSaunaVisible: boolean;
  setSaunaVisible: (visible: boolean) => void;
  saunaPhase: 'idle' | 'active' | 'finalizing' | 'hidden';
  setSaunaPhase: (phase: 'idle' | 'active' | 'finalizing' | 'hidden') => void;
  userMode: UserMode;
  setUserMode: (mode: UserMode) => void;
  userData: { email?: string; name?: string } | null;
  setUserData: (data: { email?: string; name?: string } | null) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSaunaVisible, setSaunaVisible] = useState(true);
  const [saunaPhase, setSaunaPhase] = useState<'idle' | 'active' | 'finalizing' | 'hidden'>('idle');
  const [userMode, setUserMode] = useState<UserMode>('guest');
  const [userData, setUserData] = useState<{ email?: string; name?: string } | null>(null);

  // Logic to control sauna visibility based on page
  useEffect(() => {
    if (pathname.startsWith('/results') || pathname.startsWith('/session')) {
      // Hide sauna on session and results pages to avoid overlap with content
      setSaunaVisible(false);
      setSaunaPhase('hidden');
    } else if (pathname === '/') {
      setSaunaVisible(true);
      setSaunaPhase('idle');
    }
  }, [pathname]);

  return (
    <UIContext.Provider value={{
      isSaunaVisible,
      setSaunaVisible,
      saunaPhase,
      setSaunaPhase,
      userMode,
      setUserMode,
      userData,
      setUserData
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
