import { useState, useEffect, useCallback } from 'react';
import { Lead } from '@/types/lead';

export function useProposalReminder(leads: Lead[]) {
  const [pendingProposal, setPendingProposal] = useState<Lead | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [soundPlayed, setSoundPlayed] = useState<Set<string>>(new Set());

  const playAlertSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.5, audioContext.currentTime);
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

      const t = audioContext.currentTime;
      // Urgent but pleasant: descending alert pattern
      playNote(880, t, 0.15, 'sine', 0.4);          // A5
      playNote(659.25, t + 0.15, 0.15, 'sine', 0.4); // E5
      playNote(880, t + 0.35, 0.15, 'sine', 0.4);    // A5
      playNote(659.25, t + 0.5, 0.15, 'sine', 0.4);  // E5
      playNote(880, t + 0.7, 0.3, 'sine', 0.35);     // A5 hold
      playNote(1108.73, t + 0.7, 0.3, 'triangle', 0.15); // C#6 harmony
    } catch {
      // Audio not available
    }
  }, []);

  const checkProposals = useCallback(() => {
    const now = new Date();

    const overdueProposals = leads.filter(lead => {
      if (lead.stage !== 'proposta') return false;
      if (!lead.next_contact) return false;
      if (dismissedIds.has(lead.id)) return false;

      const contactTime = new Date(lead.next_contact);
      return contactTime < now;
    });

    if (overdueProposals.length > 0 && !pendingProposal) {
      const lead = overdueProposals[0];
      setPendingProposal(lead);

      // Play sound only once per lead per session
      if (!soundPlayed.has(lead.id)) {
        playAlertSound();
        setSoundPlayed(prev => new Set([...prev, lead.id]));
      }
    }
  }, [leads, dismissedIds, pendingProposal, soundPlayed, playAlertSound]);

  useEffect(() => {
    checkProposals();
    const interval = setInterval(checkProposals, 30000);
    return () => clearInterval(interval);
  }, [checkProposals]);

  const dismissProposalReminder = useCallback((leadId: string) => {
    setDismissedIds(prev => new Set([...prev, leadId]));
    setPendingProposal(null);
  }, []);

  return { pendingProposal, dismissProposalReminder };
}
