'use client';

interface SteamAnimationProps {
  className?: string;
}

/**
 * Steam animation component with warm amber/orange tones
 * Creates floating steam particles that rise and fade
 */
export function SteamAnimation({ className = '' }: SteamAnimationProps) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Steam particles - multiple layers for depth */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="steam-particle absolute rounded-full blur-xl opacity-0"
          style={{
            left: `${10 + i * 12}%`,
            bottom: '-20%',
            width: `${40 + (i % 3) * 20}px`,
            height: `${40 + (i % 3) * 20}px`,
            background: `radial-gradient(circle,
              ${i % 2 === 0 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(249, 115, 22, 0.3)'} 0%,
              transparent 70%)`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${4 + (i % 3)}s`,
          }}
        />
      ))}

      {/* Ambient glow at the bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at bottom, rgba(251, 191, 36, 0.5) 0%, transparent 70%)',
        }}
      />

      {/* Subtle top fade for depth */}
      <div
        className="absolute top-0 left-0 right-0 h-24"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}

export default SteamAnimation;
