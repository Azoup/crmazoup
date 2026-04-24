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
import { User, Building2, FileText, MessageSquare, Search, Save, Edit, RefreshCw, Database, Package, Download } from 'lucide-react';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import { ClientQuotesList } from '@/components/manager/ClientQuotesList';
import { downloadClientFichaPdf } from '@/lib/clientFichaPdf';

const buildLeadForm = (lead: Lead) => ({
  name: lead.name || '',
  whatsapp: lead.whatsapp || '',
  email: lead.email || '',
  company: lead.company || '',
  cpf: (lead as any).cpf || '',
  cpf_cnpj: lead.cpf_cnpj || '',
  state_registration: lead.state_registration || '',
  implementation_responsible: lead.implementation_responsible || '',
  implementation_responsible_phone: (lead as any).implementation_responsible_phone || '',
  signer_name: lead.signer_name || lead.name || '',
  signer_phone: (lead as any).signer_phone || lead.whatsapp || '',
  signer_email: (lead as any).signer_email || '',
  birthdate: lead.birthdate || '',
  address: lead.address || '',
  client_observations: lead.client_observations || '',
  confection_type: lead.confection_type || '',
  pieces_per_month: lead.pieces_per_month ? String(lead.pieces_per_month) : '',
  implementation_value: lead.implementation_value ? String(lead.implementation_value) : '',
  monthly_value: lead.monthly_value ? String(lead.monthly_value) : '',
});

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
  quotesRefreshKey?: number;
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

export function ClientInfoForm({ lead, onSave, allLeads, quotesRefreshKey = 0 }: ClientInfoFormProps) {
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
    implementation_responsible_phone: '',
    signer_name: '',
    signer_phone: '',
    signer_email: '',
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
    if (!lead) return;
    try {
      if (localStorage.getItem(`ficha-draft-${lead.id}`)) {
        setEditing(true);
      }
    } catch {
      /* ignore */
    }
  }, [lead]);

  useEffect(() => {
    if (lead && !editing) {
      const sources = new Set<string>();
      const newForm = buildLeadForm(lead);

      Object.entries(newForm).forEach(([key, val]) => {
        if (val) sources.add(key);
      });

      setForm(newForm);
      setCrmSource(sources);
    }
  }, [lead, editing]);

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
    if (form.signer_email && !validateEmail(form.signer_email)) {
      toast({ title: 'Erro', description: 'E-mail da pessoa que assina inválido', variant: 'destructive' });
      return;
    }
    if (form.whatsapp && !validatePhone(form.whatsapp)) {
      toast({ title: 'Erro', description: 'Telefone inválido (10-11 dígitos)', variant: 'destructive' });
      return;
    }
    if (form.signer_phone && !validatePhone(form.signer_phone)) {
      toast({ title: 'Erro', description: 'Telefone da pessoa que assina inválido (10-11 dígitos)', variant: 'destructive' });
      return;
    }
    if (form.implementation_responsible_phone && !validatePhone(form.implementation_responsible_phone)) {
      toast({ title: 'Erro', description: 'Telefone do responsável pela implantação inválido (10-11 dígitos)', variant: 'destructive' });
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
      // Apenas avisa — não bloqueia o salvamento (gestor decide)
      toast({
        title: 'Aviso: possível duplicata',
        description: `Lead "${dup.name}" possui dados similares. Salvando mesmo assim.`,
      });
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
      implementation_responsible_phone: form.implementation_responsible_phone || null,
      signer_name: form.signer_name || null,
      signer_phone: form.signer_phone || null,
      signer_email: form.signer_email || null,
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
              ...buildLeadForm(lead),
            });
            toast({ title: 'Dados atualizados do CRM' });
          }}
        >
          <RefreshCw size={14} /> Buscar no CRM
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            try {
              await downloadClientFichaPdf(lead);
              toast({ title: '📄 PDF gerado', description: 'Ficha do cliente baixada com sucesso.' });
            } catch (err) {
              console.error(err);
              toast({ title: 'Erro ao gerar PDF', description: 'Tente novamente.', variant: 'destructive' });
            }
          }}
        >
          <Download size={14} /> PDF da Ficha
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

      {/* Block 1: Dados da Empresa */}
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
            {fieldLabel('email', 'E-mail da Empresa')}
            <Input value={form.email} onChange={(e) => updateField('email', e.target.value)} disabled={!editing} className="mt-1" type="email" />
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

      {/* Block 2: Dados da Pessoa que Assina */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User size={16} className="text-primary" /> Dados da Pessoa que Assina
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            {fieldLabel('signer_name', 'Nome Completo', true)}
            <Input value={form.signer_name} onChange={(e) => updateField('signer_name', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('cpf', 'CPF')}
            <Input value={form.cpf} onChange={(e) => updateField('cpf', e.target.value)} disabled={!editing} className="mt-1" placeholder="000.000.000-00" />
          </div>
          <div>
            {fieldLabel('signer_phone', 'Telefone')}
            <Input value={form.signer_phone} onChange={(e) => updateField('signer_phone', e.target.value)} disabled={!editing} className="mt-1" placeholder="(11) 99999-9999" />
          </div>
          <div>
            {fieldLabel('signer_email', 'E-mail')}
            <Input value={form.signer_email} onChange={(e) => updateField('signer_email', e.target.value)} disabled={!editing} className="mt-1" type="email" />
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

      {/* Block 4: Responsável pela Implantação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Responsável pela Implantação
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            {fieldLabel('implementation_responsible', 'Nome do Responsável pela Implantação')}
            <Input value={form.implementation_responsible} onChange={(e) => updateField('implementation_responsible', e.target.value)} disabled={!editing} className="mt-1" />
          </div>
          <div>
            {fieldLabel('implementation_responsible_phone', 'Telefone do Responsável')}
            <Input value={form.implementation_responsible_phone} onChange={(e) => updateField('implementation_responsible_phone', e.target.value)} disabled={!editing} className="mt-1" placeholder="(11) 99999-9999" />
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

      {/* Orçamentos anexados a este cliente — sempre visíveis para download do PDF */}
      <ClientQuotesList leadId={lead.id} refreshKey={quotesRefreshKey} />
    </div>
  );
}
