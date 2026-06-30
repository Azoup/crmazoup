import { LeadFilters } from '@/types/lead';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FilterBarProps {
  filters: LeadFilters;
  setFilters: (filters: LeadFilters) => void;
}

export function FilterBar({ filters, setFilters }: FilterBarProps) {
  return (
    <div className="bg-card/80 glass p-3 rounded-xl shadow-sm border border-border/50 mb-5 flex flex-col md:flex-row gap-2.5 items-center">
      <div className="flex items-center gap-2 text-muted-foreground flex-shrink-0">
        <SlidersHorizontal size={16} /> 
        <span className="font-semibold text-xs hidden md:inline">Filtros</span>
      </div>
      
      <div className="relative flex-1 w-full">
        <Search className="absolute left-2.5 top-2.5 text-muted-foreground/60" size={14} />
        <Input
          type="text"
          placeholder="Buscar por nome, empresa, telefone..."
          className="pl-8 h-9 bg-muted/50 border-border/50 text-sm"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>
      
      <select
        className="h-9 px-3 border border-border/50 rounded-md text-xs bg-muted/50 outline-none w-full md:w-auto font-medium text-foreground"
        value={filters.temperature}
        onChange={(e) => setFilters({ ...filters, temperature: e.target.value as any })}
      >
        <option value="todos">🌡️ Todos</option>
        <option value="frio">❄️ Frio</option>
        <option value="morno">☕ Morno</option>
        <option value="quente">🔥 Quente</option>
      </select>
      
      <Input
        type="text"
        placeholder="Tipo confecção"
        className="w-full md:w-36 h-9 bg-muted/50 border-border/50 text-sm"
        value={filters.confectionType}
        onChange={(e) => setFilters({ ...filters, confectionType: e.target.value })}
      />
      
      <Input
        type="email"
        placeholder="E-mail do lead"
        className="w-full md:w-44 h-9 bg-muted/50 border-border/50 text-sm"
        value={filters.email}
        onChange={(e) => setFilters({ ...filters, email: e.target.value })}
      />
    </div>
  );
}
