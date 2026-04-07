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

export function useMeetingAlert(leads: Lead[]) {
  const [alertLead, setAlertLead] = useState<Lead | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [soundPlayedIds, setSoundPlayedIds] = useState<Set<string>>(new Set());

  const playAlertSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.6, ctx.currentTime);
      master.connect(ctx.destination);

      const play = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.5) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(master);
        osc.frequency.value = freq;
        osc.type = type;
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.01, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };

      const t = ctx.currentTime;
      // Urgent triple-bell pattern
      play(1046.5, t, 0.12, 'sine', 0.5);       // C6
      play(1318.5, t + 0.12, 0.12, 'sine', 0.5); // E6
      play(1568, t + 0.24, 0.2, 'sine', 0.5);    // G6
      // Repeat
      play(1046.5, t + 0.5, 0.12, 'sine', 0.45);
      play(1318.5, t + 0.62, 0.12, 'sine', 0.45);
      play(1568, t + 0.74, 0.25, 'sine', 0.5);
      // Harmonic shimmer
      play(2093, t + 0.74, 0.25, 'triangle', 0.15); // C7
    } catch {
      // Audio not available
    }
  }, []);

  const checkAlerts = useCallback(() => {
    const now = new Date();

    const upcoming = leads.filter(lead => {
      if (lead.stage !== 'reuniao') return false;
      if (!lead.meeting_date) return false;
      if (dismissedIds.has(lead.id)) return false;

      const meetingTime = parseDateLocal(lead.meeting_date);
      const diffMs = meetingTime.getTime() - now.getTime();
      const diffMins = diffMs / 60000;

      // Alert when 0 to 15 minutes before meeting
      return diffMins > 0 && diffMins <= 15;
    });

    if (upcoming.length > 0 && !alertLead) {
      const lead = upcoming[0];
      setAlertLead(lead);

      if (!soundPlayedIds.has(lead.id)) {
        playAlertSound();
        setSoundPlayedIds(prev => new Set([...prev, lead.id]));
      }
    }
  }, [leads, dismissedIds, alertLead, soundPlayedIds, playAlertSound]);

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [checkAlerts]);

  const dismissAlert = useCallback((leadId: string) => {
    setDismissedIds(prev => new Set([...prev, leadId]));
    setAlertLead(null);
  }, []);

  return { alertLead, dismissAlert };
}
