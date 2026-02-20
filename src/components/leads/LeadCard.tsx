import { Lead, LeadTemperature } from '@/types/lead';
import { getDaysSince, formatCurrencyCompact } from '@/lib/utils';
import { AlertTriangle, DollarSign, GripVertical, MessageCircle, Sparkles, UserCheck, UserX, Calendar, Clock } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  status: 'late' | 'today' | 'ontime' | 'neutral';
  onQuickWhatsApp: (e: React.MouseEvent) => void;
}

const tempColors: Record<LeadTemperature, string> = {
  quente: 'bg-temp-hot/10 text-temp-hot',
  morno: 'bg-temp-warm/10 text-temp-warm',
  frio: 'bg-temp-cold/10 text-temp-cold',
};

const tempLabels: Record<LeadTemperature, string> = {
  quente: '🔥 Quente',
  morno: '☕ Morno',
  frio: '❄️ Frio',
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
    // Vencido
    return { label: formatContactDateTime(contactDate), colorClass: 'bg-destructive/10 text-destructive border-destructive/30' };
  } else if (diffMin <= 60) {
    // Próximo de vencer (dentro de 60min)
    return { label: formatContactDateTime(contactDate), colorClass: 'bg-warning/10 text-warning border-warning/30' };
  } else {
    // Dentro do prazo
    return { label: formatContactDateTime(contactDate), colorClass: 'bg-success/10 text-success border-success/30' };
  }
}

function formatContactDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LeadCard({ lead, onClick, status, onQuickWhatsApp }: LeadCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("leadId", lead.id);
  };
  
  const daysSinceContact = getDaysSince(lead.last_contact);
  const isNew = lead.is_new === true;
  
  // Safe temperature access with fallback
  const safeTemperature: LeadTemperature = 
    lead.temperature && ['frio', 'morno', 'quente'].includes(lead.temperature) 
      ? lead.temperature 
      : 'morno';
  
  const meetingConfig = lead.meeting_status && meetingStatusConfig[lead.meeting_status] 
    ? meetingStatusConfig[lead.meeting_status] 
    : null;

  // Show next contact indicator only for prospeccao and interesse stages
  const showNextContact = ['prospeccao', 'interesse'].includes(lead.stage);
  const nextContactStatus = showNextContact ? getNextContactStatus(lead.next_contact) : null;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`relative p-3 bg-card rounded-lg shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition group ${
        isNew
          ? 'border-l-4 border-l-purple-500 bg-purple-500/5 ring-1 ring-purple-500/20'
          : status === 'late' 
            ? 'border-l-4 border-l-destructive' 
            : status === 'neutral'
              ? 'border-l-4 border-l-muted-foreground/30'
              : 'border-l-4 border-l-success'
      }`}
    >
      {/* New lead badge */}
      {isNew && (
        <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
          <Sparkles size={10} /> NOVO
        </div>
      )}

      <div className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
        isNew 
          ? 'hidden'
          : status === 'late' 
            ? 'bg-destructive/10 text-destructive' 
            : 'bg-muted text-muted-foreground'
      }`}>
        {status === 'late' && <AlertTriangle size={8} />}
        {daysSinceContact > 0 ? `há ${daysSinceContact}d` : 'hoje'}
      </div>
      
      <div className="flex justify-between items-start mb-1 pr-12">
        <h4 className={`font-bold text-sm truncate ${isNew ? 'text-purple-700 dark:text-purple-300' : 'text-foreground'}`}>
          {lead.name || 'Sem nome'}
        </h4>
      </div>
      
      <p className="text-xs text-muted-foreground mb-2 truncate">{lead.company || 'Sem empresa'}</p>
      
      <div className="flex flex-wrap gap-1 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tempColors[safeTemperature]}`}>
          {tempLabels[safeTemperature]}
        </span>
        {(lead.value ?? 0) > 0 && (
          <span className="text-[10px] bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
            <DollarSign size={8} /> {formatCurrencyCompact(lead.value ?? 0)}
          </span>
        )}
        {lead.activecampaign_id && (
          <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold">
            AC
          </span>
        )}
        {meetingConfig && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 ${meetingConfig.color}`}>
            <meetingConfig.icon size={8} /> {meetingConfig.label}
          </span>
        )}
      </div>

      {/* Next contact indicator for prospeccao and interesse */}
      {nextContactStatus && (
        <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border mb-1 ${nextContactStatus.colorClass}`}>
          <Clock size={9} />
          {nextContactStatus.label}
        </div>
      )}
      
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <GripVertical size={12} className="text-muted-foreground/50" />
          <span className="truncate max-w-[80px]">{lead.confection_type || '-'}</span>
        </div>
        <button
          onClick={onQuickWhatsApp}
          className="text-success hover:bg-success/10 p-1.5 rounded-full transition"
          title="Enviar WhatsApp Rápido"
        >
          <MessageCircle size={14} />
        </button>
      </div>
    </div>
  );
}
