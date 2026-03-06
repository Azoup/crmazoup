import { useMemo } from 'react';
import { Lead, MonthlyMetrics } from '@/types/lead';

// Calculate reference month based on calendar month (01 to 30/31)
export function getCurrentReferenceMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export function formatReferenceMonth(refMonth: string): string {
  const [year, month] = refMonth.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

// Extract YYYY-MM from a meeting_date string, ignoring timezone offset
function getMeetingMonth(meetingDate: string | null): string | null {
  if (!meetingDate) return null;
  // Strip timezone info (+00, +00:00, Z) to get the raw date
  const cleanStr = meetingDate.replace(/[+-]\d{2}(:\d{2})?$/, '').replace('Z', '');
  const match = cleanStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

export function useMonthlyMetrics(leads: Lead[], referenceMonth?: string): MonthlyMetrics {
  const currentMonth = referenceMonth || getCurrentReferenceMonth();
  
  return useMemo(() => {
    // Filter leads by reference month (based on entry_date)
    // Only count marketing leads (from ActiveCampaign) for SDR metrics
    // Leads from prospeccao_ativa/indicacao belong to the manager's own count
    const monthlyLeads = leads.filter(lead => 
      lead.reference_month === currentMonth && 
      (!lead.lead_source || lead.lead_source === 'marketing')
    );
    
    // Total leads received in the month
    const totalLeads = monthlyLeads.length;
    
    // Leads without response (still in prospeccao stage)
    const leadsWithoutResponse = monthlyLeads.filter(
      lead => lead.stage === 'prospeccao'
    ).length;
    
    // === MEETING METRICS: based on meeting_date month, not reference_month ===
    // This allows leads from previous months to count when their meeting is in the current month
    
    // Meetings scheduled (any lead with meeting_date in this month)
    const meetingsScheduled = leads.filter(lead => {
      return getMeetingMonth(lead.meeting_date) === currentMonth;
    }).length;
    
    // Meetings attended (compareceu + meeting in this month)
    const meetingsAttended = leads.filter(lead => {
      return lead.meeting_status === 'compareceu' && getMeetingMonth(lead.meeting_date) === currentMonth;
    }).length;
    
    // Meetings no show (no_show + meeting in this month)
    const meetingsNoShow = leads.filter(lead => {
      return lead.meeting_status === 'no_show' && getMeetingMonth(lead.meeting_date) === currentMonth;
    }).length;
    
    // Sales closed (based on reference_month)
    const salesClosed = monthlyLeads.filter(
      lead => lead.stage === 'venda'
    ).length;
    
    // Invalid leads
    const invalidLeads = monthlyLeads.filter(lead => {
      const noPhone = !lead.whatsapp || lead.whatsapp.trim() === '';
      const invalidReason = lead.loss_reason?.toLowerCase().includes('inválido') ||
                           lead.loss_reason?.toLowerCase().includes('falso') ||
                           lead.loss_reason?.toLowerCase().includes('inexistente') ||
                           lead.loss_reason?.toLowerCase().includes('número errado');
      return noPhone || invalidReason;
    }).length;
    
    return {
      totalLeads,
      leadsWithoutResponse,
      meetingsScheduled,
      meetingsAttended,
      meetingsNoShow,
      salesClosed,
      invalidLeads,
    };
  }, [leads, currentMonth]);
}
