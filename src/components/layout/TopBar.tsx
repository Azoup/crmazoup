import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, COLOR_THEMES, ColorTheme } from '@/contexts/ThemeContext';
import { Lead } from '@/types/lead';
import { formatTime } from '@/lib/utils';
import { Bell, Search, Moon, Sun, Palette, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';

interface Notification {
  id: string;
  text: string;
  time: string;
}

interface TopBarProps {
  title: string;
  subtitle: string;
  leads: Lead[];
  isManager: boolean;
  onProfileOpen: () => void;
  onSyncActiveCampaign?: () => Promise<void>;
  syncing?: boolean;
  salesGoal?: number;
  percentGoal?: number;
  onGoToSales: () => void;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function TopBar({
  title,
  subtitle,
  leads,
  isManager,
  onProfileOpen,
  onSyncActiveCampaign,
  syncing,
  salesGoal,
  percentGoal,
  onGoToSales,
  search,
  onSearchChange,
}: TopBarProps) {
  const { profile } = useAuth();
  const { darkMode, toggleDarkMode, colorTheme, setColorTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPalette, setShowPalette] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    const checkMeetings = setInterval(() => {
      if (!leads.length) return;
      const now = new Date();
      const upcoming: Notification[] = [];
      leads.forEach((lead) => {
        if (lead.meeting_date) {
          const diffMins = Math.floor((new Date(lead.meeting_date).getTime() - now.getTime()) / 60000);
          if (diffMins > 0 && diffMins <= 20) {
            upcoming.push({
              id: lead.id,
              text: `Reunião com ${lead.name} em ${diffMins} min!`,
              time: formatTime(lead.meeting_date),
            });
          }
        }
      });
      setNotifications((prev) => {
        const newNotes = [...prev];
        upcoming.forEach((u) => {
          if (!newNotes.find((n) => n.text === u.text)) newNotes.push(u);
        });
        return newNotes;
      });
    }, 60000);
    return () => clearInterval(checkMeetings);
  }, [leads]);

  const newLeadsCount = leads.filter((l) => l.is_new).length;

  const themeGroups = {
    single: Object.entries(COLOR_THEMES).filter(([, v]) => v.group === 'single'),
    combo: Object.entries(COLOR_THEMES).filter(([, v]) => v.group === 'combo'),
    premium: Object.entries(COLOR_THEMES).filter(([, v]) => v.group === 'premium'),
  };

  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onSearchChange && (
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" size={14} />
              <input
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar"
                className="h-9 w-52 rounded-lg border border-border bg-card pl-8 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary/50 transition-colors"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/70 border border-border rounded px-1 py-0.5">
                Ctrl K
              </kbd>
            </div>
          )}

          <button
            onClick={toggleDarkMode}
            className="h-9 w-9 grid place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="h-9 w-9 grid place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
              title="Cores"
            >
              <Palette size={16} />
            </button>
            {showPalette && (
              <div className="absolute right-0 mt-2 bg-card rounded-xl shadow-lg border border-border p-3 z-50 w-56 max-h-[70vh] overflow-y-auto scrollbar-thin">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Cores Sólidas</p>
                {themeGroups.single.map(([key, info]) => (
                  <ThemeButton key={key} info={info} active={colorTheme === key} onClick={() => { setColorTheme(key as ColorTheme); setShowPalette(false); }} />
                ))}
                <div className="border-t border-border my-2" />
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Combinações</p>
                {themeGroups.combo.map(([key, info]) => (
                  <ThemeButton key={key} info={info} active={colorTheme === key} onClick={() => { setColorTheme(key as ColorTheme); setShowPalette(false); }} />
                ))}
                <div className="border-t border-border my-2" />
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Premium</p>
                {themeGroups.premium.map(([key, info]) => (
                  <ThemeButton key={key} info={info} active={colorTheme === key} onClick={() => { setColorTheme(key as ColorTheme); setShowPalette(false); }} />
                ))}
              </div>
            )}
          </div>

          {!isManager && onSyncActiveCampaign && (
            <Button
              onClick={onSyncActiveCampaign}
              disabled={syncing}
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 px-3 text-[13px] font-medium"
            >
              {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} className="text-primary" />}
              <span className="hidden lg:inline">{syncing ? 'Sync...' : 'Sync AC'}</span>
            </Button>
          )}

          {typeof salesGoal === 'number' && salesGoal > 0 && (
            <button
              onClick={onGoToSales}
              title="Meta de vendas (implantação)"
              className="hidden xl:flex flex-col items-start gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                Meta {(percentGoal ?? 0).toFixed(0)}%
              </span>
              <span className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <span
                  className="block h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(2, percentGoal ?? 0))}%` }}
                />
              </span>
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowNotes((s) => !s)}
              className="relative h-9 w-9 grid place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
              title="Notificações"
            >
              <Bell size={16} />
              {(notifications.length > 0 || newLeadsCount > 0) && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center">
                  {notifications.length + newLeadsCount}
                </span>
              )}
            </button>
            {showNotes && (
              <div className="absolute right-0 mt-2 w-80 bg-card rounded-xl shadow-lg border border-border p-4 z-50">
                <p className="text-[13px] font-semibold text-foreground mb-3">Notificações</p>
                {newLeadsCount > 0 && (
                  <div className="text-[13px] p-2.5 rounded-lg bg-accent text-accent-foreground mb-2">
                    {newLeadsCount} {newLeadsCount === 1 ? 'novo lead' : 'novos leads'} no pipeline
                  </div>
                )}
                {notifications.map((n, i) => (
                  <div key={i} className="text-[13px] p-2.5 bg-destructive/10 text-destructive rounded-lg mb-2">
                    {n.text} ({n.time})
                  </div>
                ))}
                {notifications.length === 0 && newLeadsCount === 0 && (
                  <p className="text-[13px] text-muted-foreground">Nada por aqui.</p>
                )}
              </div>
            )}
          </div>

          <button onClick={onProfileOpen} className="flex items-center gap-2.5 pl-2 hover:opacity-90 transition-opacity">
            <div className="text-right hidden lg:block">
              <p className="text-[13px] font-medium leading-none text-foreground">{profile?.name?.split(' ')[0]}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{profile?.role}</p>
            </div>
            <UserAvatar url={profile?.avatar} name={profile?.name} className="w-9 h-9" />
          </button>
        </div>
      </div>
    </header>
  );
}

function ThemeButton({ info, active, onClick }: { info: any; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
        active ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-muted'
      }`}
    >
      <div className="flex -space-x-1 flex-shrink-0">
        <span className="w-4 h-4 rounded-full border-2 border-border" style={{ backgroundColor: info.preview }} />
        {info.preview2 && (
          <span className="w-4 h-4 rounded-full border-2 border-border" style={{ backgroundColor: info.preview2 }} />
        )}
      </div>
      <span className="truncate">{info.label}</span>
    </button>
  );
}
