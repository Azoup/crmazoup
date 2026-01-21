import { useMemo } from 'react';
import { Lead, MonthlyMetrics } from '@/types/lead';

// Calculate reference month based on the 26-26 rule
export function getCurrentReferenceMonth(): string {
  const today = new Date();
  const day = today.getDate();
  
  // If day >= 26, reference month is next month
  // If day < 26, reference month is current month
  if (day >= 26) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
  } else {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }
}

export function formatReferenceMonth(refMonth: string): string {
  const [year, month] = refMonth.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export function useMonthlyMetrics(leads: Lead[], referenceMonth?: string): MonthlyMetrics {
  const currentMonth = referenceMonth || getCurrentReferenceMonth();
  
  return useMemo(() => {
    // Filter leads by reference month
    const monthlyLeads = leads.filter(lead => lead.reference_month === currentMonth);
    
    // Total leads received in the month
    const totalLeads = monthlyLeads.length;
    
    // Leads without response (still in prospeccao stage)
    const leadsWithoutResponse = monthlyLeads.filter(
      lead => lead.stage === 'prospeccao'
    ).length;
    
    // Meetings scheduled (leads that reached 'reuniao' stage or beyond)
    const meetingsScheduled = monthlyLeads.filter(
      lead => lead.meeting_status !== null || 
              ['reuniao', 'venda'].includes(lead.stage)
    ).length;
    
    // Meetings attended
    const meetingsAttended = monthlyLeads.filter(
      lead => lead.meeting_status === 'compareceu'
    ).length;
    
    // Meetings no show
    const meetingsNoShow = monthlyLeads.filter(
      lead => lead.meeting_status === 'no_show'
    ).length;
    
    // Sales closed
    const salesClosed = monthlyLeads.filter(
      lead => lead.stage === 'venda'
    ).length;
    
    // Invalid leads (no phone or explicitly marked)
    // Consider invalid if: no whatsapp, or lost with reason containing "inválido", "falso", "inexistente"
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
