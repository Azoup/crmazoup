import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { 
  Shirt, Scissors, Cloud, Bell, UserCircle, 
  LayoutDashboard, CalendarDays, TrendingUp, Users 
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface Notification {
  id: string;
  text: string;
  time: string;
}

interface HeaderProps {
  view: string;
  setView: (view: any) => void;
  isManager: boolean;
  onProfileOpen: () => void;
  leads: Lead[];
}

export function Header({ view, setView, isManager, onProfileOpen, leads }: HeaderProps) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const checkMeetings = setInterval(() => {
      if (!leads.length) return;

      const now = new Date();
      const upcoming: Notification[] = [];

      leads.forEach(lead => {
        if (lead.meeting_date) {
          const meetingTime = new Date(lead.meeting_date);
          const diffMs = meetingTime.getTime() - now.getTime();
          const diffMins = Math.floor(diffMs / 60000);

          if (diffMins > 0 && diffMins <= 20) {
            upcoming.push({
              id: lead.id,
              text: `Reunião com ${lead.name} em ${diffMins} min!`,
              time: formatTime(lead.meeting_date),
            });
          }
        }
      });

      setNotifications(prev => {
        const newNotes = [...prev];
        upcoming.forEach(u => {
          if (!newNotes.find(n => n.text === u.text)) {
            newNotes.push(u);
          }
        });
        return newNotes;
      });
    }, 60000);

    return () => clearInterval(checkMeetings);
  }, [leads]);

  return (
    <header className="bg-primary text-primary-foreground p-4 shadow-lg flex flex-col md:flex-row justify-between items-center sticky top-0 z-20 gap-4">
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="bg-card p-1 rounded-lg shadow-sm h-10 w-10 flex items-center justify-center relative flex-shrink-0">
          <Shirt className="text-primary" size={24} strokeWidth={2.5} />
          <div className="absolute -bottom-1 -right-1 bg-card rounded-full p-0.5 border border-border shadow-sm">
            <Scissors className="text-foreground transform -rotate-12" size={12} strokeWidth={2} />
          </div>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight leading-tight">CRM - Azoup</h1>
          <p className="text-[10px] text-primary-foreground/70 flex items-center gap-1">
            <Cloud size={10} /> {isManager ? 'Modo Gestor' : 'Modo SDR'}
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="relative group">
            <button className="p-2 bg-primary/80 rounded-full text-primary-foreground animate-pulse">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 bg-destructive w-4 h-4 rounded-full text-[10px] flex items-center justify-center">
                {notifications.length}
              </span>
            </button>
            <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-xl border border-border p-2 z-50 hidden group-hover:block">
              <p className="text-xs font-bold text-muted-foreground mb-2">Lembretes de Reunião</p>
              {notifications.map((n, i) => (
                <div key={i} className="text-xs p-2 bg-destructive/10 text-destructive rounded mb-1 border border-destructive/20">
                  {n.text} ({n.time})
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onProfileOpen} className="md:hidden p-2 rounded-full hover:bg-primary/80 transition">
          {profile?.avatar ? (
            <img src={profile.avatar} alt="Perfil" className="w-8 h-8 rounded-full border-2 border-primary-foreground object-cover" />
          ) : (
            <UserCircle size={28} className="text-primary-foreground" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 justify-between md:justify-end">
        <nav className="flex gap-2">
          <NavButton active={view === 'pipeline'} onClick={() => setView('pipeline')} icon={LayoutDashboard} label="Pipeline" />
          <NavButton active={view === 'agenda'} onClick={() => setView('agenda')} icon={CalendarDays} label="Agenda" />
          <NavButton active={view === 'vendas'} onClick={() => setView('vendas')} icon={TrendingUp} label="Vendas" />
          {isManager && <NavButton active={view === 'gestor'} onClick={() => setView('gestor')} icon={Users} label="Gestor" />}
        </nav>
        
        <button
          onClick={onProfileOpen}
          className="hidden md:flex items-center gap-2 pl-4 border-l border-primary-foreground/30 hover:opacity-90 transition"
        >
          <div className="text-right hidden lg:block">
            <p className="text-sm font-bold leading-none">{profile?.name.split(' ')[0]}</p>
            <p className="text-[10px] text-primary-foreground/70">{profile?.role}</p>
          </div>
          {profile?.avatar ? (
            <img src={profile.avatar} alt="Perfil" className="w-9 h-9 rounded-full border-2 border-primary-foreground shadow-sm object-cover" />
          ) : (
            <UserCircle size={32} className="text-primary-foreground" />
          )}
        </button>
      </div>
    </header>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function NavButton({ active, onClick, icon: Icon, label }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded transition text-sm flex-shrink-0 ${
        active 
          ? 'bg-primary-foreground/20 text-primary-foreground shadow-inner' 
          : 'text-primary-foreground/80 hover:bg-primary-foreground/10'
      }`}
    >
      <Icon size={16} /> <span className="whitespace-nowrap hidden sm:inline">{label}</span>
    </button>
  );
}