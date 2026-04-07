import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shirt, Scissors, Target, Shield, Loader2, ArrowLeft, Mail, KeyRound } from 'lucide-react';
import { AnimatedLogo } from '@/components/AnimatedLogo';

type AuthView = 'login' | 'register' | 'forgot' | 'reset';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');
  const [selectedRole, setSelectedRole] = useState<'SDR' | 'Gestor'>('SDR');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', newPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (authView === 'register') {
        if (!formData.name.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        const { error } = await signUp(formData.email, formData.password, formData.name, selectedRole);
        if (error) throw error;
      } else if (authView === 'login') {
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setSuccess('📧 Email de recuperação enviado! Verifique sua caixa de entrada e spam.');
    } catch (err: any) {
      setError('Erro ao enviar email de recuperação. Verifique o endereço.');
    }
    setLoading(false);
  };

  const isRegistering = authView === 'register';

  return (
    <div className="min-h-screen premium-gradient flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="bg-card/95 glass p-8 rounded-2xl shadow-2xl w-full max-w-md text-center relative z-10 border border-border/50">
        <div className="flex justify-center mb-6">
          <AnimatedLogo size="lg" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-1">CRM Azoup</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          {authView === 'login' && 'Acesse sua conta'}
          {authView === 'register' && 'Criar nova conta'}
          {authView === 'forgot' && 'Recuperar senha'}
        </p>
        
        {authView === 'forgot' ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-left">
              <Label htmlFor="email">Email cadastrado</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            {error && <p className="text-destructive text-sm bg-destructive/10 p-2 rounded-lg">{error}</p>}
            {success && <p className="text-success text-sm bg-success/10 p-3 rounded-lg">{success}</p>}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound size={16} />}
              Enviar Link de Recuperação
            </Button>

            <button
              type="button"
              onClick={() => { setAuthView('login'); setError(''); setSuccess(''); }}
              className="flex items-center justify-center gap-1.5 mx-auto text-muted-foreground text-sm hover:text-primary transition"
            >
              <ArrowLeft size={14} /> Voltar ao login
            </button>
          </form>
        ) : (
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
            
            {error && <p className="text-destructive text-sm bg-destructive/10 p-2 rounded-lg">{error}</p>}

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

            {!isRegistering && (
              <button
                type="button"
                onClick={() => { setAuthView('forgot'); setError(''); }}
                className="text-muted-foreground text-xs hover:text-primary underline transition block mx-auto"
              >
                Esqueceu sua senha?
              </button>
            )}
          </form>
        )}

        {authView !== 'forgot' && (
          <button
            onClick={() => {
              setAuthView(isRegistering ? 'login' : 'register');
              setError('');
            }}
            className="mt-4 text-muted-foreground text-sm hover:text-primary underline transition"
          >
            {isRegistering ? 'Já tem conta? Fazer Login' : 'Não tem conta? Cadastre-se'}
          </button>
        )}
      </div>
      
      <p className="mt-8 text-primary-foreground/60 text-sm relative z-10">© 2024 Azoup Tecnologia</p>
    </div>
  );
}
