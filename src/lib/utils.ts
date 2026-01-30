import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
};

export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  // Handle datetime-local format (YYYY-MM-DDTHH:mm)
  if (date.length === 16 && date.includes('T')) {
    const [datePart, timePart] = date.split('T');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year} ${timePart}`;
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
};

export const formatTime = (date: string | null | undefined): string => {
  if (!date) return '';
  // Handle datetime-local format (YYYY-MM-DDTHH:mm)
  if (date.length === 16 && date.includes('T')) {
    return date.split('T')[1]; // Returns HH:mm
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatCurrencyCompact = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { 
    notation: "compact", 
    compactDisplay: "short", 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
};

export const getDaysSince = (dateString: string | null | undefined): number => {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const cleanPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10 && cleaned.length <= 11 && !cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
};

export const getAISuggestion = (lead: { stage: string; confection_type?: string | null }): string => {
  switch (lead.stage) {
    case 'perdidos':
      return "IA: Analise o motivo da perda. Tente reativar em 3 meses.";
    case 'congelados':
      return "IA: 'Olá, vi que não nos falamos há um tempo. Lançamos novidades. Faz sentido retomarmos?'";
    case 'prospeccao':
      return `IA: Envie cases visuais de sucesso para ${lead.confection_type || 'confecção'}.`;
    case 'interesse':
      return "IA: Foque na dor do desperdício de tecido.";
    case 'reuniao':
      return "IA: Confirme a reunião e prepare a demo.";
    case 'proposta':
      return "IA: Acompanhe a proposta enviada. Destaque o ROI e benefícios.";
    default:
      return "IA: Mantenha o contato ativo.";
  }
};