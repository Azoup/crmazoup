import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, CalendarDays, TrendingUp, Users, ClipboardCheck,
  PhoneOutgoing, UserPlus, FileText, Smartphone, Settings, Pin, PinOff,
} from 'lucide-react';
import { AnimatedLogo } from '@/components/AnimatedLogo';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AppSidebarProps {
  view: string;
  setView: (view: any) => void;
  isManager: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onProfileOpen: () => void;
  autoHide: boolean;
  onToggleAutoHide: () => void;
}

const ITEMS = [
  { id: 'pipeline', label: 'Pipeline', icon: LayoutDashboard },
  { id: 'prospeccao_ativa', label: 'Prosp. Ativa', icon: PhoneOutgoing },
  { id: 'indicacao', label: 'Indicação', icon: UserPlus },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'vendas', label: 'Vendas', icon: TrendingUp },
  { id: 'qualificacao', label: 'Qualificação', icon: ClipboardCheck },
  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  { id: 'relatorios', label: 'Relatórios', icon: FileText },
];

export function AppSidebar({ view, setView, isManager, collapsed, onToggle, onProfileOpen }: AppSidebarProps) {
  const { profile } = useAuth();
  const items = isManager ? [...ITEMS, { id: 'gestor', label: 'Gestor', icon: Users }] : ITEMS;

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-card border-r border-border transition-[width] duration-200 ${
          collapsed ? 'w-[68px]' : 'w-[228px]'
        }`}
      >
        {/* Brand */}
        <div className={`flex items-center gap-2.5 h-[68px] px-3 border-b border-border/70 ${collapsed ? 'justify-center' : ''}`}>
          <AnimatedLogo size="sm" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-tight leading-none text-foreground">Azoup</p>
              <p className="text-[11px] text-muted-foreground mt-1">CRM • {isManager ? 'Gestor' : 'SDR'}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-1">
          {items.map((item) => {
            const active = view === item.id;
            const button = (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />}
                <item.icon size={17} className={active ? 'text-primary' : ''} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
            return collapsed ? (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              button
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border/70 p-2 space-y-1">
          <button
            onClick={onProfileOpen}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/60 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <UserAvatar url={profile?.avatar} name={profile?.name} className="w-8 h-8" />
            {!collapsed && (
              <div className="min-w-0 text-left">
                <p className="text-[13px] font-medium text-foreground truncate">{profile?.name || 'Azoup CRM'}</p>
                <p className="text-[11px] text-muted-foreground leading-none">{profile?.role || 'SDR'}</p>
              </div>
            )}
          </button>
          <button
            onClick={onProfileOpen}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <Settings size={16} />
            {!collapsed && <span>Configurações</span>}
          </button>
          <button
            onClick={onToggle}
            title={collapsed ? 'Mostrar menu' : 'Ocultar menu'}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span>Ocultar menu</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
