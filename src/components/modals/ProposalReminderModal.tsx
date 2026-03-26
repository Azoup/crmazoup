import { Lead } from '@/types/lead';
import { Phone, Mail, MessageSquare, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProposalReminderModalProps {
  lead: Lead;
  onClose: () => void;
}

export function ProposalReminderModal({ lead, onClose }: ProposalReminderModalProps) {
  const handleWhatsApp = () => {
    if (lead.whatsapp) {
      const cleaned = lead.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleaned}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border-2 border-warning rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-warning/15 border-b border-warning/30 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-warning/20 p-2.5 rounded-full">
              <AlertTriangle size={24} className="text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">⏰ Retorno Pendente!</h2>
              <p className="text-sm text-muted-foreground">Proposta aguardando retorno</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Lead Info */}
        <div className="p-6 space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Lead</p>
              <p className="text-xl font-bold text-foreground">{lead.name}</p>
            </div>
            
            {lead.company && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Empresa</p>
                <p className="text-sm text-foreground">{lead.company}</p>
              </div>
            )}

            {lead.whatsapp && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">WhatsApp</p>
                <p className="text-base font-semibold text-foreground">{lead.whatsapp}</p>
              </div>
            )}

            {lead.email && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Email</p>
                <p className="text-sm text-foreground">{lead.email}</p>
              </div>
            )}

            {lead.next_contact && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Retorno agendado para</p>
                <p className="text-sm font-semibold text-destructive">
                  {new Date(lead.next_contact).toLocaleString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {lead.whatsapp && (
              <Button onClick={handleWhatsApp} className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white">
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
                className="flex-1 gap-2"
              >
                <Phone size={16} /> Ligar
              </Button>
            )}
          </div>

          <Button onClick={onClose} variant="secondary" className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
