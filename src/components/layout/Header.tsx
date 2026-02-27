import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { 
  Bell, UserCircle, 
  LayoutDashboard, CalendarDays, TrendingUp, Users, Sparkles, RefreshCw, ClipboardCheck,
  PhoneOutgoing, UserPlus
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
    <header className="bg-primary text-primary-foreground sticky top-0 z-20 shadow-lg">
      <div className="flex items-center justify-between px-5 h-16 md:h-[72px]">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3">
          <AnimatedLogo size="md" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight leading-none">Azoup</h1>
            <p className="text-[11px] text-primary-foreground/70 font-medium mt-0.5">
              CRM • {isManager ? 'Gestor' : 'SDR'}
            </p>
          </div>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center bg-primary-foreground/10 rounded-xl p-1 gap-1">
          <NavButton active={view === 'pipeline'} onClick={() => setView('pipeline')} icon={LayoutDashboard} label="Pipeline" />
          <NavButton active={view === 'prospeccao_ativa'} onClick={() => setView('prospeccao_ativa')} icon={PhoneOutgoing} label="Prosp. Ativa" />
          <NavButton active={view === 'indicacao'} onClick={() => setView('indicacao')} icon={UserPlus} label="Indicação" />
          <NavButton active={view === 'agenda'} onClick={() => setView('agenda')} icon={CalendarDays} label="Agenda" />
          <NavButton active={view === 'vendas'} onClick={() => setView('vendas')} icon={TrendingUp} label="Vendas" />
          <NavButton active={view === 'qualificacao'} onClick={() => setView('qualificacao')} icon={ClipboardCheck} label="Qualificação" />
          {isManager && <NavButton active={view === 'gestor'} onClick={() => setView('gestor')} icon={Users} label="Gestor" />}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {!isManager && onSyncActiveCampaign && (
            <Button
              onClick={onSyncActiveCampaign}
              disabled={syncing}
              size="sm"
              className="gap-1.5 bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground border-0 h-9 px-3"
            >
              {syncing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              <span className="hidden lg:inline text-sm">
                {syncing ? 'Sync...' : 'Sync AC'}
              </span>
            </Button>
          )}

          {newLeadsCount > 0 && (
            <div className="bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-pulse shadow-md">
              <Sparkles size={12} />
              {newLeadsCount} {newLeadsCount === 1 ? 'novo' : 'novos'}
            </div>
          )}

          {notifications.length > 0 && (
            <div className="relative group">
              <button className="relative p-2.5 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 transition">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 bg-destructive w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold">
                  {notifications.length}
                </span>
              </button>
              <div className="absolute right-0 mt-2 w-80 bg-card rounded-xl shadow-xl border border-border p-4 z-50 hidden group-hover:block">
                <p className="text-sm font-bold text-muted-foreground mb-3">Lembretes de Reunião</p>
                {notifications.map((n, i) => (
                  <div key={i} className="text-sm p-3 bg-destructive/10 text-destructive rounded-lg mb-2 border border-destructive/20">
                    {n.text} ({n.time})
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onProfileOpen}
            className="flex items-center gap-3 pl-3 ml-1 hover:opacity-90 transition"
          >
            <div className="text-right hidden lg:block">
              <p className="text-sm font-semibold leading-none">{profile?.name.split(' ')[0]}</p>
              <p className="text-[11px] text-primary-foreground/60 mt-0.5">{profile?.role}</p>
            </div>
            {profile?.avatar ? (
              <img src={profile.avatar} alt="Perfil" className="w-10 h-10 rounded-full border-2 border-primary-foreground/30 shadow-md object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <UserCircle size={24} className="text-primary-foreground/80" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto scrollbar-thin">
        <NavButton active={view === 'pipeline'} onClick={() => setView('pipeline')} icon={LayoutDashboard} label="Pipeline" />
        <NavButton active={view === 'prospeccao_ativa'} onClick={() => setView('prospeccao_ativa')} icon={PhoneOutgoing} label="Prosp. Ativa" />
        <NavButton active={view === 'indicacao'} onClick={() => setView('indicacao')} icon={UserPlus} label="Indicação" />
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
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-semibold flex-shrink-0 ${
        active 
          ? 'bg-primary-foreground text-primary shadow-md' 
          : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10'
      }`}
    >
      <Icon size={16} /> <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
