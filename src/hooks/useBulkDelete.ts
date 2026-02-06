import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useBulkDelete(onSuccess?: () => void) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const confirmed = confirm(`Tem certeza que deseja excluir ${selectedIds.size} lead(s)?`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      // Delete in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase
          .from('leads')
          .delete()
          .in('id', batch);

        if (error) {
          console.error('Error deleting leads batch:', error);
          toast({ title: 'Erro', description: `Erro ao excluir leads: ${error.message}`, variant: 'destructive' });
          return;
        }
      }

      toast({ title: 'Sucesso', description: `${ids.length} lead(s) excluído(s) com sucesso!` });
      setSelectedIds(new Set());
      onSuccess?.();
    } catch (err) {
      console.error('Unexpected error deleting leads:', err);
      toast({ title: 'Erro', description: 'Erro inesperado ao excluir leads', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, toast, onSuccess]);

  return {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    deleteSelected,
    deleting,
    hasSelection: selectedIds.size > 0,
    selectionCount: selectedIds.size,
  };
}
