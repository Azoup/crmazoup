import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shirt, Scissors, Target, Shield, Loader2 } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'SDR' | 'Gestor'>('SDR');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (!formData.name.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        const { error } = await signUp(formData.email, formData.password, formData.name, selectedRole);
        if (error) throw error;
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;
      }
    } catch (err: any) {
      if (err.message?.includes('User already registered')) {
        setError('Este email já está cadastrado. Faça login.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos.');
      } else {
        setError('Erro ao autenticar. Verifique os dados.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4">
      <div className="bg-card p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
        <div className="bg-accent w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border-4 border-card relative">
          <Shirt className="text-primary drop-shadow-sm" size={48} strokeWidth={1.5} />
          <div className="absolute bottom-0 right-0 bg-card rounded-full p-2 shadow-md border border-border">
            <Scissors className="text-foreground transform -rotate-12" size={24} strokeWidth={2} />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">CRM Azoup</h1>
        <p className="text-muted-foreground mb-6">
          {isRegistering ? 'Criar Nova Conta' : 'Acesse sua Conta'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div className="bg-muted p-1 rounded-lg flex mb-4 shadow-inner">
              <button
                type="button"
                onClick={() => setSelectedRole('SDR')}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition ${
                  selectedRole === 'SDR' 
                    ? 'bg-card text-primary shadow' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Target size={16} /> Sou SDR
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('Gestor')}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition ${
                  selectedRole === 'Gestor' 
                    ? 'bg-card text-primary shadow' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Shield size={16} /> Sou Gestor
              </button>
            </div>
          )}

          {isRegistering && (
            <div className="text-left">
              <Label htmlFor="name">Seu Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Nome completo"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          )}
          
          <div className="text-left">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div className="text-left">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          
          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aguarde...
              </>
            ) : (
              isRegistering ? 'Cadastrar' : 'Entrar'
            )}
          </Button>
        </form>

        <button
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError('');
          }}
          className="mt-4 text-muted-foreground text-sm hover:text-primary underline"
        >
          {isRegistering ? 'Já tem conta? Fazer Login' : 'Não tem conta? Cadastre-se'}
        </button>
      </div>
      
      <p className="mt-8 text-primary-foreground/60 text-sm">© 2024 Azoup Tecnologia</p>
    </div>
  );
}