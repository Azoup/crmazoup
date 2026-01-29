import { useState, useEffect, useCallback } from 'react';
import { Lead } from '@/types/lead';

// Parse meeting_date properly - handles both datetime-local format and ISO
function parseMeetingDate(dateStr: string): Date {
  // If it's datetime-local format (YYYY-MM-DDTHH:mm), parse as local time
  if (dateStr.length === 16 && dateStr.includes('T')) {
    const [datePart, timePart] = dateStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }
  // Otherwise parse as ISO
  return new Date(dateStr);
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
      return meetingTime < now;
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
