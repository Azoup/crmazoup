import { useEffect, useMemo, useState } from 'react';
import { Lead, LeadStage, STAGE_LABELS, LeadHistory } from '@/types/lead';
import { useAuth } from '@/contexts/AuthContext';
import { cleanPhoneNumber } from '@/lib/utils';
import {
  MessageTemplate,
  applyTemplateVars,
  loadTemplates,
  saveTemplates,
} from '@/lib/messageTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  XCircle,
  Plus,
  Trash2,
  MessageCircle,
  Save,
  Copy,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Mode = 'manage' | 'pick';

interface Props {
  mode: Mode;
  lead?: Lead | null;
  onClose: () => void;
  addHistory?: (leadId: string, type: string, note: string) => Promise<LeadHistory[] | null>;
}

const STAGE_OPTIONS: Array<LeadStage | 'geral'> = [
  'geral',
  'prospeccao',
  'interesse',
  'reuniao',
  'proposta',
  'venda',
  'congelados',
  'perdidos',
];

const stageLabel = (s: LeadStage | 'geral') => (s === 'geral' ? 'Geral' : STAGE_LABELS[s]);

export function MessageTemplatesModal({ mode, lead, onClose, addHistory }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<MessageTemplate, 'id'>>({
    title: '',
    stage: 'geral',
    body: '',
  });

  useEffect(() => {
    setTemplates(loadTemplates(user?.id));
  }, [user?.id]);

  const persist = (next: MessageTemplate[]) => {
    setTemplates(next);
    if (user?.id) saveTemplates(user.id, next);
  };

  const startEdit = (t: MessageTemplate) => {
    setEditingId(t.id);
    setDraft({ title: t.title, stage: t.stage, body: t.body });
  };

  const resetDraft = () => {
    setEditingId(null);
    setDraft({ title: '', stage: 'geral', body: '' });
  };

  const handleSaveDraft = () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' });
      return;
    }
    if (editingId) {
      persist(templates.map((t) => (t.id === editingId ? { ...t, ...draft } : t)));
      toast({ title: 'Template atualizado' });
    } else {
      persist([{ id: crypto.randomUUID(), ...draft }, ...templates]);
      toast({ title: 'Template criado' });
    }
    resetDraft();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este template?')) return;
    persist(templates.filter((t) => t.id !== id));
    if (editingId === id) resetDraft();
  };

  const suggestedStage = (lead?.stage ?? 'geral') as LeadStage | 'geral';
  const pickerList = useMemo(() => {
    if (mode !== 'pick') return templates;
    const matching = templates.filter((t) => t.stage === suggestedStage);
    const generic = templates.filter((t) => t.stage === 'geral');
    const others = templates.filter(
      (t) => t.stage !== suggestedStage && t.stage !== 'geral',
    );
    return [...matching, ...generic, ...others];
  }, [templates, mode, suggestedStage]);

  const sendViaWhatsApp = async (template: MessageTemplate) => {
    if (!lead) return;
    if (!lead.whatsapp) {
      toast({ title: 'Lead sem WhatsApp cadastrado', variant: 'destructive' });
      return;
    }
    let msg = applyTemplateVars(template.body, lead);
    if (profile?.signature) msg += `\n\n${profile.signature}`;
    const phone = cleanPhoneNumber(lead.whatsapp);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    if (addHistory) {
      await addHistory(lead.id, 'whatsapp', `📝 Template "${template.title}": "${msg}"`);
    }
    onClose();
  };

  const copyToClipboard = async (template: MessageTemplate) => {
    const msg = lead ? applyTemplateVars(template.body, lead) : template.body;
    await navigator.clipboard.writeText(msg);
    toast({ title: 'Mensagem copiada!' });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border/60 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">
                {mode === 'pick' ? 'Escolher template' : 'Templates de WhatsApp'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {mode === 'pick'
                  ? `Enviar mensagem pronta para ${lead?.name || 'lead'}`
                  : 'Crie mensagens reutilizáveis com {nome}, {primeiro_nome}, {empresa}, {tipo}'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-all hover:scale-110"
            aria-label="Fechar"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Manage form */}
          {mode === 'manage' && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                <Input
                  placeholder="Título do template"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <Select
                  value={draft.stage}
                  onValueChange={(v) => setDraft({ ...draft, stage: v as LeadStage | 'geral' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {stageLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Digite a mensagem. Use {primeiro_nome}, {empresa}, {tipo}..."
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={4}
              />
              <div className="flex justify-end gap-2">
                {editingId && (
                  <Button variant="ghost" size="sm" onClick={resetDraft}>
                    Cancelar
                  </Button>
                )}
                <Button onClick={handleSaveDraft} size="sm" className="gap-1.5 hover-scale">
                  {editingId ? <Save size={14} /> : <Plus size={14} />}
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </div>
          )}

          {/* Templates list */}
          <div className="space-y-2">
            {pickerList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum template cadastrado ainda.
              </p>
            )}
            {pickerList.map((t) => {
              const preview = lead ? applyTemplateVars(t.body, lead) : t.body;
              const isMatchingStage = mode === 'pick' && t.stage === suggestedStage;
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border p-3 transition-all hover:border-primary/40 hover:shadow-md animate-fade-in ${
                    isMatchingStage
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/60 bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-foreground truncate">{t.title}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            t.stage === 'geral'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {stageLabel(t.stage)}
                        </span>
                        {isMatchingStage && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-success/15 text-success">
                            Recomendado
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {mode === 'pick' && (
                        <>
                          <button
                            onClick={() => copyToClipboard(t)}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-110"
                            title="Copiar mensagem"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => sendViaWhatsApp(t)}
                            className="p-1.5 rounded-md text-success hover:bg-success/10 transition-all hover:scale-110"
                            title="Enviar via WhatsApp"
                          >
                            <MessageCircle size={16} />
                          </button>
                        </>
                      )}
                      {mode === 'manage' && (
                        <>
                          <button
                            onClick={() => startEdit(t)}
                            className="text-xs font-semibold text-primary hover:underline px-2"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-all hover:scale-110"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {preview}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
