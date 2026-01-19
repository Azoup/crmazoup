export type LeadTemperature = 'frio' | 'morno' | 'quente';

export type LeadStage = 'prospeccao' | 'interesse' | 'reuniao' | 'venda' | 'congelados' | 'perdidos';

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
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  prospeccao: 'Prospecção',
  interesse: 'Interesse',
  reuniao: 'Reunião',
  venda: 'Venda',
  congelados: 'Congelados',
  perdidos: 'Perdidos',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  prospeccao: 'border-stage-prospeccao',
  interesse: 'border-stage-interesse',
  reuniao: 'border-stage-reuniao',
  venda: 'border-stage-venda',
  congelados: 'border-stage-congelados',
  perdidos: 'border-stage-perdidos',
};