import { useState, useEffect } from 'react';
import { Shirt, Scissors } from 'lucide-react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedLogo({ size = 'md' }: AnimatedLogoProps) {
  const [phase, setPhase] = useState<'idle' | 'cutting' | 'cut'>('idle');

  const sizes = {
    sm: { container: 'h-8 w-8', shirt: 18, scissors: 12 },
    md: { container: 'h-10 w-10', shirt: 22, scissors: 14 },
    lg: { container: 'h-14 w-14', shirt: 28, scissors: 18 },
  };

  useEffect(() => {
    const runAnimation = () => {
      setPhase('cutting');
      setTimeout(() => setPhase('cut'), 500);
      setTimeout(() => setPhase('idle'), 1500);
    };

    const initialDelay = setTimeout(runAnimation, 1500);
    const interval = setInterval(runAnimation, 6000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  const { container, shirt, scissors } = sizes[size];

  return (
    <div className={`${container} relative flex items-center justify-center bg-card rounded-lg shadow-sm overflow-hidden flex-shrink-0`}>
      {/* Shirt */}
      <div className="relative z-10">
        <Shirt 
          className={`text-primary transition-all duration-300 ${phase === 'cut' ? 'opacity-70 scale-90' : ''}`}
          size={shirt}
          strokeWidth={2.5}
        />
        {/* Cut line */}
        {phase === 'cut' && (
          <div 
            className="absolute top-1/2 left-0 right-0 h-0.5 bg-destructive"
            style={{ 
              transform: 'translateY(-50%) rotate(-20deg)',
              boxShadow: '0 0 6px hsl(var(--destructive))'
            }}
          />
        )}
      </div>

      {/* Scissors */}
      <div 
        className={`absolute z-20 transition-all duration-500 ease-out ${
          phase === 'idle' 
            ? '-bottom-2 -right-2 rotate-12 opacity-60' 
            : phase === 'cutting'
              ? 'bottom-1/3 right-1/4 -rotate-45 opacity-100'
              : 'bottom-1/2 right-1/3 -rotate-45 opacity-100'
        }`}
      >
        <Scissors 
          className={`text-foreground transition-transform duration-200 ${phase !== 'idle' ? 'scale-110' : ''}`}
          size={scissors}
          strokeWidth={2}
        />
      </div>

      {/* Sparkles on cut */}
      {phase === 'cut' && (
        <>
          <span className="absolute top-1 left-1 w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
          <span className="absolute top-2 right-1 w-1 h-1 bg-primary rounded-full animate-ping" style={{ animationDelay: '100ms' }} />
          <span className="absolute bottom-1 left-2 w-1 h-1 bg-primary rounded-full animate-ping" style={{ animationDelay: '200ms' }} />
        </>
      )}
    </div>
  );
}
