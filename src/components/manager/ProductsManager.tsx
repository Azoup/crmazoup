import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  monthly_fee: number;
  payment_type: 'unico' | 'mensal' | 'parcelado';
  installments: number | null;
  installments_text: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  unico: 'Pagamento Único',
  mensal: 'Mensal',
  parcelado: 'Parcelado',
};

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  monthly_fee: string;
  payment_type: 'unico' | 'mensal' | 'parcelado';
  installments: string;
  installments_text: string;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  price: '',
  monthly_fee: '',
  payment_type: 'unico',
  installments: '',
  installments_text: '',
};

export function ProductsManager() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isManager = profile?.role === 'Gestor';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      toast({ title: 'Erro ao carregar produtos', variant: 'destructive' });
    } else {
      setProducts((data as Product[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openNew = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      monthly_fee: product.monthly_fee ? String(product.monthly_fee) : '',
      payment_type: product.payment_type,
      installments: product.installments ? String(product.installments) : '',
      installments_text: product.installments_text || '',
    });
    setDialogOpen(true);
  };

  // Inline payment_type editor (quick change without opening modal)
  const updatePaymentInline = async (product: Product, newType: 'unico' | 'mensal' | 'parcelado') => {
    if (!isManager) return;
    const updates: Partial<Product> = { payment_type: newType };
    if (newType !== 'parcelado') {
      updates.installments = null;
      updates.installments_text = null;
    }
    const { error } = await supabase.from('products').update(updates).eq('id', product.id);
    if (error) {
      toast({ title: 'Erro ao alterar pagamento', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Forma de pagamento atualizada' });
      fetchProducts();
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: 'Descrição é obrigatória', variant: 'destructive' });
      return;
    }
    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast({ title: 'Preço inválido', variant: 'destructive' });
      return;
    }
    const monthlyNum = form.monthly_fee ? Number(form.monthly_fee) : 0;
    if (isNaN(monthlyNum) || monthlyNum < 0) {
      toast({ title: 'Mensalidade inválida', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: priceNum,
      monthly_fee: monthlyNum,
      payment_type: form.payment_type,
      installments: form.payment_type === 'parcelado' && form.installments
        ? Number(form.installments)
        : null,
      installments_text: form.payment_type === 'parcelado' && form.installments_text.trim()
        ? form.installments_text.trim()
        : null,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id);
      if (error) {
        toast({ title: 'Erro ao atualizar produto', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Produto atualizado' });
        setDialogOpen(false);
        fetchProducts();
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert({ ...payload, created_by: user.id });
      if (error) {
        toast({ title: 'Erro ao criar produto', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Produto cadastrado' });
        setDialogOpen(false);
        fetchProducts();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Excluir o produto "${product.name}"?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Produto excluído' });
      fetchProducts();
    }
  };

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <Package size={18} className="text-primary" />
          <h2 className="font-bold text-foreground">Catálogo de Produtos</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground/60" size={14} />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-[220px]"
            />
          </div>
          {isManager && (
            <Button onClick={openNew} className="gap-2">
              <Plus size={16} /> Novo Produto
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Carregando produtos...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[120px]">Preço</TableHead>
                <TableHead className="w-[120px]">Mensalidade</TableHead>
                <TableHead className="w-[200px]">Forma de Pagamento</TableHead>
                {isManager && <TableHead className="w-[100px] text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium align-top">{product.name}</TableCell>
                  <TableCell className="align-top">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words max-w-md">
                      {product.description}
                    </p>
                  </TableCell>
                  <TableCell className="align-top font-semibold text-primary">
                    {formatCurrency(product.price)}
                  </TableCell>
                  <TableCell className="align-top font-semibold text-success">
                    {product.monthly_fee > 0 ? formatCurrency(product.monthly_fee) : '—'}
                  </TableCell>
                  <TableCell className="align-top">
                    {isManager ? (
                      <div className="space-y-1">
                        <Select
                          value={product.payment_type}
                          onValueChange={(v: 'unico' | 'mensal' | 'parcelado') =>
                            updatePaymentInline(product, v)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unico">Pagamento Único</SelectItem>
                            <SelectItem value="mensal">Mensal</SelectItem>
                            <SelectItem value="parcelado">Parcelado</SelectItem>
                          </SelectContent>
                        </Select>
                        {product.payment_type === 'parcelado' && (
                          <p className="text-[11px] text-muted-foreground italic">
                            {product.installments_text
                              ? product.installments_text
                              : product.installments
                              ? `${product.installments}x`
                              : 'Edite para definir parcelas'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-muted">
                        {PAYMENT_LABELS[product.payment_type]}
                        {product.payment_type === 'parcelado' && (
                          product.installments_text
                            ? ` — ${product.installments_text}`
                            : product.installments
                            ? ` em ${product.installments}x`
                            : ''
                        )}
                      </span>
                    )}
                  </TableCell>
                  {isManager && (
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-bold">Nome do Produto *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Sistema de Gestão Pró"
              />
            </div>

            <div>
              <Label className="text-sm font-bold">Descrição Completa *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva detalhadamente o produto, recursos inclusos, escopo, entregas..."
                rows={6}
                className="resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A descrição completa será exibida no orçamento sem abreviações.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-bold">Preço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label className="text-sm font-bold">Mensalidade (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.monthly_fee}
                  onChange={(e) => setForm(f => ({ ...f, monthly_fee: e.target.value }))}
                  placeholder="0,00 (opcional)"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold">Forma de Pagamento *</Label>
              <Select
                value={form.payment_type}
                onValueChange={(v: 'unico' | 'mensal' | 'parcelado') =>
                  setForm(f => ({ ...f, payment_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unico">Pagamento Único</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.payment_type === 'parcelado' && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div>
                  <Label className="text-sm font-bold">Número de Parcelas (opcional)</Label>
                  <Input
                    type="number"
                    min="2"
                    value={form.installments}
                    onChange={(e) => setForm(f => ({ ...f, installments: e.target.value }))}
                    placeholder="Ex: 4"
                  />
                </div>
                <div>
                  <Label className="text-sm font-bold">Descrição livre das parcelas</Label>
                  <Textarea
                    value={form.installments_text}
                    onChange={(e) => setForm(f => ({ ...f, installments_text: e.target.value }))}
                    placeholder="Ex: entrada via Pix + 30/60/90 dias"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use este campo para condições personalizadas. Será exibido no orçamento.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Salvando...' : editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
