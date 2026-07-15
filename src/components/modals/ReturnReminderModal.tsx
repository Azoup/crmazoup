import { useState } from 'react';
import { Lead, LeadStage, NextContactType } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getReturnReminderCopy, suggestNextContactDateTime } from '@/lib/contactFollowUp';
import { Phone, Mail, MessageSquare, RotateCcw, Clock, User, Building2, TimerOff, Snowflake, XCircle, Calendar, Shuffle } from 'lucide-react';

interface ReturnReminderModalProps {
  lead: Lead;
  onReturnCompleted: (
    leadId: string,
    nextContact?: string,
    moveToStage?: LeadStage,
    lossReason?: string,
    nextContactType?: NextContactType,
  ) => void;
  onDismiss: (leadId: string) => void;
  onSnoozeAll?: () => void;
  onSnoozeShort?: () => void;
  canSnooze?: boolean;
  snoozeCount?: number;
  canShortSnooze?: boolean;
  shortSnoozeCount?: number;
}

function parseDateLocal(dateStr: string): Date {
  const cleanStr = dateStr.replace(/[+-]\d{2}(:\d{2})?$/, '').replace('Z', '').trim();
  if (cleanStr.includes('T')) {
    const [d, t] = cleanStr.split('T');
    const [y, m, day] = d.split('-').map(Number);
    const tp = t.split(':').map(Number);
    return new Date(y, m - 1, day, tp[0] || 0, tp[1] || 0);
  }
  const [y, m, day] = cleanStr.split('-').map(Number);
  return new Date(y, m - 1, day);
}

const LOSS_REASONS = [
  'Preço',
  'Sem Interesse',
  'Já possui sistema',
  'Não Responde',
  'Pequeno demais',
  'Fechou com outra empresa',
  'Deixou pro futuro',
  'Private Label',
  'Número inexistente',
  'Teste do Marketing',
  'Tentativas excedidas',
  'Só visualiza (não interage)',
];

const FREEZE_REASONS = [
  'Pediu para ligar depois',
  'Viajando',
  'Sem orçamento no momento',
  'Aguardando decisão interna',
  'Período de férias',
  'Em processo com outro fornecedor',
];

