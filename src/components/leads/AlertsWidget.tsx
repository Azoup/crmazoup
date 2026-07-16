import { useMemo, useState } from 'react';
import { Lead } from '@/types/lead';
import { AlertTriangle, Clock, Video, FileText, Snowflake, ChevronDown, ChevronUp } from 'lucide-react';

interface AlertsWidgetProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86400000);
}

export function AlertsWidget({ leads, onOpenLead }: AlertsWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(() => {
    const active = leads.filter((l) => !['perdidos', 'venda'].includes(l.stage));

    const stalled = active.filter(
      (l) => l.stage !== 'congelados' && daysSince(l.last_contact || l.updated_at) >= 7,
    );
    const staleProposals = active.filter(
      (l) => l.stage === 'proposta' && daysSince(l.updated_at) >= 5,
    );
    const liveNotContacted = active.filter(
      (l) => l.is_live_launch && !l.live_launch_contacted && daysSince(l.created_at) >= 2,
    );
    const overdueReturn = active.filter(
      (l) => l.next_contact && new Date(l.next_contact).getTime() < Date.now(),
    );

    return [
      { key: 'overdue', label: 'Retornos atrasados', icon: Clock, color: 'text-destructive', items: overdueReturn },
      { key: 'stalled', label: 'Parados +7 dias', icon: Snowflake, color: 'text-info', items: stalled },
      { key: 'proposals', label: 'Propostas sem resposta +5d', icon: FileText, color: 'text-warning', items: staleProposals },
      { key: 'live', label: 'Live não contatados +2d', icon: Video, color: 'text-destructive', items: liveNotContacted },
    ];
  }, [leads]);

  const total = groups.reduce((acc, g) => acc + g.items.length, 0);
  if (total === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/5 shadow-sm overflow-hidden animate-fade-in">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-warning/10 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle size={16} className="text-warning" />
          <span>{total} alerta{total > 1 ? 's' : ''} pedem atenção</span>
          <div className="hidden sm:flex items-center gap-2 ml-3">
            {groups.filter((g) => g.items.length > 0).map((g) => (
              <span key={g.key} className="text-[11px] text-muted-foreground">
                {g.label}: <b className="text-foreground">{g.items.length}</b>
              </span>
            ))}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
          {groups.filter((g) => g.items.length > 0).map((g) => (
            <div key={g.key} className="rounded-xl border border-border/50 bg-card p-3">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-foreground">
                <g.icon size={13} className={g.color} />
                {g.label} ({g.items.length})
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                {g.items.slice(0, 12).map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => onOpenLead(lead)}
                    className="w-full text-left text-xs px-2 py-1 rounded-md hover:bg-muted/50 transition-colors flex justify-between gap-2"
                  >
                    <span className="truncate">{lead.name || 'Sem nome'}</span>
                    <span className="text-muted-foreground truncate max-w-[45%]">{lead.company || ''}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
