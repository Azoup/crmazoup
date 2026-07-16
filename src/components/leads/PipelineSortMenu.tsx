import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ArrowDownWideNarrow, Check } from 'lucide-react';

export type PipelineSortKey =
  | 'recent'
  | 'oldest_crm'
  | 'value_desc'
  | 'score_desc'
  | 'next_contact';

export const SORT_LABELS: Record<PipelineSortKey, string> = {
  recent: 'Mais recentes',
  oldest_crm: 'Mais antigos no CRM',
  value_desc: 'Maior valor',
  score_desc: 'Mais quentes (score)',
  next_contact: 'Próximo contato',
};

interface Props {
  value: PipelineSortKey;
  onChange: (v: PipelineSortKey) => void;
}

export function PipelineSortMenu({ value, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
          <ArrowDownWideNarrow size={13} />
          <span className="hidden sm:inline">Ordenar:</span> {SORT_LABELS[value]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(SORT_LABELS) as PipelineSortKey[]).map((k) => (
          <DropdownMenuItem key={k} onSelect={() => onChange(k)} className="gap-2">
            <Check size={13} className={value === k ? 'opacity-100' : 'opacity-0'} />
            {SORT_LABELS[k]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function sortLeads<T extends {
  created_at: string;
  entry_date?: string | null;
  value?: number | null;
  next_contact?: string | null;
}>(leads: T[], key: PipelineSortKey, scoreOf?: (l: T) => number): T[] {
  const copy = [...leads];
  switch (key) {
    case 'recent':
      copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'oldest_crm':
      copy.sort((a, b) => {
        const av = new Date(a.entry_date || a.created_at).getTime();
        const bv = new Date(b.entry_date || b.created_at).getTime();
        return av - bv;
      });
      break;
    case 'value_desc':
      copy.sort((a, b) => (b.value || 0) - (a.value || 0));
      break;
    case 'score_desc':
      if (scoreOf) copy.sort((a, b) => scoreOf(b) - scoreOf(a));
      break;
    case 'next_contact':
      copy.sort((a, b) => {
        const av = a.next_contact ? new Date(a.next_contact).getTime() : Infinity;
        const bv = b.next_contact ? new Date(b.next_contact).getTime() : Infinity;
        return av - bv;
      });
      break;
  }
  return copy;
}
