import { useEffect, useState, useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Lead } from '@/types/lead';
import { calculateLeadScore } from '@/lib/leadScore';
import { Zap, User, Building2, BarChart3, Plus } from 'lucide-react';

interface CommandPaletteProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onCreateLead: () => void;
  onGoToReports: () => void;
}

export function CommandPalette({ leads, onOpenLead, onCreateLead, onGoToReports }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const nextLead = useMemo(() => {
    // Lead com próximo contato atrasado; se nenhum, mais quente sem contato recente
    const now = Date.now();
    const withNext = leads
      .filter((l) => l.next_contact && !['perdidos', 'venda'].includes(l.stage))
      .map((l) => ({ l, delta: now - new Date(l.next_contact!).getTime() }))
      .filter((x) => !isNaN(x.delta))
      .sort((a, b) => b.delta - a.delta);
    if (withNext.length && withNext[0].delta > 0) return withNext[0].l;

    const active = leads.filter((l) => !['perdidos', 'venda', 'congelados'].includes(l.stage));
    active.sort((a, b) => calculateLeadScore(b) - calculateLeadScore(a));
    return active[0] || null;
  }, [leads]);

  const activeLeads = useMemo(
    () => leads.filter((l) => !['perdidos'].includes(l.stage)).slice(0, 200),
    [leads],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar lead por nome, empresa, telefone, e-mail..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        <CommandGroup heading="Ações rápidas">
          {nextLead && (
            <CommandItem
              onSelect={() => {
                setOpen(false);
                onOpenLead(nextLead);
              }}
            >
              <Zap className="mr-2 h-4 w-4 text-warning" />
              Próximo lead a contatar
              <span className="ml-auto text-xs text-muted-foreground truncate">{nextLead.name}</span>
            </CommandItem>
          )}
          <CommandItem
            onSelect={() => {
              setOpen(false);
              onCreateLead();
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo lead
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              onGoToReports();
            }}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Ir para relatórios
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Leads">
          {activeLeads.map((lead) => (
            <CommandItem
              key={lead.id}
              value={`${lead.name} ${lead.company ?? ''} ${lead.whatsapp ?? ''} ${lead.email ?? ''}`}
              onSelect={() => {
                setOpen(false);
                onOpenLead(lead);
              }}
            >
              <User className="mr-2 h-4 w-4 text-primary" />
              <span className="truncate">{lead.name || 'Sem nome'}</span>
              {lead.company && (
                <span className="ml-2 text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Building2 size={10} /> {lead.company}
                </span>
              )}
              <span className="ml-auto text-[10px] font-bold text-muted-foreground uppercase">
                {lead.stage}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
