import { Lead, MeetingStatus } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { XCircle, UserCheck, UserX, Calendar } from 'lucide-react';

interface MeetingStatusModalProps {
  lead: Lead;
  onClose: () => void;
  onSelectStatus: (leadId: string, status: MeetingStatus) => void;
}

export function MeetingStatusModal({ lead, onClose, onSelectStatus }: MeetingStatusModalProps) {
  const handleSelect = (status: MeetingStatus) => {
    onSelectStatus(lead.id, status);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary p-4 text-primary-foreground relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-primary-foreground/60 hover:text-primary-foreground">
            <XCircle size={20} />
          </button>
          <h2 className="text-lg font-bold">Status da Reunião</h2>
          <p className="text-sm text-primary-foreground/70">{lead.name}</p>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Como foi a reunião com este lead?
          </p>

          <Button
            onClick={() => handleSelect('compareceu')}
            className="w-full justify-start gap-3 h-14 bg-success hover:bg-success/90"
          >
            <UserCheck size={20} />
            <div className="text-left">
              <div className="font-semibold">Compareceu</div>
              <div className="text-xs opacity-80">Cliente participou da reunião</div>
            </div>
          </Button>

          <Button
            onClick={() => handleSelect('no_show')}
            variant="destructive"
            className="w-full justify-start gap-3 h-14"
          >
            <UserX size={20} />
            <div className="text-left">
              <div className="font-semibold">No Show</div>
              <div className="text-xs opacity-80">Cliente não compareceu</div>
            </div>
          </Button>

          <Button
            onClick={() => handleSelect('reagendar')}
            variant="outline"
            className="w-full justify-start gap-3 h-14"
          >
            <Calendar size={20} />
            <div className="text-left">
              <div className="font-semibold">Reagendar Reunião</div>
              <div className="text-xs opacity-60">Marcar novo horário</div>
            </div>
          </Button>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full mt-2"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
