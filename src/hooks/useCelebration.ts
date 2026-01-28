import { useCallback } from 'react';
import confetti from 'canvas-confetti';

// Confetti com tema de confecção (laranja) para reuniões
export function useCelebration() {
  const celebrateMeeting = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    // Cores laranja do tema Azoup
    const colors = ['#F97316', '#EA580C', '#FB923C', '#FDBA74', '#FED7AA'];

    // Efeito de confete principal
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
        shapes: ['circle', 'square'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
        shapes: ['circle', 'square'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Explosão central com elementos de confecção (simulando bobinas, tesouras)
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors: colors,
        shapes: ['circle', 'square'],
        scalar: 1.2,
      });
    }, 250);

    // Som de buzina (opcional - usando Web Audio API)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio não disponível, continua sem som
    }
  }, []);

  const celebrateSale = useCallback(() => {
    const duration = 4000;
    const end = Date.now() + duration;

    // Cores verdes para celebrar venda
    const colors = ['#22C55E', '#16A34A', '#4ADE80', '#86EFAC', '#BBF7D0'];

    // Efeito de confete contínuo
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Explosão central grande (troféu)
    confetti({
      particleCount: 150,
      spread: 180,
      origin: { y: 0.5 },
      colors: colors,
      scalar: 1.5,
      shapes: ['circle', 'square'],
    });

    // Segunda explosão após delay
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.4, x: 0.5 },
        colors: [...colors, '#FFD700', '#FFC107'], // Adiciona dourado
        scalar: 1.3,
      });
    }, 500);

    // Som de vitória
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playNote = (freq: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      // Melodia de vitória
      const now = audioContext.currentTime;
      playNote(523.25, now, 0.15); // C5
      playNote(659.25, now + 0.15, 0.15); // E5
      playNote(783.99, now + 0.3, 0.3); // G5
    } catch (e) {
      // Audio não disponível
    }
  }, []);

  return { celebrateMeeting, celebrateSale };
}
