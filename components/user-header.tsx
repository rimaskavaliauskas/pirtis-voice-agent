'use client';

import React from 'react';
import { useUI } from './ui-provider';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';

export function UserHeader() {
    const { userMode, userData, setUserMode, setUserData } = useUI();
    const router = useRouter();

    const handleLogout = () => {
        setUserMode('guest');
        setUserData(null);
        router.push('/');
    };

    return (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-3">
            {userMode === 'auth' ? (
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-primary/20 rounded-full px-4 py-1.5 shadow-lg border-primary/30">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-medium text-white max-w-[120px] truncate">
                        {userData?.name || userData?.email}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="ml-2 p-1 hover:text-primary text-gray-400 transition-colors"
                        title="Logout"
                    >
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md border border-white/5 rounded-full px-4 py-1.5 opacity-60 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                        Guest Mode
                    </span>
                </div>
            )}
        </div>
    );
}
