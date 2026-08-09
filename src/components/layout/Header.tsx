import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, COLOR_THEMES, ColorTheme } from '@/contexts/ThemeContext';
import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { 
  Bell, UserCircle, 
  LayoutDashboard, CalendarDays, TrendingUp, Users, Sparkles, RefreshCw, ClipboardCheck,
  PhoneOutgoing, UserPlus, Moon, Sun, Palette, ChevronDown, FileText, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedLogo } from '@/components/AnimatedLogo';
import { UserAvatar } from '@/components/ui/user-avatar';

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
  salesGoal?: number;
  percentGoal?: number;
}

export function Header({ view, setView, isManager, onProfileOpen, leads, onSyncActiveCampaign, syncing, salesGoal, percentGoal }: HeaderProps) {
  const { profile } = useAuth();
  const { darkMode, toggleDarkMode, colorTheme, setColorTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPalette, setShowPalette] = useState(false);

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

  const themeGroups = {
    single: Object.entries(COLOR_THEMES).filter(([, v]) => v.group === 'single'),
    combo: Object.entries(COLOR_THEMES).filter(([, v]) => v.group === 'combo'),
    premium: Object.entries(COLOR_THEMES).filter(([, v]) => v.group === 'premium'),
  };

  return (
    <header className="premium-gradient text-primary-foreground sticky top-0 z-20 shadow-lg">
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
          <NavButton active={view === 'whatsapp'} onClick={() => setView('whatsapp')} icon={Smartphone} label="WhatsApp" />
          <NavButton active={view === 'relatorios'} onClick={() => setView('relatorios')} icon={FileText} label="Relatórios" />
          {isManager && <NavButton active={view === 'gestor'} onClick={() => setView('gestor')} icon={Users} label="Gestor" />}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 transition"
            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Color palette */}
          <div className="relative">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="p-2 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 transition"
              title="Cores"
            >
              <Palette size={18} />
            </button>
            {showPalette && (
              <div className="absolute right-0 mt-2 bg-card rounded-xl shadow-xl border border-border p-3 z-50 w-56 max-h-[70vh] overflow-y-auto scrollbar-thin">
                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Cores Sólidas</p>
                {themeGroups.single.map(([key, info]) => (
                  <ThemeButton key={key} themeKey={key as ColorTheme} info={info} active={colorTheme === key} onClick={() => { setColorTheme(key as ColorTheme); setShowPalette(false); }} />
                ))}
                
                <div className="border-t border-border my-2" />
                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Combinações</p>
                {themeGroups.combo.map(([key, info]) => (
                  <ThemeButton key={key} themeKey={key as ColorTheme} info={info} active={colorTheme === key} onClick={() => { setColorTheme(key as ColorTheme); setShowPalette(false); }} />
                ))}

                <div className="border-t border-border my-2" />
                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Premium</p>
                {themeGroups.premium.map(([key, info]) => (
                  <ThemeButton key={key} themeKey={key as ColorTheme} info={info} active={colorTheme === key} onClick={() => { setColorTheme(key as ColorTheme); setShowPalette(false); }} />
                ))}
              </div>
            )}
          </div>

          {!isManager && onSyncActiveCampaign && (
            <Button
              onClick={onSyncActiveCampaign}
              disabled={syncing}
              size="sm"
              className="gap-1.5 bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground border-0 h-9 px-3"
            >
              {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span className="hidden lg:inline text-sm">{syncing ? 'Sync...' : 'Sync AC'}</span>
            </Button>
          )}

          {/* Meta de vendas sempre visível */}
          {typeof salesGoal === 'number' && salesGoal > 0 && (
            <button
              onClick={() => setView('vendas')}
              title="Meta de vendas (implantação) — clique para ver detalhes"
              className="hidden sm:flex flex-col items-start gap-1 px-3 py-1.5 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 transition hover-scale"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/70 leading-none">
                Meta {(percentGoal ?? 0).toFixed(0)}%
              </span>
              <span className="w-24 h-1.5 rounded-full bg-primary-foreground/20 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-primary-foreground transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(2, percentGoal ?? 0))}%` }}
                />
              </span>
            </button>
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
            <UserAvatar
              url={profile?.avatar}
              name={profile?.name}
              className="w-10 h-10 border-2 border-primary-foreground/30"
              fallbackClassName="bg-primary-foreground/15 text-primary-foreground"
            />
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
        <NavButton active={view === 'whatsapp'} onClick={() => setView('whatsapp')} icon={Smartphone} label="WhatsApp" />
        <NavButton active={view === 'relatorios'} onClick={() => setView('relatorios')} icon={FileText} label="Relat." />
        {isManager && <NavButton active={view === 'gestor'} onClick={() => setView('gestor')} icon={Users} label="Gestor" />}
      </nav>
    </header>
  );
}

function ThemeButton({ themeKey, info, active, onClick }: { themeKey: ColorTheme; info: any; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
        active ? 'bg-accent text-accent-foreground font-semibold' : 'text-foreground hover:bg-muted'
      }`}
    >
      <div className="flex -space-x-1 flex-shrink-0">
        <span
          className="w-4 h-4 rounded-full border-2 border-border"
          style={{ backgroundColor: info.preview }}
        />
        {info.preview2 && (
          <span
            className="w-4 h-4 rounded-full border-2 border-border"
            style={{ backgroundColor: info.preview2 }}
          />
        )}
      </div>
      <span className="truncate">{info.label}</span>
    </button>
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
