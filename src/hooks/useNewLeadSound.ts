import { useCallback, useRef } from 'react';

export function useNewLeadSound() {
  const lastPlayedRef = useRef<number>(0);

  const playNewLeadSound = useCallback(() => {
    // Throttle: don't play more than once every 3 seconds
    const now = Date.now();
    if (now - lastPlayedRef.current < 3000) return;
    lastPlayedRef.current = now;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.45, audioContext.currentTime);
      masterGain.connect(audioContext.destination);

      const playNote = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', volume = 0.4) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(masterGain);

        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioContext.currentTime;

      // Bright, uplifting 4-note chime melody
      playNote(783.99, now, 0.18, 'sine', 0.35);        // G5
      playNote(987.77, now + 0.12, 0.18, 'sine', 0.4);  // B5
      playNote(1174.66, now + 0.24, 0.18, 'sine', 0.4); // D6
      playNote(1567.98, now + 0.36, 0.4, 'sine', 0.35); // G6 (hold)

      // Subtle harmonic shimmer
      playNote(1174.66, now + 0.36, 0.35, 'triangle', 0.15); // D6 harmony
      playNote(1318.51, now + 0.42, 0.3, 'triangle', 0.1);   // E6 sparkle

    } catch (e) {
      // Audio not available, silently fail
    }
  }, []);

  return { playNewLeadSound };
}
