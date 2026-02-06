import { useState, useEffect, useCallback } from 'react';
import { Lead } from '@/types/lead';

// Parse meeting_date as LOCAL (Brasília) time, stripping any UTC/timezone offset.
// Meeting dates are stored as "wall time" in the DB — the +00 offset is an artifact
// of the timestamptz column, not an actual UTC conversion.
function parseMeetingDate(dateStr: string): Date {
  // Strip timezone offset (+00, +00:00, -03:00, Z) to get raw local components
  const cleanStr = dateStr
    .replace(/[+-]\d{2}(:\d{2})?$/, '')
    .replace('Z', '')
    .trim();

  if (cleanStr.includes('T')) {
    const [datePart, timePart] = cleanStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const timeParts = timePart.split(':').map(Number);
    const hours = timeParts[0] || 0;
    const minutes = timeParts[1] || 0;
    // Construct as local time (browser timezone = Brasília)
    return new Date(year, month - 1, day, hours, minutes);
  }

  // Date-only fallback
  const [year, month, day] = cleanStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function useMeetingReminder(leads: Lead[]) {
  const [pendingReminder, setPendingReminder] = useState<Lead | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Check for meetings that have passed their scheduled time
  const checkMeetings = useCallback(() => {
    const now = new Date();
    
    // Find leads in 'reuniao' stage with past meeting_date and no meeting_status set
    const pastMeetings = leads.filter(lead => {
      if (lead.stage !== 'reuniao') return false;
      if (!lead.meeting_date) return false;
      if (lead.meeting_status) return false; // Already has a status
      if (dismissedIds.has(lead.id)) return false; // Already dismissed in this session
      
      const meetingTime = parseMeetingDate(lead.meeting_date);
      // Add 1 hour after the scheduled meeting time before showing reminder
      const reminderTime = new Date(meetingTime.getTime() + 60 * 60 * 1000);
      return reminderTime < now;
    });

    // Show reminder for the first one found
    if (pastMeetings.length > 0 && !pendingReminder) {
      setPendingReminder(pastMeetings[0]);
    }
  }, [leads, dismissedIds, pendingReminder]);

  // Check every 30 seconds
  useEffect(() => {
    checkMeetings();
    const interval = setInterval(checkMeetings, 30000);
    return () => clearInterval(interval);
  }, [checkMeetings]);

  // Handle dismissing the reminder
  const dismissReminder = useCallback((leadId: string) => {
    setDismissedIds(prev => new Set([...prev, leadId]));
    setPendingReminder(null);
  }, []);

  // Handle when a status is selected (clears the reminder)
  const clearReminder = useCallback(() => {
    setPendingReminder(null);
  }, []);

  return {
    pendingReminder,
    dismissReminder,
    clearReminder,
  };
}
