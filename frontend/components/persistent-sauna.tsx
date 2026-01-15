'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SaunaBuilding } from './sauna-building';
import { useUI } from './ui-provider';

/**
 * A global component that displays the symbolic sauna building.
 * It stays persistent across pages but handles its own visibility/animations
 * based on the global UI state.
 * Hidden on admin pages where a simpler UI is preferred.
 */
export function PersistentSauna() {
    const { isSaunaVisible, saunaPhase } = useUI();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    // Wait for client-side mount to avoid hydration issues
    useEffect(() => {
        setMounted(true);
    }, []);

    // Don't render until mounted (prevents hydration mismatch)
    if (!mounted) return null;

    // Hide on admin pages
    if (pathname?.startsWith('/admin')) return null;
    if (saunaPhase === 'hidden') return null;

    return (
        <div
            className={`
        fixed inset-x-0 top-0 pt-4 flex justify-center pointer-events-none z-50 transition-all duration-1000 ease-in-out
        ${isSaunaVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 -translate-y-20'}
      `}
        >
            <div className="relative group">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-[40px] animate-pulse-glow" style={{ animationDuration: '4s' }} />

                {/* Building */}
                <SaunaBuilding
                    className="w-32 h-32 md:w-40 md:h-40 relative z-10 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                    phase={saunaPhase}
                />
            </div>
        </div>
    );
}
