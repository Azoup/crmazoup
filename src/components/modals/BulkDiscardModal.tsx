import { useState } from 'react';
import { Lead, LeadHistory } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const LOSS_REASONS = [
  'Preço',
  'Sem Interesse',
  'Já possui sistema',
  'Não Responde',
  'Pequeno',
  'Fechou com outra empresa',
  'Deixou pro futuro',
  'Private Label',
  'Número inexistente',
  'Teste do Marketing',
  'Tentativas excedidas',
  'Só visualiza (não interage)',
  'Outro',
];

const BULK_LIMIT = 50;

interface Props {
  leads: Lead[];
  onClose: () => void;
  onDone?: () => void;
  updateLead: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
  addHistory?: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
}

export function BulkDiscardModal({ leads, onClose, onDone, updateLead, addHistory }: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>('Sem Interesse');
  const [custom, setCustom] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const targets = leads.slice(0, BULK_LIMIT);
  const finalReason = reason === 'Outro' ? custom.trim() || 'Outro' : reason;

  const handleDiscard = async () => {
    setRunning(true);
    let ok = 0;
    for (let i = 0; i < targets.length; i++) {
      const lead = targets[i];
      const success = await updateLead(lead.id, {
        stage: 'perdidos',
        loss_reason: finalReason,
      });
      if (success) {
        ok++;
        await addHistory?.(lead.id, 'sistema', `Descartado em massa — motivo: ${finalReason}`);
      }
      setProgress(Math.round(((i + 1) / targets.length) * 100));
    }
    setRunning(false);
    toast({
      title: 'Leads descartados',
      description: `${ok} de ${targets.length} movidos para Perdidos (${finalReason}).`,
    });
    onDone?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card glass border border-border/50 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Trash2 className="text-destructive" size={18} />
            <h2 className="font-bold text-foreground">Descartar leads</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={running}>
            <XCircle size={18} />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{targets.length}</strong> lead(s) serão movidos para
            Perdidos (máximo de {BULK_LIMIT} por vez).
            {leads.length > BULK_LIMIT && (
              <span className="block text-warning mt-1">
                Você selecionou {leads.length}; apenas os primeiros {BULK_LIMIT} serão processados.
              </span>
            )}
          </p>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Motivo da perda</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason === 'Outro' && (
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Descreva o motivo"
              />
            )}
          </div>

          {running && <Progress value={progress} />}
        </div>

        <div className="p-5 border-t border-border/50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={running}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDiscard} disabled={running} className="gap-2">
            {running ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Descartar {targets.length}
          </Button>
        </div>
      </div>
    </div>
  );
}
