import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Bell, Video, Phone, MessageSquare, Clock, User, Building2, X } from 'lucide-react';

interface MeetingAlertModalProps {
  lead: Lead;
  onDismiss: () => void;
  onOpenLead: (lead: Lead) => void;
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

export function MeetingAlertModal({ lead, onDismiss, onOpenLead }: MeetingAlertModalProps) {
  const meetingTime = lead.meeting_date ? parseDateLocal(lead.meeting_date) : null;
  const now = new Date();
  const minsLeft = meetingTime ? Math.max(0, Math.round((meetingTime.getTime() - now.getTime()) / 60000)) : 0;

  const sendWhatsAppReminder = () => {
    if (lead.whatsapp) {
      const cleaned = lead.whatsapp.replace(/\D/g, '');
      const msg = encodeURIComponent(
        `Olá ${lead.name}! 😊\n\nSó passando para lembrar que nossa reunião começa em ${minsLeft} minutos.${lead.meeting_link ? `\n\nLink: ${lead.meeting_link}` : ''}\n\nTe aguardo! 🚀`
      );
      window.open(`https://wa.me/55${cleaned}?text=${msg}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border-2 border-primary rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95">
        {/* Pulsing header */}
        <div className="bg-primary p-5 text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-primary-foreground/5 animate-pulse" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary-foreground/20 p-2.5 rounded-full animate-bounce">
                <Bell size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold">🔔 Reunião em {minsLeft} min!</h2>
                <p className="text-sm text-primary-foreground/80">Envie um lembrete ao cliente</p>
              </div>
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
            {meetingTime && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {meetingTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {lead.meeting_link && (
              <div className="flex items-center gap-2">
                <Video size={14} className="text-info" />
                <a 
                  href={lead.meeting_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-info hover:underline truncate"
                >
                  {lead.meeting_link}
                </a>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {lead.whatsapp && (
              <Button 
                onClick={sendWhatsAppReminder} 
                className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
              >
                <MessageSquare size={16} /> Lembrete WhatsApp
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

          {lead.meeting_link && (
            <Button
              onClick={() => window.open(lead.meeting_link!, '_blank')}
              variant="outline"
              className="w-full gap-2"
            >
              <Video size={16} /> Entrar na Reunião
            </Button>
          )}

          <Button
            onClick={() => {
              onDismiss();
            }}
            variant="secondary"
            className="w-full"
          >
            ✅ Entendido, Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
