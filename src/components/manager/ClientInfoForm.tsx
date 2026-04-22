import { useState, useEffect } from 'react';
import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User, Building2, FileText, MessageSquare, Search, Save, Edit, RefreshCw, Database, Package } from 'lucide-react';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import { ClientQuotesList } from '@/components/manager/ClientQuotesList';

const PLANS = [
  {
    id: 'basic',
    name: 'Plano Basic',
    monthly: 400,
    implementation: 2500,
    hours: 30,
    modules: ['PCP (Produção)', 'Ficha Técnica', 'Emissão de NF-e', 'Relatórios Gerenciais', 'Carteira de Pedidos', 'Controle Financeiro', 'Controle de Estoque', 'Relatórios B.I.'],
  },
  {
    id: 'pro',
    name: 'Plano Pró ERP Confecção',
    monthly: 500,
    implementation: 3500,
    hours: 50,
    modules: ['PCP (Produção)', 'Ficha Técnica', 'Ficha de Custos', 'Emissão de NF-e', 'Relatórios Gerenciais', 'Carteira de Pedidos + Romaneio', 'Controle Financeiro + Contas a pagar/receber', 'Controle de Estoque + Matéria-prima e produto acabado', 'Boletos', 'Power B.I - Padrão e Produção'],
  },
  {
    id: 'master',
    name: 'Plano Master ERP Confecção',
    monthly: 650,
    implementation: 6500,
    hours: 70,
    modules: ['PCP (Produção)', 'Ficha Técnica', 'Ficha de Custos', 'Integração com E-commerce', 'Integração com Correios', 'Emissão de NF-e', 'Relatórios Gerenciais', 'Carteira de Pedidos + Romaneio', 'Controle Financeiro + Contas a pagar/receber', 'Controle de Estoque + Matéria-prima e produto acabado', 'Boletos', 'Power B.I Padrão e Produção'],
  },
];

interface ClientInfoFormProps {
  lead: Lead;
  onSave: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
  allLeads: Lead[];
}

