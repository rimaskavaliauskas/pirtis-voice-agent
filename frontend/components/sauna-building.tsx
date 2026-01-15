'use client';

import React from 'react';

interface SaunaBuildingProps {
    className?: string;
    style?: React.CSSProperties;
    phase?: 'idle' | 'active' | 'finalizing' | 'hidden';
}

/**
 * A symbolic, premium sauna building SVG.
 * Features a modern pitched-roof cabin with a high-fidelity slatted wood texture to match the premium mockup.
 */
export function SaunaBuilding({ className, style, phase = 'idle' }: SaunaBuildingProps) {
    return (
        <svg
            className={className}
            style={style}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                {/* Roof Gradient for depth */}
                <linearGradient id="roofGradient" x1="60" y1="15" x2="60" y2="65" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="oklch(0.35 0.05 260)" />
                    <stop offset="100%" stopColor="oklch(0.15 0.03 260)" />
                </linearGradient>

                {/* Slatted wood texture pattern */}
                <pattern id="slatPattern" x="0" y="0" width="3" height="120" patternUnits="userSpaceOnUse">
                    <rect width="2.2" height="120" fill="oklch(0.20 0.03 260)" />
                    <rect x="2.2" width="0.8" height="120" fill="oklch(0.12 0.02 260)" />
                </pattern>

                {/* Outer Glow filter */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* Inner Window Glow filter */}
                <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feFlood floodColor="var(--primary)" floodOpacity="0.8" />
                    <feComposite in2="blur" operator="in" />
                    <feComposite in="SourceGraphic" operator="over" />
                </filter>
            </defs>

            {/* Background Glow (Aura) */}
            <circle
                cx="60" cy="70" r="40"
                fill="var(--primary)"
                fillOpacity={phase === 'active' ? '0.15' : '0.05'}
                className="transition-all duration-1000"
                filter="blur(15px)"
            />

            {/* Chimney Steam */}
            {phase !== 'hidden' && (
                <g className="animate-pulse">
                    <path
                        d="M85 22 Q95 12 85 2"
                        stroke="var(--primary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="opacity-40 animate-float"
                        style={{ animationDelay: '0s', animationDuration: '4s' }}
                    />
                    <path
                        d="M88 25 Q98 15 88 5"
                        stroke="var(--primary)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="opacity-20 animate-float"
                        style={{ animationDelay: '1.5s', animationDuration: '5s' }}
                    />
                </g>
            )}

            {/* Main Building Frame */}
            <rect
                x="20" y="60" width="80" height="40"
                fill="oklch(0.15 0.03 260)"
                stroke="var(--primary)"
                strokeWidth="0.5"
                strokeOpacity="0.3"
            />

            {/* Premium Slatted Wood Texture */}
            <rect
                x="20" y="60" width="80" height="40"
                fill="url(#slatPattern)"
                className="brightness-110"
            />

            {/* Roof shadow on walls */}
            <path
                d="M20 60 L60 25 L100 60 Z"
                fill="black"
                fillOpacity="0.4"
            />

            {/* Main Pitched Roof */}
            <path
                d="M10 65 L60 15 L110 65"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="url(#roofGradient)"
            />

            {/* Decorative Ridge line on roof */}
            <path d="M15 63 L60 22 L105 63" stroke="white" strokeOpacity="0.05" strokeWidth="1" fill="none" />

            {/* Door - with light leak and handle */}
            <g>
                <rect
                    x="48" y="75" width="24" height="25"
                    fill="oklch(0.12 0.03 260)"
                    stroke="var(--primary)"
                    strokeWidth="1"
                    strokeOpacity="0.5"
                />
                {/* Amber vertical light leak line (the open door gap) */}
                <rect
                    x="49" y="76" width="1.5" height="23"
                    fill="var(--primary)"
                    className={`transition-all duration-1000 ${phase === 'active' ? 'opacity-100' : 'opacity-30'}`}
                    filter="url(#glow)"
                />
                <circle cx="65" cy="88" r="1" fill="var(--primary)" className="opacity-70" />
            </g>

            {/* Glowing Window */}
            <g filter={phase === 'active' || phase === 'finalizing' ? 'url(#innerGlow)' : ''}>
                <rect
                    x="28" y="72" width="14" height="14"
                    fill="var(--primary)"
                    fillOpacity={phase === 'active' || phase === 'finalizing' ? '0.6' : '0.1'}
                    className="transition-all duration-1000"
                />
                <rect
                    x="28" y="72" width="14" height="14"
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                />
                {/* Window cross frame */}
                <line x1="35" y1="72" x2="35" y2="86" stroke="black" strokeOpacity="0.3" strokeWidth="1" />
                <line x1="28" y1="79" x2="42" y2="79" stroke="black" strokeOpacity="0.3" strokeWidth="1" />
            </g>

            {/* Chimney */}
            <path
                d="M82 35 V23 H92 V42"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="square"
                className="brightness-75"
            />
            <rect x="80" y="21" width="14" height="2.5" fill="var(--primary)" className="brightness-90" />
        </svg>
    );
}