export function ReturnReminderModal({ lead, onReturnCompleted, onDismiss, onSnoozeAll, onSnoozeShort, canSnooze = true, snoozeCount = 0, canShortSnooze = true, shortSnoozeCount = 0 }: ReturnReminderModalProps) {
  const contactTime = lead.next_contact ? parseDateLocal(lead.next_contact) : null;
  const reminderCopy = getReturnReminderCopy(lead);
  const [showActions, setShowActions] = useState(false);
  const [nextDate, setNextDate] = useState(suggestNextContactDateTime);
  const [nextContactType, setNextContactType] = useState<NextContactType>(
    lead.next_contact_type === 'ligacao' ? 'ligacao' : 'mensagem',
  );
  const [action, setAction] = useState<'completed' | 'congelados' | 'perdidos' | 'reuniao' | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleWhatsApp = () => {
    if (lead.whatsapp) {
      const cleaned = lead.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleaned}`, '_blank');
    }
  };

  const handleRandomize = () => {
    setNextDate(suggestNextContactDateTime());
  };

  const finalReason = lossReason === 'Outro' ? customReason : lossReason;

  const handleConfirm = () => {
    const contactTypeForNext =
      action === 'perdidos' ? undefined : nextContactType;
    if (action === 'completed') {
      onReturnCompleted(lead.id, nextDate || undefined, undefined, undefined, contactTypeForNext);
    } else if (action === 'congelados') {
      onReturnCompleted(lead.id, nextDate || undefined, 'congelados', finalReason || undefined, contactTypeForNext);
    } else if (action === 'perdidos') {
      onReturnCompleted(lead.id, undefined, 'perdidos', finalReason || undefined);
    } else if (action === 'reuniao') {
      onReturnCompleted(lead.id, nextDate || undefined, 'reuniao', undefined, contactTypeForNext);
    }
  };

  const nextPreview = getReturnReminderCopy(lead, nextContactType);

  const reasonOptions = action === 'perdidos' ? LOSS_REASONS : FREEZE_REASONS;

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border-2 border-warning rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-warning/15 border-b border-warning/30 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-warning/20 p-2.5 rounded-full">
              <RotateCcw size={24} className="text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{reminderCopy.title}</h2>
              <p className="text-sm text-muted-foreground">{reminderCopy.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Lead info */}
        <div className="p-5 space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User size={14} className="text-primary" />
              <span className="text-lg font-bold text-foreground">{lead.name}</span>
            </div>
            {lead.company && (
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-muted-foreground" />
                <span className="text-sm text-foreground">{lead.company}</span>
              </div>
            )}
            {lead.whatsapp && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-success" />
                <span className="text-sm font-semibold text-foreground">{lead.whatsapp}</span>
              </div>
            )}
            {contactTime && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-warning" />
                <span className="text-sm text-warning font-semibold">
                  Agendado: {contactTime.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          {/* Quick contact actions */}
          <div className="flex gap-2">
            {lead.whatsapp && (
              <Button onClick={handleWhatsApp} className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground">
                <MessageSquare size={16} /> WhatsApp
              </Button>
            )}
            {lead.email && (
              <Button onClick={() => window.open(`mailto:${lead.email}`, '_blank')} variant="outline" className="flex-1 gap-2">
                <Mail size={16} /> Email
              </Button>
            )}
            {lead.whatsapp && (
              <Button onClick={() => window.open(`tel:${lead.whatsapp}`, '_blank')} variant="outline" className="gap-2">
                <Phone size={16} />
              </Button>
            )}
          </div>

          {/* Action selection */}
          {!showActions ? (
            <Button onClick={() => { setShowActions(true); setAction('completed'); }} className="w-full gap-2">
              ✅ Retorno Realizado
            </Button>
          ) : (
            <div className="space-y-3 border border-border rounded-xl p-4 bg-muted/30">
              <Label className="text-sm font-semibold">O que aconteceu?</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={action === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setAction('completed'); setLossReason(''); }}
                  className="gap-1.5"
                >
                  ✅ Contato feito
                </Button>
                <Button
                  variant={action === 'reuniao' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setAction('reuniao'); setLossReason(''); }}
                  className="gap-1.5"
                >
                  <Calendar size={14} /> Reunião
                </Button>
                <Button
                  variant={action === 'congelados' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setAction('congelados'); setLossReason(''); }}
                  className="gap-1.5"
                >
                  <Snowflake size={14} /> Congelar
                </Button>
                <Button
                  variant={action === 'perdidos' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setAction('perdidos'); setLossReason(''); }}
                  className="gap-1.5"
                >
                  <XCircle size={14} /> Descartar
                </Button>
              </div>

              {(action === 'congelados' || action === 'perdidos') && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Motivo</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {reasonOptions.map((reason) => (
                      <Button
                        key={reason}
                        variant={lossReason === reason ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => setLossReason(reason)}
                      >
                        {reason}
                      </Button>
                    ))}
                    <Button
                      variant={lossReason === 'Outro' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => setLossReason('Outro')}
                    >
                      Outro...
                    </Button>
                  </div>
                  {lossReason === 'Outro' && (
                    <Input
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Escreva o motivo..."
                      className="mt-1"
                    />
                  )}
                </div>
              )}

              {action !== 'perdidos' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Próximo contato será por</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Button
                        type="button"
                        variant={nextContactType === 'mensagem' ? 'default' : 'outline'}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setNextContactType('mensagem')}
                      >
                        <MessageSquare size={14} /> Mensagem
                      </Button>
                      <Button
                        type="button"
                        variant={nextContactType === 'ligacao' ? 'default' : 'outline'}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setNextContactType('ligacao')}
                      >
                        <Phone size={14} /> Ligação
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/80 px-2 py-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{nextPreview.title}</span>
                    {' — '}
                    {nextPreview.subtitle}
                  </div>
                  <div>
                    <Label className="text-xs">Data e hora</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="datetime-local"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRandomize}
                        title="Aleatorizar horário (1-3 dias, horário comercial)"
                        className="shrink-0"
                      >
                        <Shuffle size={16} />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Horário comercial · até 3 dias à frente
                    </p>
                  </div>
                </div>
              )}

                            <Button onClick={handleConfirm} className="w-full" disabled={
                (action === 'congelados' || action === 'perdidos') && !finalReason
              }>
                Confirmar
              </Button>
            </div>
          )}

          {/* Short snooze (20 min) */}
          {onSnoozeShort && canShortSnooze && (
            <Button
              onClick={onSnoozeShort}
              variant="outline"
              className="w-full gap-2 border-info/50 text-info hover:bg-info/10"
            >
              <TimerOff size={16} />
              Adiar 20 minutos ({4 - shortSnoozeCount} restante{4 - shortSnoozeCount !== 1 ? 's' : ''})
            </Button>
          )}

          {onSnoozeShort && !canShortSnooze && (
            <p className="text-xs text-center text-muted-foreground">
              Limite de adiamentos curtos atingido (4/4)
            </p>
          )}

          {/* Long snooze (1h) */}
          {onSnoozeAll && canSnooze && (
            <Button
              onClick={onSnoozeAll}
              variant="outline"
              className="w-full gap-2 border-warning/50 text-warning hover:bg-warning/10"
            >
              <TimerOff size={16} />
              Adiar 1 hora ({7 - snoozeCount} restante{7 - snoozeCount !== 1 ? 's' : ''})
            </Button>
          )}

          {onSnoozeAll && !canSnooze && (
            <p className="text-xs text-center text-muted-foreground">
              Limite de adiamentos de 1h atingido (7/7)
            </p>
          )}

          <Button onClick={() => onDismiss(lead.id)} variant="ghost" className="w-full text-muted-foreground">
            Lembrar depois
          </Button>
        </div>
      </div>
    </div>
  );
}
