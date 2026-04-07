import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useCelebration() {
  const celebrateMeeting = useCallback(() => {
    const duration = 3500;
    const end = Date.now() + duration;
    const colors = ['#F97316', '#EA580C', '#FB923C', '#FDBA74', '#FED7AA', '#FFD700'];

    // Staggered bursts from both sides
    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.6 },
        colors,
        shapes: ['circle', 'square'],
        gravity: 0.8,
        drift: 0.5,
        ticks: 200,
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.6 },
        colors,
        shapes: ['circle', 'square'],
        gravity: 0.8,
        drift: -0.5,
        ticks: 200,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Big center burst
    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 120,
        origin: { y: 0.55, x: 0.5 },
        colors,
        shapes: ['circle', 'square'],
        scalar: 1.4,
        gravity: 1,
        ticks: 250,
      });
    }, 300);

    // Second wave
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#FFD700', '#FFC107', '#F97316'],
        scalar: 1.1,
        gravity: 0.9,
      });
    }, 800);

    // Premium sound — ascending chord
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const play = (freq: number, start: number, dur: number, vol = 0.15) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g);
        g.connect(ac.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };
      const now = ac.currentTime;
      play(523.25, now, 0.2);
      play(659.25, now + 0.12, 0.2);
      play(783.99, now + 0.24, 0.35);
    } catch {}
  }, []);

  const celebrateSale = useCallback(() => {
    const duration = 5000;
    const end = Date.now() + duration;
    const colors = ['#22C55E', '#16A34A', '#4ADE80', '#86EFAC', '#FFD700', '#FFC107'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
        colors,
        gravity: 0.7,
        drift: 0.3,
        ticks: 300,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
        colors,
        gravity: 0.7,
        drift: -0.3,
        ticks: 300,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Triple explosion cascade
    confetti({
      particleCount: 180,
      spread: 180,
      origin: { y: 0.45 },
      colors,
      scalar: 1.6,
      shapes: ['circle', 'square'],
      gravity: 0.8,
      ticks: 350,
    });

    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 140,
        origin: { y: 0.4, x: 0.3 },
        colors: ['#FFD700', '#FFC107', '#22C55E', '#4ADE80'],
        scalar: 1.4,
        ticks: 300,
      });
    }, 400);

    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 140,
        origin: { y: 0.4, x: 0.7 },
        colors: ['#FFD700', '#FFC107', '#22C55E', '#4ADE80'],
        scalar: 1.4,
        ticks: 300,
      });
    }, 700);

    // Starfield finale
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 360,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#FFD700', '#FFC107'],
        scalar: 0.8,
        gravity: 0.3,
        ticks: 400,
        startVelocity: 30,
      });
    }, 1100);

    // Victory fanfare
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const play = (freq: number, start: number, dur: number, vol = 0.12) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g);
        g.connect(ac.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };
      const now = ac.currentTime;
      play(392, now, 0.15);        // G4
      play(523.25, now + 0.12, 0.15); // C5
      play(659.25, now + 0.24, 0.15); // E5
      play(783.99, now + 0.36, 0.4);  // G5
      play(1046.5, now + 0.55, 0.5);  // C6 (triumphant)
    } catch {}
  }, []);

  return { celebrateMeeting, celebrateSale };
}