function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(clean[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  return true; // basic length check
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 11;
}

export function ClientInfoForm({ lead, onSave, allLeads }: ClientInfoFormProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crmSource, setCrmSource] = useState<Set<string>>(new Set());

  const [selectedPlan, setSelectedPlan] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    whatsapp: '',
    email: '',
    company: '',
    cpf: '',
    cpf_cnpj: '',
    state_registration: '',
    implementation_responsible: '',
    signer_name: '',
    signer_role: '',
    birthdate: '',
    address: '',
    client_observations: '',
    confection_type: '',
    pieces_per_month: '',
    implementation_value: '',
    monthly_value: '',
  });

  // Persist draft per-lead so users don't lose data when switching tabs
  const draftKey = lead ? `ficha-draft-${lead.id}` : null;
  const { clear: clearDraft } = useDraftPersistence(
    editing ? draftKey : null,
    form,
    (saved) => setForm((prev) => ({ ...prev, ...saved })),
    editing,
  );

  useEffect(() => {
    if (lead) {
      const sources = new Set<string>();
      const newForm = {
        name: lead.name || '',
        whatsapp: lead.whatsapp || '',
        email: lead.email || '',
        company: lead.company || '',
        cpf: (lead as any).cpf || '',
        cpf_cnpj: lead.cpf_cnpj || '',
        state_registration: lead.state_registration || '',
        implementation_responsible: lead.implementation_responsible || '',
        signer_name: lead.signer_name || '',
        signer_role: lead.signer_role || '',
        birthdate: lead.birthdate || '',
        address: lead.address || '',
        client_observations: lead.client_observations || '',
        confection_type: lead.confection_type || '',
        pieces_per_month: lead.pieces_per_month ? String(lead.pieces_per_month) : '',
        implementation_value: lead.implementation_value ? String(lead.implementation_value) : '',
        monthly_value: lead.monthly_value ? String(lead.monthly_value) : '',
      };

      Object.entries(newForm).forEach(([key, val]) => {
        if (val) sources.add(key);
      });

      setForm(newForm);
      setCrmSource(sources);
    }
  }, [lead]);

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const checkDuplicate = () => {
    const duplicate = allLeads.find(l => {
      if (l.id === lead.id) return false;
      if (form.whatsapp && l.whatsapp && l.whatsapp.replace(/\D/g, '') === form.whatsapp.replace(/\D/g, '')) return true;
      if (form.email && l.email && l.email.toLowerCase() === form.email.toLowerCase()) return true;
      if (form.cpf && (l as any).cpf && (l as any).cpf.replace(/\D/g, '') === form.cpf.replace(/\D/g, '')) return true;
      if (form.cpf_cnpj && l.cpf_cnpj && l.cpf_cnpj.replace(/\D/g, '') === form.cpf_cnpj.replace(/\D/g, '')) return true;
      return false;
    });
    return duplicate;
  };

  const handleSave = async () => {
    // Validations
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (form.email && !validateEmail(form.email)) {
      toast({ title: 'Erro', description: 'E-mail inválido', variant: 'destructive' });
      return;
    }
    if (form.whatsapp && !validatePhone(form.whatsapp)) {
      toast({ title: 'Erro', description: 'Telefone inválido (10-11 dígitos)', variant: 'destructive' });
      return;
    }
    if (form.cpf) {
      const clean = form.cpf.replace(/\D/g, '');
      if (clean.length !== 11 || !validateCPF(form.cpf)) {
        toast({ title: 'Erro', description: 'CPF inválido (11 dígitos)', variant: 'destructive' });
        return;
      }
    }
    if (form.cpf_cnpj) {
      const clean = form.cpf_cnpj.replace(/\D/g, '');
      if (clean.length !== 14 || !validateCNPJ(form.cpf_cnpj)) {
        toast({ title: 'Erro', description: 'CNPJ inválido (14 dígitos)', variant: 'destructive' });
        return;
      }
    }

    const dup = checkDuplicate();
    if (dup) {
      toast({ title: '⚠️ Possível duplicata', description: `Lead "${dup.name}" possui dados similares. Verifique antes de salvar.`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    const success = await onSave(lead.id, {
      name: form.name,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      company: form.company || null,
      cpf: form.cpf || null,
      cpf_cnpj: form.cpf_cnpj || null,
      state_registration: form.state_registration || null,
      implementation_responsible: form.implementation_responsible || null,
      signer_name: form.signer_name || null,
      signer_role: form.signer_role || null,
      birthdate: form.birthdate || null,
      address: form.address || null,
      client_observations: form.client_observations || null,
      confection_type: form.confection_type || null,
      pieces_per_month: form.pieces_per_month ? parseInt(form.pieces_per_month) : null,
      implementation_value: form.implementation_value ? parseFloat(form.implementation_value) : 0,
      monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : 0,
    } as any);
    setSaving(false);

    if (success) {
      toast({ title: '✅ Dados salvos', description: 'Ficha do cliente atualizada com sucesso.' });
      setEditing(false);
      clearDraft();
    }
  };

  const fieldLabel = (key: string, label: string, required = false) => (
    <div className="flex items-center gap-2">
      <Label className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {crmSource.has(key) && (
        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium flex items-center gap-0.5">
          <Database size={8} /> CRM
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            // Re-load from lead
            setForm({
              name: lead.name || '',
              whatsapp: lead.whatsapp || '',
              email: lead.email || '',
              company: lead.company || '',
              cpf: (lead as any).cpf || '',
              cpf_cnpj: lead.cpf_cnpj || '',
              state_registration: lead.state_registration || '',
              implementation_responsible: lead.implementation_responsible || '',
              signer_name: lead.signer_name || '',
              signer_role: lead.signer_role || '',
              birthdate: lead.birthdate || '',
              address: lead.address || '',
              client_observations: lead.client_observations || '',
              confection_type: lead.confection_type || '',
              pieces_per_month: lead.pieces_per_month ? String(lead.pieces_per_month) : '',
              implementation_value: lead.implementation_value ? String(lead.implementation_value) : '',
              monthly_value: lead.monthly_value ? String(lead.monthly_value) : '',
            });
            toast({ title: 'Dados atualizados do CRM' });
          }}
        >
          <RefreshCw size={14} /> Buscar no CRM
        </Button>
        {!editing ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
            <Edit size={14} /> Editar
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        )}
      </div>

      {/* Block 1: Dados Pessoais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User size={16} className="text-primary" /> Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            {fieldLabel('name', 'Nome do Cliente', true)}
            <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('whatsapp', 'Telefone')}
            <Input value={form.whatsapp} onChange={(e) => updateField('whatsapp', e.target.value)} disabled={!editing} className="mt-1" placeholder="(11) 99999-9999" />
          </div>
          <div>
            {fieldLabel('email', 'E-mail')}
            <Input value={form.email} onChange={(e) => updateField('email', e.target.value)} disabled={!editing} className="mt-1" type="email" />
          </div>
          <div>
            {fieldLabel('birthdate', 'Data de Nascimento')}
            <Input value={form.birthdate} onChange={(e) => updateField('birthdate', e.target.value)} disabled={!editing} className="mt-1" type="date" />
          </div>
          <div className="md:col-span-2">
            {fieldLabel('address', 'Endereço')}
            <Input value={form.address} onChange={(e) => updateField('address', e.target.value)} disabled={!editing} className="mt-1" placeholder="Rua, número, bairro, cidade - UF" />
          </div>
        </CardContent>
      </Card>

      {/* Block 2: Dados da Empresa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 size={16} className="text-primary" /> Dados da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            {fieldLabel('company', 'Nome da Empresa')}
            <Input value={form.company} onChange={(e) => updateField('company', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('cpf', 'CPF')}
            <Input value={form.cpf} onChange={(e) => updateField('cpf', e.target.value)} disabled={!editing} className="mt-1" placeholder="000.000.000-00" />
          </div>
          <div>
            {fieldLabel('cpf_cnpj', 'CNPJ')}
            <Input value={form.cpf_cnpj} onChange={(e) => updateField('cpf_cnpj', e.target.value)} disabled={!editing} className="mt-1" placeholder="00.000.000/0000-00" />
          </div>
          <div>
            {fieldLabel('state_registration', 'Inscrição Estadual')}
            <Input value={form.state_registration} onChange={(e) => updateField('state_registration', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('confection_type', 'Tipo de Confecção')}
            <Input value={form.confection_type} onChange={(e) => updateField('confection_type', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('pieces_per_month', 'Peças por Mês')}
            <Input value={form.pieces_per_month} onChange={(e) => updateField('pieces_per_month', e.target.value)} disabled={!editing} className="mt-1" type="number" />
          </div>
        </CardContent>
      </Card>

      {/* Block 3: Plano e Valores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package size={16} className="text-primary" /> Plano e Valores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Selecionar Plano</Label>
            <Select
              value={selectedPlan}
              onValueChange={(val) => {
                setSelectedPlan(val);
                const plan = PLANS.find(p => p.id === val);
                if (plan && editing) {
                  setForm(prev => ({
                    ...prev,
                    implementation_value: String(plan.implementation),
                    monthly_value: String(plan.monthly),
                  }));
                  toast({ title: `${plan.name} selecionado`, description: `Implantação: R$${plan.implementation.toLocaleString('pt-BR')} | Mensalidade: R$${plan.monthly.toLocaleString('pt-BR')}` });
                }
              }}
              disabled={!editing}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Escolha um plano..." />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} — R${plan.monthly}/mês | Impl. R${plan.implementation.toLocaleString('pt-BR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPlan && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">
                {PLANS.find(p => p.id === selectedPlan)?.name} — {PLANS.find(p => p.id === selectedPlan)?.hours}h de Implantação
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLANS.find(p => p.id === selectedPlan)?.modules.map((mod, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{mod}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              {fieldLabel('implementation_value', 'Valor de Implantação (R$)')}
              <Input value={form.implementation_value} onChange={(e) => updateField('implementation_value', e.target.value)} disabled={!editing} className="mt-1" type="number" placeholder="0,00" />
            </div>
            <div>
              {fieldLabel('monthly_value', 'Mensalidade (R$)')}
              <Input value={form.monthly_value} onChange={(e) => updateField('monthly_value', e.target.value)} disabled={!editing} className="mt-1" type="number" placeholder="0,00" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Block 4: Dados Contratuais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Dados Contratuais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            {fieldLabel('implementation_responsible', 'Responsável pela Implantação')}
            <Input value={form.implementation_responsible} onChange={(e) => updateField('implementation_responsible', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('signer_name', 'Pessoa que Assina')}
            <Input value={form.signer_name} onChange={(e) => updateField('signer_name', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('signer_role', 'Cargo da Pessoa que Assina')}
            <Input value={form.signer_role} onChange={(e) => updateField('signer_role', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Block 4: Observações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" /> Observações Internas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.client_observations}
            onChange={(e) => updateField('client_observations', e.target.value)}
            disabled={!editing}
            placeholder="Observações, dados complementares comerciais e operacionais..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Quotes attached to this client */}
      <ClientQuotesList leadId={lead.id} />
    </div>
  );
}
