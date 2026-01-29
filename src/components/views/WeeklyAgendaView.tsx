import { useState, useMemo } from 'react';
import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, User, Building2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isSameDay, isToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyAgendaViewProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onGoogleCalendarSync?: () => void;
}

export function WeeklyAgendaView({ leads, onOpenLead, onGoogleCalendarSync }: WeeklyAgendaViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8h às 19h
  
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Parse meeting_date properly - handles both datetime-local format and ISO
  const parseMeetingDate = (dateStr: string): Date => {
    // If it's datetime-local format (YYYY-MM-DDTHH:mm), parse as local time
    if (dateStr.length === 16 && dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    }
    // Otherwise parse as ISO
    return new Date(dateStr);
  };

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return leads.filter(l => {
      if (!l.meeting_date) return false;
      const d = parseMeetingDate(l.meeting_date);
      return isSameDay(d, day) && d.getHours() === hour;
    });
  };

  const getEventsForDay = (day: Date) => {
    return leads.filter(l => {
      if (!l.meeting_date) return false;
      return isSameDay(parseMeetingDate(l.meeting_date), day);
    });
  };

  const todayEvents = useMemo(() => {
    return leads.filter(l => {
      if (!l.meeting_date) return false;
      return isToday(parseMeetingDate(l.meeting_date));
    }).sort((a, b) => {
      const dateA = parseMeetingDate(a.meeting_date!);
      const dateB = parseMeetingDate(b.meeting_date!);
      return dateA.getTime() - dateB.getTime();
    });
  }, [leads]);

  const weekRangeText = useMemo(() => {
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return `${format(currentWeekStart, "d 'de' MMM", { locale: ptBR })} - ${format(end, "d 'de' MMM, yyyy", { locale: ptBR })}`;
  }, [currentWeekStart]);

  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-4 bg-muted border-b border-border">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" /> Agenda Semanal
          </h3>
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
                🚧 Google Agenda (em breve)
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
              Hoje
            </Button>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {weekRangeText}
          </span>
        </div>
      </div>

      {/* Today's Events Summary */}
      {todayEvents.length > 0 && (
        <div className="p-3 bg-primary/10 border-b border-border">
          <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
            <Clock size={12} /> Eventos de Hoje ({todayEvents.length})
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {todayEvents.map(event => (
              <div
                key={event.id}
                onClick={() => onOpenLead(event)}
                className="flex-shrink-0 bg-card px-3 py-2 rounded-lg shadow-sm border border-primary/20 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-primary/20 text-primary border-primary/30">
                    {formatTime(event.meeting_date)}
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">{event.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
            <div className="p-2 text-xs font-medium text-muted-foreground border-r border-border">
              Hora
            </div>
            {weekDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isDayToday = isToday(day);
              
              return (
                <div
                  key={i}
                  className={`p-2 text-center border-r border-border last:border-r-0 ${
                    isDayToday ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className={`text-xs font-medium ${isDayToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'EEE', { locale: ptBR })}
                  </div>
                  <div className={`text-lg font-bold ${isDayToday ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  {dayEvents.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {dayEvents.length} evento{dayEvents.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time Grid */}
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-border hover:bg-muted/30 transition-colors">
              <div className="p-2 text-xs font-medium text-muted-foreground border-r border-border text-right pr-3">
                {hour}:00
              </div>
              {weekDays.map((day, dayIndex) => {
                const events = getEventsForDayAndHour(day, hour);
                const isDayToday = isToday(day);
                const isPastHour = isDayToday && new Date().getHours() > hour;
                
                return (
                  <div
                    key={dayIndex}
                    className={`min-h-[60px] p-1 border-r border-border last:border-r-0 ${
                      isDayToday ? 'bg-primary/5' : ''
                    } ${isPastHour ? 'opacity-50' : ''}`}
                  >
                    {events.map(event => (
                      <div
                        key={event.id}
                        onClick={() => onOpenLead(event)}
                        className="bg-gradient-to-r from-primary/20 to-primary/10 p-1.5 rounded text-[10px] cursor-pointer hover:from-primary/30 hover:to-primary/20 transition-colors mb-1 border-l-2 border-primary"
                      >
                        <div className="font-bold text-foreground truncate flex items-center gap-1">
                          <User size={10} />
                          {event.name}
                        </div>
                        {event.company && (
                          <div className="text-muted-foreground truncate flex items-center gap-1">
                            <Building2 size={8} />
                            {event.company}
                          </div>
                        )}
                        <div className="text-primary font-semibold mt-0.5">
                          {formatTime(event.meeting_date)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
