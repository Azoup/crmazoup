import { useState } from 'react';
import { Lead, NextContactType } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getNextAttemptNumber,
  getReturnReminderCopy,
  MAX_CONTACT_ATTEMPTS,
  suggestNextContactDateTime,
} from '@/lib/contactFollowUp';
import { MessageSquare, Phone, Shuffle, XCircle } from 'lucide-react';

interface ScheduleReturnModalProps {
  lead: Lead;
  onClose: () => void;
  onConfirm: (nextContact: string, contactType: NextContactType) => Promise<void>;
}

export function ScheduleReturnModal({ lead, onClose, onConfirm }: ScheduleReturnModalProps) {
  const [nextDate, setNextDate] = useState(suggestNextContactDateTime);
  const [contactType, setContactType] = useState<NextContactType>('mensagem');
  const [saving, setSaving] = useState(false);

  const nextAttempt = getNextAttemptNumber(lead);
  const preview = getReturnReminderCopy(lead, contactType);

  const handleConfirm = async () => {
    if (!nextDate) return;
    setSaving(true);
    try {
      await onConfirm(nextDate, contactType);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalPanel>
        <header className="bg-primary/10 border-b border-border p-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">Agendar retorno</h2>
            <p className="text-sm text-muted-foreground truncate">{lead.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Fechar">
            <XCircle size={22} />
          </button>
        </header>
        <div className="p-5 space-y-4">
          <ContactTypePicker value={contactType} onChange={setContactType} />
          <ReminderPreview preview={preview} contactType={contactType} nextAttempt={nextAttempt} />
          <DateTimeField value={nextDate} onChange={setNextDate} />
          <FooterActions saving={saving} disabled={!nextDate} onCancel={onClose} onConfirm={handleConfirm} />
        </div>
      </ModalPanel>
    </ModalBackdrop>
  );
}

function ContactTypePicker({ value, onChange }: { value: NextContactType; onChange: (v: NextContactType) => void }) {
  return (
    <div>
      <Label className="text-sm font-semibold">Próximo contato será por</Label>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Button type="button" variant={value === 'mensagem' ? 'default' : 'outline'} className="gap-2 h-auto py-3 flex-col" onClick={() => onChange('mensagem')}>
          <MessageSquare size={18} /> Mensagem
        </Button>
        <Button type="button" variant={value === 'ligacao' ? 'default' : 'outline'} className="gap-2 h-auto py-3 flex-col" onClick={() => onChange('ligacao')}>
          <Phone size={18} /> Ligação
        </Button>
      </div>
    </div>
  );
}

function ReminderPreview({ preview, contactType, nextAttempt }: { preview: { title: string; subtitle: string }; contactType: NextContactType; nextAttempt: number }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
      <p className="font-semibold text-foreground">{preview.title}</p>
      <p className="mt-1">{preview.subtitle}</p>
      {contactType === 'ligacao' && nextAttempt === MAX_CONTACT_ATTEMPTS - 1 && (
        <p className="mt-2 text-warning font-medium">Esta será a penúltima tentativa antes do último contato da sequência.</p>
      )}
    </div>
  );
}

function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">Data e hora</Label>
      <div className="flex gap-2 mt-1">
        <Input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
        <Button type="button" variant="outline" size="icon" onClick={() => onChange(suggestNextContactDateTime())} title="Sugerir horario comercial">
          <Shuffle size={16} />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">Horário comercial · 1 a 3 dias úteis</p>
    </div>
  );
}

function FooterActions({ saving, disabled, onCancel, onConfirm }: { saving: boolean; disabled: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>Cancelar</Button>
      <Button type="button" className="flex-1" onClick={onConfirm} disabled={saving || disabled}>{saving ? 'Salvando...' : 'Confirmar'}</Button>
    </div>
  );
}

function ModalPanel({ children }: { children: React.ReactNode }) {
  return <div role="dialog" aria-modal="true" className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>{children}</div>;
}

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose} role="presentation">{children}</div>;
}

