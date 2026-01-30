import { useState, useEffect } from 'react';
import { Shirt, Scissors } from 'lucide-react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedLogo({ size = 'md' }: AnimatedLogoProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCut, setShowCut] = useState(false);

  const sizes = {
    sm: { container: 'h-8 w-8', shirt: 20, scissors: 10 },
    md: { container: 'h-10 w-10', shirt: 24, scissors: 12 },
    lg: { container: 'h-14 w-14', shirt: 32, scissors: 16 },
  };

  useEffect(() => {
    // Start animation loop
    const startAnimation = () => {
      setIsAnimating(true);
      setShowCut(false);
      
      // After scissors reach the shirt, show cut effect
      setTimeout(() => {
        setShowCut(true);
      }, 600);
      
      // Reset animation
      setTimeout(() => {
        setIsAnimating(false);
        setShowCut(false);
      }, 1500);
    };

    // Initial delay before first animation
    const initialDelay = setTimeout(startAnimation, 2000);
    
    // Repeat animation every 8 seconds
    const interval = setInterval(startAnimation, 8000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  const { container, shirt, scissors } = sizes[size];

  return (
    <div className={`bg-card p-1 rounded-lg shadow-sm ${container} flex items-center justify-center relative overflow-hidden flex-shrink-0`}>
      {/* Shirt with cut effect */}
      <div className={`relative transition-all duration-300 ${showCut ? 'opacity-80' : ''}`}>
        <Shirt 
          className={`text-primary transition-all duration-300 ${showCut ? 'scale-95' : ''}`} 
          size={shirt} 
          strokeWidth={2.5} 
        />
        
        {/* Cut line effect */}
        {showCut && (
          <div 
            className="absolute top-1/2 left-0 w-full h-0.5 bg-destructive animate-pulse"
            style={{
              transform: 'translateY(-50%) rotate(-15deg)',
              boxShadow: '0 0 4px hsl(var(--destructive))',
            }}
          />
        )}
      </div>
      
      {/* Animated Scissors */}
      <div 
        className={`absolute bg-card rounded-full p-0.5 border border-border shadow-sm transition-all duration-700 ease-in-out ${
          isAnimating 
            ? 'bottom-1/3 right-1/4 rotate-[-45deg]' 
            : '-bottom-1 -right-1 rotate-[-12deg]'
        }`}
        style={{
          transform: isAnimating 
            ? 'translate(0, 0) rotate(-45deg)' 
            : 'translate(0, 0) rotate(-12deg)',
        }}
      >
        <Scissors 
          className={`text-foreground transition-transform duration-200 ${isAnimating ? 'scale-110' : ''}`} 
          size={scissors} 
          strokeWidth={2} 
        />
      </div>
      
      {/* Sparkle effect when cutting */}
      {showCut && (
        <>
          <div className="absolute top-1 left-1 w-1 h-1 bg-primary rounded-full animate-ping" />
          <div className="absolute top-2 right-2 w-1 h-1 bg-primary rounded-full animate-ping" style={{ animationDelay: '0.1s' }} />
          <div className="absolute bottom-2 left-2 w-0.5 h-0.5 bg-primary rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
        </>
      )}
    </div>
  );
}
