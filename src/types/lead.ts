export type LeadTemperature = 'frio' | 'morno' | 'quente';

export type LeadStage = 'prospeccao' | 'interesse' | 'reuniao' | 'proposta' | 'venda' | 'congelados' | 'perdidos';

export type LeadSource = 'marketing' | 'prospeccao_ativa' | 'indicacao';

export type MeetingStatus = 'compareceu' | 'no_show' | 'reagendar' | null;

export interface LeadHistory {
  type: string;
  note: string;
  date: string;
  user: string;
}

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  confection_type: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  temperature: LeadTemperature;
  value: number;
  implementation_value: number;
  monthly_value: number;
  stage: LeadStage;
  loss_reason: string | null;
  next_contact: string | null;
  last_contact: string | null;
  entry_date: string | null;
  meeting_pain: string | null;
  meeting_needs: string | null;
  meeting_link: string | null;
  meeting_date: string | null;
  history: LeadHistory[];
  created_at: string;
  updated_at: string;
  // Extended fields
  is_new?: boolean;
  manager_notes?: string | null;
  activecampaign_id?: string | null;
  meeting_status?: MeetingStatus;
  reference_month?: string | null;
  pieces_per_month?: number | null;
  responsible_user_id?: string | null;
  lead_source?: LeadSource;
  // Client detail fields
  cpf_cnpj?: string | null;
  state_registration?: string | null;
  implementation_responsible?: string | null;
  signer_name?: string | null;
  signer_role?: string | null;
  birthdate?: string | null;
  address?: string | null;
  client_observations?: string | null;
}

export interface LeadFilters {
  search: string;
  temperature: LeadTemperature | 'todos';
  confectionType: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  sales_goal: number;
  msg_template: string;
  meeting_goal?: number;
}

export interface MonthlyMetrics {
  totalLeads: number;
  leadsWithoutResponse: number;
  meetingsScheduled: number;
  meetingsAttended: number;
  meetingsNoShow: number;
  salesClosed: number;
  invalidLeads: number;
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  prospeccao: 'Prospecção',
  interesse: 'Interesse',
  reuniao: 'Reunião',
  proposta: 'Proposta',
  venda: 'Venda',
  congelados: 'Congelados',
  perdidos: 'Perdidos',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  prospeccao: 'border-stage-prospeccao',
  interesse: 'border-stage-interesse',
  reuniao: 'border-stage-reuniao',
  proposta: 'border-stage-proposta',
  venda: 'border-stage-venda',
  congelados: 'border-stage-congelados',
  perdidos: 'border-stage-perdidos',
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  compareceu: 'Compareceu',
  no_show: 'No Show',
  reagendar: 'Reagendar',
};
