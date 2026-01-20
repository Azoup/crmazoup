import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { XCircle, LogOut, Save } from 'lucide-react';

interface ProfileModalProps {
  onClose: () => void;
  leads: Lead[];
  salesGoal: number;
}

export function ProfileModal({ onClose, leads, salesGoal }: ProfileModalProps) {
  const { profile, updateProfile, signOut } = useAuth();
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    avatar: profile?.avatar || '',
    signature: profile?.signature || '',
  });

  const handleSave = async () => {
    await updateProfile(formData);
    onClose();
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  const totalSold = leads.filter(l => l.stage === 'venda').reduce((acc, l) => acc + l.value, 0);
  const percentGoal = salesGoal > 0 ? Math.min(100, (totalSold / salesGoal) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary p-6 text-primary-foreground text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-primary-foreground/60 hover:text-primary-foreground">
            <XCircle size={24} />
          </button>
          
          <ImageUpload 
            currentImage={formData.avatar || null}
            onImageChange={(url) => setFormData({ ...formData, avatar: url || '' })}
          />
          
          <h2 className="text-xl font-bold mt-3">{formData.name}</h2>
          <p className="text-sm text-primary-foreground/70">{profile?.role}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-foreground">{leads.length}</p>
              <p className="text-xs text-muted-foreground">Leads</p>
            </div>
            <div className="text-center p-3 bg-success/10 rounded-lg">
              <p className="text-2xl font-bold text-success">{percentGoal.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Meta</p>
            </div>
          </div>

          <div>
            <Label>Nome</Label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          
          <div>
            <Label>Assinatura WhatsApp</Label>
            <Textarea value={formData.signature} onChange={e => setFormData({ ...formData, signature: e.target.value })} rows={2} placeholder="Ex: João - Azoup Tecnologia" />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleLogout} className="flex-1 text-destructive border-destructive/30">
              <LogOut size={16} className="mr-2" /> Sair
            </Button>
            <Button onClick={handleSave} className="flex-1">
              <Save size={16} className="mr-2" /> Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
