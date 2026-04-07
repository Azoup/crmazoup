import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, ShieldCheck } from 'lucide-react';

export function PendingApprovalPage() {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl border border-border/50 p-8 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-warning/15 rounded-full flex items-center justify-center">
          <Clock className="text-warning" size={40} strokeWidth={1.5} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Aguardando Aprovação</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Olá <span className="font-semibold text-foreground">{profile?.name}</span>, sua conta foi criada com sucesso!
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Um administrador precisa aprovar seu acesso antes que você possa utilizar o sistema.
          </p>
        </div>

        <div className="bg-muted/50 rounded-xl p-4 flex items-start gap-3 text-left">
          <ShieldCheck className="text-primary mt-0.5 flex-shrink-0" size={20} />
          <p className="text-xs text-muted-foreground">
            Após a aprovação, basta fazer login novamente para acessar o CRM Azoup.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={signOut}
          className="w-full gap-2"
        >
          <LogOut size={16} />
          Sair e Tentar Depois
        </Button>
      </div>
    </div>
  );
}
