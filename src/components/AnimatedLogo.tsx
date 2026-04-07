import { useState, useEffect } from 'react';
import { Shirt, Scissors } from 'lucide-react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedLogo({ size = 'md' }: AnimatedLogoProps) {
  const [phase, setPhase] = useState<'idle' | 'rotate' | 'glow'>('idle');

  const sizes = {
    sm: { container: 'h-8 w-8', shirt: 18, scissors: 12 },
    md: { container: 'h-10 w-10', shirt: 22, scissors: 14 },
    lg: { container: 'h-14 w-14', shirt: 28, scissors: 18 },
  };

  useEffect(() => {
    const runAnimation = () => {
      setPhase('rotate');
      setTimeout(() => setPhase('glow'), 800);
      setTimeout(() => setPhase('idle'), 2000);
    };

    const initialDelay = setTimeout(runAnimation, 2000);
    const interval = setInterval(runAnimation, 8000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  const { container, shirt, scissors } = sizes[size];

  return (
    <div
      className={`${container} relative flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0`}
      style={{
        perspective: '600px',
        background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))',
        boxShadow: phase === 'glow'
          ? '0 0 20px hsl(var(--primary) / 0.6), 0 0 40px hsl(var(--primary) / 0.3)'
          : '0 2px 8px hsl(var(--primary) / 0.3)',
        transition: 'box-shadow 0.6s ease',
      }}
    >
      {/* 3D rotating container */}
      <div
        style={{
          transform: phase === 'rotate'
            ? 'rotateY(360deg) scale(1.05)'
            : phase === 'glow'
              ? 'rotateY(0deg) scale(1.1)'
              : 'rotateY(0deg) scale(1)',
          transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          transformStyle: 'preserve-3d',
        }}
        className="relative z-10 flex items-center justify-center"
      >
        <Shirt
          className="text-primary-foreground drop-shadow-lg"
          size={shirt}
          strokeWidth={2}
        />
        {/* Scissors overlay */}
        <div
          className="absolute -bottom-0.5 -right-0.5"
          style={{
            transform: phase === 'rotate' ? 'rotate(-45deg) scale(1.2)' : 'rotate(-12deg) scale(1)',
            transition: 'transform 0.6s ease',
            opacity: phase === 'idle' ? 0.7 : 1,
          }}
        >
          <Scissors
            className="text-primary-foreground/90"
            size={scissors}
            strokeWidth={2}
          />
        </div>
      </div>

      {/* Shine effect */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)',
          transform: phase === 'rotate' ? 'translateX(100%)' : 'translateX(-100%)',
          transition: 'transform 0.8s ease',
        }}
      />

      {/* Glow particles */}
      {phase === 'glow' && (
        <>
          <span className="absolute top-0.5 left-1 w-1 h-1 bg-primary-foreground/80 rounded-full animate-ping" />
          <span className="absolute bottom-0.5 right-1 w-1 h-1 bg-primary-foreground/60 rounded-full animate-ping" style={{ animationDelay: '150ms' }} />
        </>
      )}
    </div>
  );
}
