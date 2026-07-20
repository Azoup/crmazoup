import { Lead, LeadStage } from '@/types/lead';

export interface MessageTemplate {
  id: string;
  title: string;
  stage: LeadStage | 'geral';
  body: string;
}

const STORAGE_PREFIX = 'crm_msg_templates_v1_';

const DEFAULT_TEMPLATES: Omit<MessageTemplate, 'id'>[] = [
  {
    title: 'Primeiro contato',
    stage: 'prospeccao',
    body: 'Olá {primeiro_nome}! Aqui é da Azoup 👋 Vi que a {empresa} atua com {tipo}. Podemos conversar rapidamente sobre como estamos ajudando confecções a reduzir desperdício e aumentar a produção?',
  },
  {
    title: 'Follow-up sem resposta',
    stage: 'interesse',
    body: 'Oi {primeiro_nome}, tudo bem? Só passando pra retomar nossa conversa sobre o sistema. Consegue me responder qual o melhor horário pra falarmos?',
  },
  {
    title: 'Confirmar reunião',
    stage: 'reuniao',
    body: 'Oi {primeiro_nome}! Passando pra confirmar nossa reunião. Alguma dúvida antes da conversa? Vou preparar tudo especialmente pra {empresa}.',
  },
  {
    title: 'Reforçar proposta',
    stage: 'proposta',
    body: 'Oi {primeiro_nome}, tudo certo? Enviei a proposta personalizada pra {empresa}. Conseguiu analisar? Posso tirar qualquer dúvida agora.',
  },
  {
    title: 'Reativar congelado',
    stage: 'congelados',
    body: 'Oi {primeiro_nome}! Faz um tempo que não conversamos. Lançamos novidades importantes que podem ajudar a {empresa}. Faz sentido retomarmos?',
  },
  {
    title: 'Genérico',
    stage: 'geral',
    body: 'Olá {primeiro_nome}, tudo bem? Aqui é da Azoup, passando pra falar com você sobre {empresa}.',
  },
];

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadTemplates(userId: string | undefined): MessageTemplate[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) {
      const seeded = DEFAULT_TEMPLATES.map((t) => ({
        ...t,
        id: crypto.randomUUID(),
      }));
      localStorage.setItem(storageKey(userId), JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplates(userId: string, templates: MessageTemplate[]): void {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), JSON.stringify(templates));
}

export function applyTemplateVars(
  body: string,
  lead: Pick<Lead, 'name' | 'company' | 'confection_type'>,
): string {
  const fullName = lead.name || '';
  const firstName = fullName.split(/\s+/)[0] || '';
  return body
    .replace(/\{nome\}/gi, fullName)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{empresa\}/gi, lead.company || '')
    .replace(/\{tipo\}/gi, lead.confection_type || '');
}
