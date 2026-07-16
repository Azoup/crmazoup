import { Lead, LeadTemperature } from '@/types/lead';
import { getDaysSince, formatCurrencyCompact } from '@/lib/utils';
import { calculateLeadScore, leadScoreColor, leadScoreLabel } from '@/lib/leadScore';
import { AlertTriangle, DollarSign, MessageCircle, Phone, Sparkles, UserCheck, UserX, Calendar, Clock, Video } from 'lucide-react';


interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  status: 'late' | 'today' | 'ontime' | 'neutral';
  onQuickWhatsApp: (e: React.MouseEvent) => void;
  /** Quando false, desativa drag nativo (ex.: dentro de carrossel com scroll por arraste). */
  enableNativeDrag?: boolean;
}

const tempColors: Record<LeadTemperature, string> = {
  quente: 'bg-temp-hot/10 text-temp-hot',
  morno: 'bg-temp-warm/10 text-temp-warm',
  frio: 'bg-temp-cold/10 text-temp-cold',
};

const tempLabels: Record<LeadTemperature, string> = {
  quente: '🔥',
  morno: '☕',
  frio: '❄️',
};

const meetingStatusConfig: Record<string, { label: string; color: string; icon: typeof UserCheck }> = {
  compareceu: { label: 'Compareceu', color: 'bg-success/10 text-success', icon: UserCheck },
  no_show: { label: 'No Show', color: 'bg-destructive/10 text-destructive', icon: UserX },
  reagendar: { label: 'Reagendar', color: 'bg-warning/10 text-warning', icon: Calendar },
};

function getNextContactStatus(nextContact: string | null | undefined): { label: string; colorClass: string } | null {
  if (!nextContact) return null;
  const now = new Date();
  const contactDate = new Date(nextContact);
  if (isNaN(contactDate.getTime())) return null;

  const diffMs = contactDate.getTime() - now.getTime();
  const diffMin = diffMs / (1000 * 60);

  if (diffMin < 0) {
    return { label: formatContactDateTime(contactDate), colorClass: 'bg-destructive/10 text-destructive border-destructive/20' };
  } else if (diffMin <= 60) {
    return { label: formatContactDateTime(contactDate), colorClass: 'bg-warning/10 text-warning border-warning/20' };
  } else {
    return { label: formatContactDateTime(contactDate), colorClass: 'bg-success/10 text-success border-success/20' };
  }
}

function formatContactDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LeadCard({ lead, onClick, status, onQuickWhatsApp, enableNativeDrag = true }: LeadCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("leadId", lead.id);
  };
  
  const daysSinceContact = getDaysSince(lead.last_contact);
  const isNew = lead.is_new === true;
  
  const safeTemperature: LeadTemperature = 
    lead.temperature && ['frio', 'morno', 'quente'].includes(lead.temperature) 
      ? lead.temperature 
      : 'morno';
  
  const meetingConfig = lead.meeting_status && meetingStatusConfig[lead.meeting_status] 
    ? meetingStatusConfig[lead.meeting_status] 
    : null;

  const showNextContact = ['prospeccao', 'interesse'].includes(lead.stage);
  const nextContactStatus = showNextContact ? getNextContactStatus(lead.next_contact) : null;

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let leadMonthLabel: string | null = null;
  if (lead.reference_month) {
    const m = parseInt(lead.reference_month.split('-')[1], 10);
    if (!isNaN(m) && m >= 1 && m <= 12) leadMonthLabel = monthNames[m - 1];
  } else if (lead.entry_date) {
    const [, mm] = lead.entry_date.split('-');
    const m = parseInt(mm, 10);
    if (!isNaN(m) && m >= 1 && m <= 12) leadMonthLabel = monthNames[m - 1];
  }

  // "Entrou no CRM há X dias"
  const entryRaw = lead.entry_date || lead.created_at;
  let entryAgoLabel: string | null = null;
  if (entryRaw) {
    let entryDate: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(entryRaw)) {
      const [y, m, d] = entryRaw.split('-').map(Number);
      entryDate = new Date(y, m - 1, d);
    } else {
      const parsed = new Date(entryRaw);
      if (!isNaN(parsed.getTime())) entryDate = parsed;
    }
    if (entryDate) {
      const today = new Date();
      const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const b = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate()).getTime();
      const diffDays = Math.max(0, Math.round((a - b) / 86400000));
      if (diffDays === 0) entryAgoLabel = 'hoje';
      else if (diffDays === 1) entryAgoLabel = 'ontem';
      else if (diffDays < 30) entryAgoLabel = `há ${diffDays} dias`;
      else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        entryAgoLabel = `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
      } else {
        const years = Math.floor(diffDays / 365);
        entryAgoLabel = `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
      }
    }
  }

  const showNeonNewSystem =
    lead.new_system_link_sent === true && !['perdidos', 'venda'].includes(lead.stage);

  const borderColor = showNeonNewSystem
    ? 'border-l-[hsl(200_100%_50%)]'
    : isNew
      ? 'border-l-purple-500'
      : status === 'late'
        ? 'border-l-destructive'
        : status === 'neutral'
          ? 'border-l-muted-foreground/30'
          : 'border-l-success';

  const initials = (lead.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const avatarClass =
    safeTemperature === 'quente'
      ? 'bg-temp-hot/15 text-temp-hot'
      : safeTemperature === 'morno'
        ? 'bg-temp-warm/15 text-temp-warm'
        : 'bg-temp-cold/15 text-temp-cold';

  const score = calculateLeadScore(lead);
  const scoreBarColor = leadScoreColor(score);

  return (
    <div
      draggable={enableNativeDrag}
      onDragStart={enableNativeDrag ? handleDragStart : undefined}
      onClick={onClick}
      className={`relative p-4 bg-card rounded-xl border border-border/50 animate-fade-in ${
        enableNativeDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 group border-l-4 ${borderColor} ${
        showNeonNewSystem
          ? 'ring-2 ring-[hsl(200_100%_50%)]/60 bg-[hsl(200_100%_50%)]/5 shadow-[0_0_16px_hsl(200_100%_50%/0.35)]'
          : isNew ? 'ring-1 ring-purple-400/20 bg-purple-50/50 dark:bg-purple-950/20' : ''
      } shadow-sm`}
    >
      {/* New lead badge */}
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
          <Sparkles size={10} /> NOVO
        </div>
      )}

      {/* Header: avatar + name + days */}
      <div className="flex items-start gap-2.5 mb-2">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-full ${avatarClass} flex items-center justify-center text-[11px] font-bold ring-1 ring-border/40`}
          aria-hidden
        >
          {initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h4 className={`font-bold text-sm leading-tight truncate flex items-center gap-1 ${isNew ? 'text-purple-700 dark:text-purple-300' : 'text-foreground'}`}>
              {lead.is_live_launch && (
                <Video
                  size={14}
                  className={`flex-shrink-0 ${lead.live_launch_contacted ? 'text-success' : 'text-destructive animate-pulse'}`}
                  aria-label={lead.live_launch_contacted ? 'Lead live - contatado' : 'Lead live - não contatado'}
                />
              )}
              <span className="truncate">{lead.name || 'Sem nome'}</span>
              {leadMonthLabel && (
                <span className="ml-1.5 text-[10px] font-bold text-primary">· {leadMonthLabel}</span>
              )}
            </h4>
            {!isNew && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-0.5 ${
                status === 'late'
                  ? 'bg-destructive/10 text-destructive'
                  : 'text-muted-foreground'
              }`}>
                {status === 'late' && <AlertTriangle size={10} />}
                {daysSinceContact > 0 ? `${daysSinceContact}d` : 'hoje'}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{lead.company || 'Sem empresa'}</p>
        </div>
      </div>

      {/* Lead score bar */}
      <div className="mb-2" title={`Score do lead: ${score}/100 · ${leadScoreLabel(score)}`}>
        <div className="flex items-center justify-between text-[9px] font-semibold text-muted-foreground mb-0.5">
          <span>Score</span>
          <span className="tabular-nums">{score}/100</span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full ${scoreBarColor} transition-[width] duration-500 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {entryAgoLabel && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/80 mb-2">
          <Calendar size={10} className="text-primary/70" />
          <span>No CRM {entryAgoLabel}</span>
        </div>
      )}

      
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${tempColors[safeTemperature]}`}>
          {tempLabels[safeTemperature]}
        </span>
        {(lead.value ?? 0) > 0 && (
          <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5">
            <DollarSign size={10} /> {formatCurrencyCompact(lead.value ?? 0)}
          </span>
        )}
        {lead.activecampaign_id && (
          <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md font-bold">
            AC
          </span>
        )}
        {meetingConfig && (
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 ${meetingConfig.color}`}>
            <meetingConfig.icon size={10} /> {meetingConfig.label}
          </span>
        )}
      </div>

      {/* Next contact indicator */}
      {nextContactStatus && (
        <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border mb-2.5 ${nextContactStatus.colorClass}`}>
          {lead.next_contact_type === 'ligacao' ? <Phone size={11} /> : <Clock size={11} />}
          <span className="truncate">
            {lead.next_contact_type === 'ligacao' ? 'Ligar · ' : lead.next_contact_type === 'mensagem' ? 'Msg · ' : ''}
            {nextContactStatus.label}
          </span>
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border/30">
        <span className="text-[11px] text-muted-foreground/70 truncate max-w-[120px]">
          {lead.confection_type || '-'}
        </span>
        <div className="flex items-center gap-1">
          {lead.whatsapp && (
            <a
              href={`tel:${lead.whatsapp}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-all hover:scale-110"
              title="Ligar"
            >
              <Phone size={16} />
            </a>
          )}
          <button
            onClick={onQuickWhatsApp}
            className="text-success hover:bg-success/10 p-1.5 rounded-lg transition-all hover:scale-110"
            title="WhatsApp"
          >
            <MessageCircle size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}
