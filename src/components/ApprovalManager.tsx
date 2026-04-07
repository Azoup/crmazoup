import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PendingUser {
  id: string;
  user_id: string;
  name: string;
  role: string;
  created_at: string;
  approved: boolean;
}

export function ApprovalManager() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, name, role, created_at, approved')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data as PendingUser[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId: string, name: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approved: true })
      .eq('user_id', userId);

    if (!error) {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, approved: true } : u));
      toast({ title: '✅ Aprovado', description: `${name} agora pode acessar o sistema.` });
    }
  };

  const handleRevoke = async (userId: string, name: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approved: false })
      .eq('user_id', userId);

    if (!error) {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, approved: false } : u));
      toast({ title: 'Acesso revogado', description: `${name} não pode mais acessar o sistema.` });
    }
  };

  const pendingUsers = users.filter(u => !u.approved);
  const approvedUsers = users.filter(u => u.approved);

  if (loading) return <div className="text-center text-muted-foreground p-8">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Pending */}
      {pendingUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-warning flex items-center gap-2 mb-3">
            <Clock size={16} /> Aguardando Aprovação ({pendingUsers.length})
          </h3>
          <div className="space-y-2">
            {pendingUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between bg-warning/10 border border-warning/20 rounded-xl p-3">
                <div>
                  <p className="font-medium text-sm text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.role} • {new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <Button size="sm" onClick={() => handleApprove(user.user_id, user.name)} className="gap-1.5 h-8">
                  <CheckCircle2 size={14} /> Aprovar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved */}
      <div>
        <h3 className="text-sm font-semibold text-success flex items-center gap-2 mb-3">
          <UserCheck size={16} /> Usuários Aprovados ({approvedUsers.length})
        </h3>
        <div className="space-y-2">
          {approvedUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
              <div>
                <p className="font-medium text-sm text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleRevoke(user.user_id, user.name)} className="gap-1.5 h-8 text-destructive hover:text-destructive">
                <XCircle size={14} /> Revogar
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
