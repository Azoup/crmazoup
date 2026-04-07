import { useState, useMemo } from 'react';
import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { 
  CalendarDays, ChevronLeft, ChevronRight, Clock, User, Building2, 
  ExternalLink, Phone, Video, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isSameDay, isToday, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyAgendaViewProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onGoogleCalendarSync?: () => void;
}

function parseMeetingDate(dateStr: string): Date {
  const cleanStr = dateStr
    .replace(/[+-]\d{2}(:\d{2})?$/, '')
    .replace('Z', '')
    .trim();

  if (cleanStr.includes('T')) {
    const [datePart, timePart] = cleanStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const timeParts = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, timeParts[0] || 0, timeParts[1] || 0);
  }
  const [year, month, day] = cleanStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function WeeklyAgendaView({ leads, onOpenLead, onGoogleCalendarSync }: WeeklyAgendaViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);
  
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const meetingLeads = useMemo(() => 
    leads.filter(l => l.meeting_date && (l.stage === 'reuniao' || l.stage === 'proposta' || l.stage === 'interesse')),
    [leads]
  );

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return meetingLeads.filter(l => {
      if (!l.meeting_date) return false;
      const d = parseMeetingDate(l.meeting_date);
      return isSameDay(d, day) && d.getHours() === hour;
    });
  };

  const getEventsForDay = (day: Date) => {
    return meetingLeads.filter(l => {
      if (!l.meeting_date) return false;
      return isSameDay(parseMeetingDate(l.meeting_date), day);
    });
  };

  const todayEvents = useMemo(() => {
    return meetingLeads.filter(l => {
      if (!l.meeting_date) return false;
      return isToday(parseMeetingDate(l.meeting_date));
    }).sort((a, b) => {
      return parseMeetingDate(a.meeting_date!).getTime() - parseMeetingDate(b.meeting_date!).getTime();
    });
  }, [meetingLeads]);

  const totalWeekEvents = useMemo(() => {
    return meetingLeads.filter(l => {
      if (!l.meeting_date) return false;
      const d = parseMeetingDate(l.meeting_date);
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      return d >= currentWeekStart && d <= weekEnd;
    }).length;
  }, [meetingLeads, currentWeekStart]);

  const weekRangeText = useMemo(() => {
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return `${format(currentWeekStart, "d 'de' MMM", { locale: ptBR })} — ${format(end, "d 'de' MMM, yyyy", { locale: ptBR })}`;
  }, [currentWeekStart]);

  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const now = new Date();
  const currentHour = now.getHours();

  const getEventColor = (lead: Lead) => {
    if (!lead.meeting_date) return 'from-primary/20 to-primary/10 border-primary';
    const d = parseMeetingDate(lead.meeting_date);
    if (isBefore(d, now) && isToday(d)) return 'from-muted to-muted/80 border-muted-foreground/30';
    if (lead.meeting_status === 'compareceu') return 'from-success/20 to-success/10 border-success';
    if (lead.meeting_status === 'no_show') return 'from-destructive/20 to-destructive/10 border-destructive';
    return 'from-primary/20 to-primary/10 border-primary';
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-border bg-gradient-to-r from-card to-muted/30">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-lg">
                <CalendarDays size={20} className="text-primary" />
              </div>
              Agenda Semanal
            </h3>
            <p className="text-xs text-muted-foreground mt-1 ml-11">
              {totalWeekEvents} reunião(ões) esta semana
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onGoogleCalendarSync && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGoogleCalendarSync}
                className="text-xs gap-1 border-dashed"
                title="Funcionalidade em desenvolvimento"
              >
                <ExternalLink size={14} />
                🚧 Google Agenda
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek} className="h-8 w-8 rounded-lg">
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextWeek} className="h-8 w-8 rounded-lg">
              <ChevronRight size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek} className="text-xs h-8 font-semibold text-primary">
              Hoje
            </Button>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {weekRangeText}
          </span>
        </div>
      </div>

      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <div className="px-5 py-3 bg-primary/5 border-b border-border">
          <h4 className="text-xs font-bold text-primary mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
            <Clock size={12} /> Hoje — {todayEvents.length} reunião(ões)
          </h4>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {todayEvents.map(event => {
              const meetingTime = parseMeetingDate(event.meeting_date!);
              const isPast = isBefore(meetingTime, now);
              
              return (
                <div
                  key={event.id}
                  onClick={() => onOpenLead(event)}
                  className={`flex-shrink-0 bg-card px-4 py-3 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 ${
                    isPast ? 'border-border opacity-60' : 'border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-lg font-bold ${isPast ? 'text-muted-foreground' : 'text-primary'}`}>
                      {format(meetingTime, 'HH:mm')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{event.name}</p>
                      {event.company && (
                        <p className="text-[11px] text-muted-foreground">{event.company}</p>
                      )}
                    </div>
                    {event.meeting_link && (
                      <Video size={14} className="text-primary ml-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
            <div className="p-3 text-[10px] font-semibold text-muted-foreground border-r border-border uppercase tracking-wider flex items-center justify-center">
              Horário
            </div>
            {weekDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isDayToday = isToday(day);
              
              return (
                <div
                  key={i}
                  className={`p-3 text-center border-r border-border last:border-r-0 transition-colors ${
                    isDayToday ? 'bg-primary/8' : ''
                  }`}
                >
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${isDayToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'EEE', { locale: ptBR })}
                  </div>
                  <div className={`text-xl font-bold mt-0.5 ${isDayToday ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className={`mt-1 flex justify-center gap-0.5`}>
                      {dayEvents.slice(0, 4).map((_, j) => (
                        <span key={j} className="w-1.5 h-1.5 rounded-full bg-primary" />
                      ))}
                      {dayEvents.length > 4 && (
                        <span className="text-[8px] text-primary font-bold ml-0.5">+{dayEvents.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time Grid */}
          {hours.map(hour => {
            const isCurrentHour = isToday(currentWeekStart) || weekDays.some(d => isToday(d));
            
            return (
              <div key={hour} className="grid grid-cols-8 border-b border-border/50 group hover:bg-muted/20 transition-colors">
                <div className="p-2 text-xs font-medium text-muted-foreground border-r border-border text-right pr-3 flex items-start justify-end pt-3">
                  <span className={`${hour === currentHour && weekDays.some(d => isToday(d)) ? 'text-primary font-bold' : ''}`}>
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
                {weekDays.map((day, dayIndex) => {
                  const events = getEventsForDayAndHour(day, hour);
                  const isDayToday = isToday(day);
                  const isNowSlot = isDayToday && hour === currentHour;
                  const isPastSlot = isDayToday && hour < currentHour;
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[70px] p-1.5 border-r border-border/50 last:border-r-0 relative ${
                        isDayToday ? 'bg-primary/[0.03]' : ''
                      } ${isPastSlot ? 'opacity-40' : ''}`}
                    >
                      {/* Current time indicator */}
                      {isNowSlot && (
                        <div 
                          className="absolute left-0 right-0 h-0.5 bg-primary z-10 pointer-events-none"
                          style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                        >
                          <span className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-primary rounded-full" />
                        </div>
                      )}
                      
                      {events.map(event => {
                        const meetingTime = parseMeetingDate(event.meeting_date!);
                        const colorClass = getEventColor(event);
                        
                        return (
                          <div
                            key={event.id}
                            onClick={() => onOpenLead(event)}
                            className={`bg-gradient-to-r ${colorClass} p-2 rounded-lg text-[11px] cursor-pointer hover:shadow-md transition-all mb-1 border-l-3`}
                            style={{ borderLeftWidth: '3px' }}
                          >
                            <div className="font-bold text-foreground truncate flex items-center gap-1">
                              <User size={10} className="flex-shrink-0" />
                              {event.name}
                            </div>
                            {event.company && (
                              <div className="text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                <Building2 size={9} className="flex-shrink-0" />
                                {event.company}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-primary font-bold">
                                {format(meetingTime, 'HH:mm')}
                              </span>
                              {event.meeting_link && (
                                <Video size={10} className="text-info" />
                              )}
                              {event.whatsapp && (
                                <Phone size={9} className="text-success" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
