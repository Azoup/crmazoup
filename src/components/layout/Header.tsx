import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { 
  Bell, UserCircle, 
  LayoutDashboard, CalendarDays, TrendingUp, Users, Sparkles, RefreshCw, ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedLogo } from '@/components/AnimatedLogo';

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
  onSyncActiveCampaign?: () => Promise<void>;
  syncing?: boolean;
}

export function Header({ view, setView, isManager, onProfileOpen, leads, onSyncActiveCampaign, syncing }: HeaderProps) {
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

  const newLeadsCount = leads.filter(l => l.is_new).length;

  return (
    <header className="bg-primary text-primary-foreground sticky top-0 z-20 shadow-md">
      <div className="flex items-center justify-between px-4 h-14 md:h-16">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3">
          <AnimatedLogo size="md" />
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">Azoup</h1>
            <p className="text-[10px] text-primary-foreground/60 font-medium">
              {isManager ? 'Gestor' : 'SDR'}
            </p>
          </div>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center bg-primary-foreground/10 rounded-lg p-1 gap-0.5">
          <NavButton active={view === 'pipeline'} onClick={() => setView('pipeline')} icon={LayoutDashboard} label="Pipeline" />
          <NavButton active={view === 'agenda'} onClick={() => setView('agenda')} icon={CalendarDays} label="Agenda" />
          <NavButton active={view === 'vendas'} onClick={() => setView('vendas')} icon={TrendingUp} label="Vendas" />
          <NavButton active={view === 'qualificacao'} onClick={() => setView('qualificacao')} icon={ClipboardCheck} label="Qualificação" />
          {isManager && <NavButton active={view === 'gestor'} onClick={() => setView('gestor')} icon={Users} label="Gestor" />}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {!isManager && onSyncActiveCampaign && (
            <Button
              onClick={onSyncActiveCampaign}
              disabled={syncing}
              size="sm"
              className="gap-1.5 text-xs bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground border-0 h-8"
            >
              {syncing ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              <span className="hidden lg:inline">
                {syncing ? 'Sync...' : 'Sync AC'}
              </span>
            </Button>
          )}

          {newLeadsCount > 0 && (
            <div className="bg-purple-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
              <Sparkles size={10} />
              {newLeadsCount} {newLeadsCount === 1 ? 'novo' : 'novos'}
            </div>
          )}

          {notifications.length > 0 && (
            <div className="relative group">
              <button className="relative p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition">
                <Bell size={18} />
                <span className="absolute -top-0.5 -right-0.5 bg-destructive w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold">
                  {notifications.length}
                </span>
              </button>
              <div className="absolute right-0 mt-2 w-72 bg-card rounded-xl shadow-xl border border-border p-3 z-50 hidden group-hover:block">
                <p className="text-xs font-bold text-muted-foreground mb-2">Lembretes de Reunião</p>
                {notifications.map((n, i) => (
                  <div key={i} className="text-xs p-2.5 bg-destructive/10 text-destructive rounded-lg mb-1.5 border border-destructive/20">
                    {n.text} ({n.time})
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onProfileOpen}
            className="flex items-center gap-2.5 pl-2 ml-1 hover:opacity-90 transition"
          >
            <div className="text-right hidden lg:block">
              <p className="text-xs font-semibold leading-none">{profile?.name.split(' ')[0]}</p>
              <p className="text-[9px] text-primary-foreground/60">{profile?.role}</p>
            </div>
            {profile?.avatar ? (
              <img src={profile.avatar} alt="Perfil" className="w-8 h-8 rounded-full border-2 border-primary-foreground/30 shadow-sm object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <UserCircle size={20} className="text-primary-foreground/80" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-thin">
        <NavButton active={view === 'pipeline'} onClick={() => setView('pipeline')} icon={LayoutDashboard} label="Pipeline" />
        <NavButton active={view === 'agenda'} onClick={() => setView('agenda')} icon={CalendarDays} label="Agenda" />
        <NavButton active={view === 'vendas'} onClick={() => setView('vendas')} icon={TrendingUp} label="Vendas" />
        <NavButton active={view === 'qualificacao'} onClick={() => setView('qualificacao')} icon={ClipboardCheck} label="Qualif." />
        {isManager && <NavButton active={view === 'gestor'} onClick={() => setView('gestor')} icon={Users} label="Gestor" />}
      </nav>
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-xs font-medium flex-shrink-0 ${
        active 
          ? 'bg-primary-foreground text-primary shadow-sm' 
          : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10'
      }`}
    >
      <Icon size={14} /> <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
