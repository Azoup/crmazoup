import { useState, useEffect } from 'react';
import { Shirt, Scissors, Sparkles } from 'lucide-react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedLogo({ size = 'md' }: AnimatedLogoProps) {
  const [phase, setPhase] = useState<'idle' | 'pulse' | 'rotate' | 'glow'>('idle');

  const sizes = {
    sm: { container: 'h-8 w-8', shirt: 16, scissors: 10, sparkle: 8 },
    md: { container: 'h-11 w-11', shirt: 22, scissors: 12, sparkle: 10 },
    lg: { container: 'h-16 w-16', shirt: 30, scissors: 16, sparkle: 14 },
  };

  useEffect(() => {
    const runAnimation = () => {
      setPhase('pulse');
      setTimeout(() => setPhase('rotate'), 600);
      setTimeout(() => setPhase('glow'), 1400);
      setTimeout(() => setPhase('idle'), 2800);
    };

    const initialDelay = setTimeout(runAnimation, 1500);
    const interval = setInterval(runAnimation, 6000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  const { container, shirt, scissors, sparkle } = sizes[size];

  return (
    <div
      className={`${container} relative flex items-center justify-center rounded-2xl overflow-hidden flex-shrink-0`}
      style={{
        perspective: '800px',
        background: 'linear-gradient(145deg, hsl(var(--gradient-start)), hsl(var(--gradient-end)))',
        boxShadow: phase === 'glow'
          ? '0 0 24px hsl(var(--primary) / 0.5), 0 0 48px hsl(var(--primary) / 0.2), inset 0 1px 0 rgba(255,255,255,0.3)'
          : '0 4px 12px hsl(var(--primary) / 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
        transition: 'box-shadow 0.5s ease',
      }}
    >
      {/* Inner glow overlay */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 60%)',
        }}
      />

      {/* 3D rotating content */}
      <div
        style={{
          transform: phase === 'pulse'
            ? 'scale(1.15)'
            : phase === 'rotate'
              ? 'rotateY(360deg) scale(1.05)'
              : phase === 'glow'
                ? 'rotateY(0deg) scale(1.08)'
                : 'rotateY(0deg) scale(1)',
          transition: phase === 'rotate'
            ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformStyle: 'preserve-3d',
        }}
        className="relative z-10 flex items-center justify-center"
      >
        <Shirt
          className="text-primary-foreground drop-shadow-md"
          size={shirt}
          strokeWidth={2}
        />
        {/* Scissors overlay */}
        <div
          className="absolute -bottom-0.5 -right-0.5"
          style={{
            transform: phase === 'rotate' ? 'rotate(-45deg) scale(1.3)' : 'rotate(-12deg) scale(1)',
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            opacity: phase === 'idle' ? 0.75 : 1,
          }}
        >
          <Scissors
            className="text-primary-foreground/90"
            size={scissors}
            strokeWidth={2.5}
          />
        </div>
      </div>

      {/* Premium shine sweep */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.35) 48%, rgba(255,255,255,0.1) 52%, transparent 65%)',
          transform: phase === 'rotate' || phase === 'glow' ? 'translateX(120%)' : 'translateX(-120%)',
          transition: 'transform 0.7s ease',
        }}
      />

      {/* Sparkle particles */}
      {(phase === 'glow' || phase === 'pulse') && (
        <>
          <Sparkles
            size={sparkle}
            className="absolute top-0 right-0 text-primary-foreground/90 animate-ping"
            style={{ animationDuration: '0.8s' }}
          />
          <span className="absolute bottom-0.5 left-1 w-1.5 h-1.5 bg-primary-foreground/70 rounded-full animate-ping" style={{ animationDuration: '0.6s', animationDelay: '200ms' }} />
        </>
      )}
    </div>
  );
}
