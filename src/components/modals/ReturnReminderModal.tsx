import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MessageSquare, RotateCcw, Clock, User, Building2 } from 'lucide-react';

interface ReturnReminderModalProps {
  lead: Lead;
  onReturnCompleted: (leadId: string) => void;
  onDismiss: (leadId: string) => void;
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

export function ReturnReminderModal({ lead, onReturnCompleted, onDismiss }: ReturnReminderModalProps) {
  const contactTime = lead.next_contact ? parseDateLocal(lead.next_contact) : null;

  const handleWhatsApp = () => {
    if (lead.whatsapp) {
      const cleaned = lead.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleaned}`, '_blank');
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
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-info" />
                <span className="text-sm text-foreground">{lead.email}</span>
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

          {/* Quick actions */}
          <div className="flex gap-2">
            {lead.whatsapp && (
              <Button onClick={handleWhatsApp} className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground">
                <MessageSquare size={16} /> WhatsApp
              </Button>
            )}
            {lead.email && (
              <Button
                onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Mail size={16} /> Email
              </Button>
            )}
            {lead.whatsapp && (
              <Button
                onClick={() => window.open(`tel:${lead.whatsapp}`, '_blank')}
                variant="outline"
                className="gap-2"
              >
                <Phone size={16} />
              </Button>
            )}
          </div>

          {/* Main action */}
          <Button
            onClick={() => onReturnCompleted(lead.id)}
            className="w-full gap-2"
          >
            ✅ Retorno Realizado
          </Button>

          <Button
            onClick={() => onDismiss(lead.id)}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            Lembrar depois
          </Button>
        </div>
      </div>
    </div>
  );
}
