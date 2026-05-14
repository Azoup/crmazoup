import { useMemo } from 'react';
import { Lead, LeadHistory } from '@/types/lead';
import { LeadCard } from '@/components/leads/LeadCard';
import { cleanPhoneNumber } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ListTodo, Sparkles } from 'lucide-react';

const PRE_MEETING_STAGES = new Set(['prospeccao', 'interesse']);

function entryTimestamp(lead: Lead): number {
  const raw = lead.entry_date || lead.created_at;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isNextContactOverdue(lead: Lead): boolean {
  if (!lead.next_contact) return false;
  const t = new Date(lead.next_contact).getTime();
  return Number.isFinite(t) && t < Date.now();
}

/** Prioridade: novos (is_new) → retorno atrasado → há mais tempo na fila → há mais tempo sem contato */
function sortDailyFollowup(a: Lead, b: Lead): number {
  if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;

  const aOver = isNextContactOverdue(a);
  const bOver = isNextContactOverdue(b);
  if (aOver !== bOver) return aOver ? -1 : 1;

  const byEntry = entryTimestamp(a) - entryTimestamp(b);
  if (byEntry !== 0) return byEntry;

  const aLast = a.last_contact ? new Date(a.last_contact).getTime() : 0;
  const bLast = b.last_contact ? new Date(b.last_contact).getTime() : 0;
  return aLast - bLast;
}

interface DailyNewLeadsCarouselProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  getLeadStatus: (lead: Lead) => 'late' | 'today' | 'ontime' | 'neutral';
  addHistory: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
  msgTemplate: string;
}

export function DailyNewLeadsCarousel({
  leads,
  onOpenLead,
  getLeadStatus,
  addHistory,
  msgTemplate,
}: DailyNewLeadsCarouselProps) {
  const { profile } = useAuth();

  const queue = useMemo(() => {
    return leads
      .filter((l) => PRE_MEETING_STAGES.has(l.stage))
      .slice()
      .sort(sortDailyFollowup);
  }, [leads]);

  const newCount = useMemo(() => queue.filter((l) => l.is_new).length, [queue]);

  const sendWhatsApp = async (lead: Lead, e: React.MouseEvent, msg: string = msgTemplate) => {
    e.stopPropagation();
    if (!lead.whatsapp) {
      alert('Sem WhatsApp cadastrado.');
      return;
    }
    let finalMsg = msg
      .replace('{nome}', lead.name || '')
      .replace('{empresa}', lead.company || '')
      .replace('{tipo}', lead.confection_type || '');
    if (profile?.signature) {
      finalMsg += `\n\n${profile.signature}`;
    }
    const phone = cleanPhoneNumber(lead.whatsapp);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(finalMsg)}`, '_blank');
    await addHistory(lead.id, 'whatsapp', `Enviou: "${finalMsg}"`);
  };

  if (queue.length === 0) {
    return null;
  }

  return (
    <section
      className="mb-5 rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm"
      aria-label="Fila de follow-up diário antes da reunião"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListTodo className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground md:text-base">
              Fila do dia — antes da reunião
            </h2>
            <p className="max-w-2xl text-xs text-muted-foreground md:text-sm">
              Prioriza leads novos e quem está há mais tempo em Prospecção ou Interesse. Ao mover para Reunião
              (pelo pipeline abaixo ou pelo cadastro), o lead sai desta fila.
            </p>
          </div>
        </div>
        {newCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-1 text-[11px] font-bold text-purple-700 dark:text-purple-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {newCount} novo{newCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <Carousel
        opts={{ align: 'start', dragFree: true }}
        className="relative w-full pl-1 pr-1"
      >
        <CarouselContent className="-ml-2 md:-ml-3">
          {queue.map((lead) => (
            <CarouselItem
              key={lead.id}
              className="pl-2 md:pl-3 basis-[min(100%,17.5rem)] sm:basis-72 md:basis-80"
            >
              <div className="h-full min-h-[200px]">
                <LeadCard
                  lead={lead}
                  onClick={() => onOpenLead(lead)}
                  status={getLeadStatus(lead)}
                  onQuickWhatsApp={(e) => sendWhatsApp(lead, e)}
                  enableNativeDrag={false}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          variant="secondary"
          className="left-1 top-[calc(50%-12px)] z-10 h-9 w-9 border-border/80 bg-background/95 shadow-md md:left-0"
        />
        <CarouselNext
          variant="secondary"
          className="right-1 top-[calc(50%-12px)] z-10 h-9 w-9 border-border/80 bg-background/95 shadow-md md:right-0"
        />
      </Carousel>
    </section>
  );
}
