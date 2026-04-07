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
    try {
      const saved = localStorage.getItem('azoup-return-completed');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [soundPlayed, setSoundPlayed] = useState<Set<string>>(new Set());

  // Snooze-all state
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('azoup-snooze-until');
      const val = saved ? Number(saved) : null;
      if (val && val > Date.now()) return val;
      localStorage.removeItem('azoup-snooze-until');
      return null;
    } catch { return null; }
  });
  const [snoozeCount, setSnoozeCount] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('azoup-snooze-count') || '{}');
      const today = new Date().toDateString();
      return saved.date === today ? (saved.count || 0) : 0;
    } catch { return 0; }
  });

  const isSnoozed = snoozeUntil !== null && Date.now() < snoozeUntil;
  const canSnooze = snoozeCount < 7;

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
      play(523.25, t, 0.15);
      play(659.25, t + 0.15, 0.15);
      play(783.99, t + 0.3, 0.2);
    } catch {}
  }, []);

  const checkReturns = useCallback(() => {
    if (isSnoozed) return;

    const now = new Date();

    const overdue = leads.filter(lead => {
      if (!lead.next_contact) return false;
      if (completedIds.has(lead.id)) return false;
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
  }, [leads, completedIds, pendingReturn, soundPlayed, playReturnSound, isSnoozed]);

  useEffect(() => {
    checkReturns();
    const interval = setInterval(checkReturns, 30000);
    return () => clearInterval(interval);
  }, [checkReturns]);

  // Check if snooze expired
  useEffect(() => {
    if (!snoozeUntil) return;
    const remaining = snoozeUntil - Date.now();
    if (remaining <= 0) {
      setSnoozeUntil(null);
      localStorage.removeItem('azoup-snooze-until');
      return;
    }
    const timer = setTimeout(() => {
      setSnoozeUntil(null);
      localStorage.removeItem('azoup-snooze-until');
    }, remaining);
    return () => clearTimeout(timer);
  }, [snoozeUntil]);

  const markReturnCompleted = useCallback((leadId: string) => {
    setCompletedIds(prev => {
      const next = new Set([...prev, leadId]);
      localStorage.setItem('azoup-return-completed', JSON.stringify([...next]));
      return next;
    });
    setPendingReturn(null);
  }, []);

  const dismissReturn = useCallback((_leadId: string) => {
    setPendingReturn(null);
  }, []);

  const snoozeAll = useCallback(() => {
    if (!canSnooze) return;
    const until = Date.now() + 60 * 60 * 1000; // 1 hour
    setSnoozeUntil(until);
    localStorage.setItem('azoup-snooze-until', String(until));
    const newCount = snoozeCount + 1;
    setSnoozeCount(newCount);
    localStorage.setItem('azoup-snooze-count', JSON.stringify({ date: new Date().toDateString(), count: newCount }));
    setPendingReturn(null);
  }, [canSnooze, snoozeCount]);

  return { pendingReturn, markReturnCompleted, dismissReturn, snoozeAll, canSnooze, snoozeCount };
}
