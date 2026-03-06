import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { useMonthlyMetrics, getCurrentReferenceMonth, formatReferenceMonth } from '@/hooks/useMonthlyMetrics';
import { 
  XCircle, LogOut, Save, Users, UserX, Calendar, UserCheck, 
  DollarSign, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight,
  Target as TargetIcon
} from 'lucide-react';

interface ProfileModalProps {
  onClose: () => void;
  leads: Lead[];
  salesGoal: number;
  meetingGoal?: number;
  onUpdateSettings?: (updates: any) => void;
}

export function ProfileModal({ onClose, leads, salesGoal, meetingGoal = 0, onUpdateSettings }: ProfileModalProps) {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    avatar: profile?.avatar || '',
    signature: profile?.signature || '',
    meetingGoal: meetingGoal,
  });
  const [activeTab, setActiveTab] = useState<'profile' | 'metrics'>('metrics');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentReferenceMonth());

  // Dashboard pessoal do usuário logado (não mistura leads de gestor/SDRs vinculados)
  const userScopedLeads = useMemo(
    () => leads.filter((lead) => lead.user_id === user?.id),
    [leads, user?.id]
  );

  const metrics = useMonthlyMetrics(userScopedLeads, selectedMonth);

  const handleSave = async () => {
    await updateProfile({ name: formData.name, avatar: formData.avatar, signature: formData.signature });
    if (onUpdateSettings && formData.meetingGoal !== meetingGoal) {
      onUpdateSettings({ meeting_goal: formData.meetingGoal });
    }
    onClose();
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  // Meta de vendas é calculada apenas com valor de implantação
  const totalImplementation = userScopedLeads
    .filter((l) => l.stage === 'venda')
    .reduce((acc, l) => acc + (l.implementation_value || 0), 0);
  const percentGoal = salesGoal > 0 ? Math.min(100, (totalImplementation / salesGoal) * 100) : 0;

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
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

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'metrics' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📊 Dashboard Mensal
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'profile' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            👤 Meu Perfil
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'metrics' ? (
            <div className="space-y-4">
              {/* Month Navigator */}
              <div className="flex items-center justify-between bg-muted rounded-lg p-3">
                <button 
                  onClick={() => navigateMonth('prev')}
                  className="p-1 hover:bg-background rounded"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="font-semibold text-foreground">
                  {formatReferenceMonth(selectedMonth)}
                </span>
                <button 
                  onClick={() => navigateMonth('next')}
                  className="p-1 hover:bg-background rounded"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Período: dia 01 ao último dia do mês
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard 
                  icon={Users} 
                  label="Leads Recebidos" 
                  value={metrics.totalLeads.toString()}
                  color="text-primary"
                  bgColor="bg-primary/10"
                />
                <MetricCard 
                  icon={UserX} 
                  label="Sem Resposta" 
                  value={metrics.leadsWithoutResponse.toString()}
                  color="text-warning"
                  bgColor="bg-warning/10"
                />
                <MetricCard 
                  icon={Calendar} 
                  label="Reuniões Marcadas" 
                  value={metrics.meetingsScheduled.toString()}
                  color="text-info"
                  bgColor="bg-info/10"
                />
                <MetricCard 
                  icon={UserCheck} 
                  label="Compareceram" 
                  value={metrics.meetingsAttended.toString()}
                  color="text-success"
                  bgColor="bg-success/10"
                />
                <MetricCard 
                  icon={UserX} 
                  label="No Show" 
                  value={metrics.meetingsNoShow.toString()}
                  color="text-destructive"
                  bgColor="bg-destructive/10"
                />
                <MetricCard 
                  icon={DollarSign} 
                  label="Vendas Fechadas" 
                  value={metrics.salesClosed.toString()}
                  color="text-success"
                  bgColor="bg-success/10"
                />
                <MetricCard 
                  icon={AlertTriangle} 
                  label="Leads Inválidos" 
                  value={metrics.invalidLeads.toString()}
                  color="text-muted-foreground"
                  bgColor="bg-muted"
                />
                <MetricCard 
                  icon={TrendingUp} 
                  label="Meta Atingida" 
                  value={`${percentGoal.toFixed(0)}%`}
                  color={percentGoal >= 100 ? 'text-success' : 'text-warning'}
                  bgColor={percentGoal >= 100 ? 'bg-success/10' : 'bg-warning/10'}
                />
              </div>

              {/* Meeting Goal Fun Tracker */}
              {formData.meetingGoal > 0 && (
                <div className="bg-card rounded-lg border border-border/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TargetIcon size={16} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">Meta Pessoal de Reuniões 🎯</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Progress 
                        value={formData.meetingGoal > 0 ? Math.min(100, (metrics.meetingsAttended / formData.meetingGoal) * 100) : 0} 
                        className="h-3" 
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      {metrics.meetingsAttended}/{formData.meetingGoal}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.meetingsAttended >= formData.meetingGoal 
                      ? '🎉 Meta batida! Parabéns!' 
                      : `Faltam ${formData.meetingGoal - metrics.meetingsAttended} reunião(ões)`
                    }
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{userScopedLeads.length}</p>
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

              <div>
                <Label>Meta Pessoal de Reuniões (mês) 🎯</Label>
                <Input 
                  type="number" 
                  value={formData.meetingGoal || ''} 
                  onChange={e => setFormData({ ...formData, meetingGoal: Number(e.target.value) || 0 })} 
                  placeholder="Ex: 10"
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">Meta divertida para acompanhar suas reuniões realizadas</p>
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
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}

function MetricCard({ icon: Icon, label, value, color, bgColor }: MetricCardProps) {
  return (
    <div className={`p-3 rounded-lg ${bgColor} flex items-center gap-3`}>
      <div className={`p-2 rounded-full bg-background ${color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
