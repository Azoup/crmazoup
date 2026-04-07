import { useState, useEffect, useCallback } from 'react';
import { Lead } from '@/types/lead';

function parseDateLocal(dateStr: string): Date {
  const cleanStr = dateStr
    .replace(/[+-]\d{2}(:\d{2})?$/, '')
    .replace('Z', '')
    .trim();

  if (cleanStr.includes('T')) {
    const [datePart, timePart] = cleanStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const timeParts = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, timeParts[0] || 0, timeParts[1] || 0);
  }
  const [year, month, day] = cleanStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function useReturnReminder(leads: Lead[]) {
  const [pendingReturn, setPendingReturn] = useState<Lead | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    // Load from localStorage so dismissals persist across page refreshes
    try {
      const saved = localStorage.getItem('azoup-return-completed');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [soundPlayed, setSoundPlayed] = useState<Set<string>>(new Set());

  const playReturnSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.4, ctx.currentTime);
      master.connect(ctx.destination);

      const play = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(master);
        osc.frequency.value = freq;
        osc.type = 'sine';
        g.gain.setValueAtTime(0.4, start);
        g.gain.exponentialRampToValueAtTime(0.01, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };

      const t = ctx.currentTime;
      play(523.25, t, 0.15);        // C5
      play(659.25, t + 0.15, 0.15); // E5
      play(783.99, t + 0.3, 0.2);   // G5
    } catch {}
  }, []);

  const checkReturns = useCallback(() => {
    const now = new Date();

    const overdue = leads.filter(lead => {
      if (!lead.next_contact) return false;
      if (completedIds.has(lead.id)) return false;
      // Only active stages (not venda/perdidos/congelados)
      if (['venda', 'perdidos', 'congelados'].includes(lead.stage)) return false;

      const contactTime = parseDateLocal(lead.next_contact);
      return contactTime <= now;
    });

    if (overdue.length > 0 && !pendingReturn) {
      const lead = overdue[0];
      setPendingReturn(lead);

      if (!soundPlayed.has(lead.id)) {
        playReturnSound();
        setSoundPlayed(prev => new Set([...prev, lead.id]));
      }
    }
  }, [leads, completedIds, pendingReturn, soundPlayed, playReturnSound]);

  useEffect(() => {
    checkReturns();
    const interval = setInterval(checkReturns, 30000);
    return () => clearInterval(interval);
  }, [checkReturns]);

  const markReturnCompleted = useCallback((leadId: string) => {
    setCompletedIds(prev => {
      const next = new Set([...prev, leadId]);
      localStorage.setItem('azoup-return-completed', JSON.stringify([...next]));
      return next;
    });
    setPendingReturn(null);
  }, []);

  const dismissReturn = useCallback((leadId: string) => {
    // Just dismiss for now without marking completed - will show again on next cycle
    setPendingReturn(null);
  }, []);

  return { pendingReturn, markReturnCompleted, dismissReturn };
}
