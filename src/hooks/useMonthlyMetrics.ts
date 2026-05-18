import { useMemo } from 'react';
import { Lead, MonthlyMetrics } from '@/types/lead';
import {
  isMeetingAttendedInMonth,
  isMeetingNoShowInMonth,
  isMeetingScheduledInMonth,
} from '@/lib/meetingMetrics';

// Calculate reference month based on calendar month (01 to 30/31)
export function getCurrentReferenceMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export function formatReferenceMonth(refMonth: string): string {
  const [year, month] = refMonth.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

export function useMonthlyMetrics(leads: Lead[], referenceMonth?: string): MonthlyMetrics {
  const currentMonth = referenceMonth || getCurrentReferenceMonth();

  return useMemo(() => {
    const monthlyLeads = leads.filter(
      (lead) =>
        lead.reference_month === currentMonth &&
        (!lead.lead_source || lead.lead_source === 'marketing'),
    );

    const totalLeads = monthlyLeads.length;

    const leadsWithoutResponse = monthlyLeads.filter(
      (lead) => lead.stage === 'prospeccao',
    ).length;

    // Reuniões / comparecimento / no-show: mês da data agendada ou do momento em que entrou em Reunião
    const meetingsScheduled = leads.filter((lead) =>
      isMeetingScheduledInMonth(lead, currentMonth),
    ).length;

    const meetingsAttended = leads.filter((lead) =>
      isMeetingAttendedInMonth(lead, currentMonth),
    ).length;

    const meetingsNoShow = leads.filter((lead) =>
      isMeetingNoShowInMonth(lead, currentMonth),
    ).length;

    const salesClosed = monthlyLeads.filter((lead) => lead.stage === 'venda').length;

    const invalidLeads = monthlyLeads.filter((lead) => {
      const noPhone = !lead.whatsapp || lead.whatsapp.trim() === '';
      const invalidReason =
        lead.loss_reason?.toLowerCase().includes('inválido') ||
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
