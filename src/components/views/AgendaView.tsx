import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { CalendarDays } from 'lucide-react';

interface AgendaViewProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
}

export function AgendaView({ leads, onOpenLead }: AgendaViewProps) {
  const hours = Array.from({ length: 11 }, (_, i) => i + 8);
  const today = new Date().toDateString();

  const getEventsForHour = (hour: number) => {
    return leads.filter(l => {
      if (!l.meeting_date) return false;
      const d = new Date(l.meeting_date);
      return d.toDateString() === today && d.getHours() === hour;
    });
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden h-full flex flex-col">
      <div className="p-4 bg-muted border-b border-border flex justify-between items-center">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <CalendarDays size={18} /> Agenda de Hoje
        </h3>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>
      
      <div className="overflow-y-auto flex-1 p-4 scrollbar-thin">
        <div className="space-y-2">
          {hours.map(hour => {
            const events = getEventsForHour(hour);
            const isPast = new Date().getHours() > hour;
            
            return (
              <div key={hour} className="flex gap-4 group">
                <div className="w-16 text-right text-sm font-medium text-muted-foreground pt-2">
                  {hour}:00
                </div>
                <div className={`flex-1 border-l-2 pl-4 py-2 min-h-[60px] ${
                  events.length > 0 
                    ? 'border-primary bg-accent/30' 
                    : 'border-border'
                } ${isPast ? 'opacity-50' : ''}`}>
                  {events.length > 0 ? (
                    events.map(ev => (
                      <div
                        key={ev.id}
                        onClick={() => onOpenLead(ev)}
                        className="bg-card p-2 rounded shadow-sm border border-primary/20 cursor-pointer hover:shadow-md mb-1 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-sm text-foreground">{ev.name}</p>
                          <p className="text-xs text-muted-foreground">{ev.company}</p>
                        </div>
                        <div className="bg-accent text-accent-foreground text-xs px-2 py-1 rounded font-bold">
                          {formatTime(ev.meeting_date)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic group-hover:text-muted-foreground">
                      Horário Livre
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}