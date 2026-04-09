import { useState } from 'react';
import { Lead, LeadStage } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Mail, MessageSquare, RotateCcw, Clock, User, Building2, TimerOff, Snowflake, XCircle, Calendar } from 'lucide-react';

interface ReturnReminderModalProps {
  lead: Lead;
  onReturnCompleted: (leadId: string, nextContact?: string, moveToStage?: LeadStage, lossReason?: string) => void;
  onDismiss: (leadId: string) => void;
  onSnoozeAll?: () => void;
  canSnooze?: boolean;
  snoozeCount?: number;
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

function suggestNextDate(): string {
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  // Next business day
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(10, 0, 0, 0);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}T10:00`;
}

export function ReturnReminderModal({ lead, onReturnCompleted, onDismiss, onSnoozeAll, canSnooze = true, snoozeCount = 0 }: ReturnReminderModalProps) {
  const contactTime = lead.next_contact ? parseDateLocal(lead.next_contact) : null;
  const [showActions, setShowActions] = useState(false);
  const [nextDate, setNextDate] = useState(suggestNextDate());
  const [action, setAction] = useState<'completed' | 'congelados' | 'perdidos' | 'reuniao' | null>(null);
  const [lossReason, setLossReason] = useState('');

  const handleWhatsApp = () => {
    if (lead.whatsapp) {
      const cleaned = lead.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleaned}`, '_blank');
    }
  };

  const handleConfirm = () => {
    if (action === 'completed') {
      onReturnCompleted(lead.id, nextDate || undefined);
    } else if (action === 'congelados') {
      onReturnCompleted(lead.id, nextDate || undefined, 'congelados', lossReason || undefined);
    } else if (action === 'perdidos') {
      onReturnCompleted(lead.id, undefined, 'perdidos', lossReason || undefined);
    } else if (action === 'reuniao') {
      onReturnCompleted(lead.id, nextDate || undefined, 'reuniao');
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border-2 border-warning rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-warning/15 border-b border-warning/30 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-warning/20 p-2.5 rounded-full">
              <RotateCcw size={24} className="text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">📞 Hora de Retornar!</h2>
              <p className="text-sm text-muted-foreground">Retorno de contato agendado</p>
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
                  onClick={() => setAction('completed')}
                  className="gap-1.5"
                >
                  ✅ Contato feito
                </Button>
                <Button
                  variant={action === 'reuniao' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAction('reuniao')}
                  className="gap-1.5"
                >
                  <Calendar size={14} /> Reunião
                </Button>
                <Button
                  variant={action === 'congelados' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAction('congelados')}
                  className="gap-1.5"
                >
                  <Snowflake size={14} /> Congelar
                </Button>
                <Button
                  variant={action === 'perdidos' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAction('perdidos')}
                  className="gap-1.5"
                >
                  <XCircle size={14} /> Descartar
                </Button>
              </div>

              {(action === 'congelados' || action === 'perdidos') && (
                <div>
                  <Label className="text-xs">Motivo</Label>
                  <Input
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    placeholder="Informe o motivo..."
                    className="mt-1"
                  />
                </div>
              )}

              {action !== 'perdidos' && (
                <div>
                  <Label className="text-xs">Próximo contato sugerido</Label>
                  <Input
                    type="datetime-local"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <Button onClick={handleConfirm} className="w-full">
                Confirmar
              </Button>
            </div>
          )}

          {/* Snooze all button */}
          {onSnoozeAll && canSnooze && (
            <Button
              onClick={onSnoozeAll}
              variant="outline"
              className="w-full gap-2 border-warning/50 text-warning hover:bg-warning/10"
            >
              <TimerOff size={16} />
              Adiar todos por 1 hora ({7 - snoozeCount} restante{7 - snoozeCount !== 1 ? 's' : ''})
            </Button>
          )}

          {onSnoozeAll && !canSnooze && (
            <p className="text-xs text-center text-muted-foreground">
              Limite de adiamentos diários atingido (7/7)
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
