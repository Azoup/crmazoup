import { LeadFilters } from '@/types/lead';
import { Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FilterBarProps {
  filters: LeadFilters;
  setFilters: (filters: LeadFilters) => void;
}

export function FilterBar({ filters, setFilters }: FilterBarProps) {
  return (
    <div className="bg-card p-3 rounded-lg shadow-sm border border-border mb-6 flex flex-col md:flex-row gap-3 items-center">
      <div className="flex items-center gap-2 text-muted-foreground w-full md:w-auto">
        <Filter size={18} /> 
        <span className="font-bold text-sm hidden md:inline">Filtros:</span>
      </div>
      
      <div className="relative flex-1 w-full">
        <Search className="absolute left-2 top-2.5 text-muted-foreground" size={14} />
        <Input
          type="text"
          placeholder="Buscar..."
          className="pl-8"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>
      
      <select
        className="p-2 border rounded text-sm bg-muted outline-none w-full md:w-auto"
        value={filters.temperature}
        onChange={(e) => setFilters({ ...filters, temperature: e.target.value as any })}
      >
        <option value="todos">Temp: Todos</option>
        <option value="frio">❄️ Frio</option>
        <option value="morno">☕ Morno</option>
        <option value="quente">🔥 Quente</option>
      </select>
      
      <Input
        type="text"
        placeholder="Tipo (Ex: Jeans)"
        className="w-full md:w-auto"
        value={filters.confectionType}
        onChange={(e) => setFilters({ ...filters, confectionType: e.target.value })}
      />
    </div>
  );
}