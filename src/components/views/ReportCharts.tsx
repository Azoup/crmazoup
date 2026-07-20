import { useMemo } from 'react';
import { Lead, STAGE_LABELS, LeadStage } from '@/types/lead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLostLeadsByDdd } from '@/lib/dddStats';
import { formatReferenceMonth } from '@/hooks/useMonthlyMetrics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, MapPin, Filter, PieChart as PieIcon } from 'lucide-react';

interface Props {
  /** All leads (for multi-month evolution). */
  allLeads: Lead[];
  /** Leads already filtered by the selected month (for funnel & donuts). */
  monthlyLeads: Lead[];
  selectedMonth: string;
}

const STAGE_ORDER: LeadStage[] = [
  'prospeccao',
  'interesse',
  'reuniao',
  'proposta',
  'venda',
  'congelados',
  'perdidos',
];

const STAGE_HEX: Record<LeadStage, string> = {
  prospeccao: '#94a3b8',
  interesse: '#60a5fa',
  reuniao: '#a78bfa',
  proposta: '#f59e0b',
  venda: '#10b981',
  congelados: '#06b6d4',
  perdidos: '#ef4444',
};

const LOSS_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
];

export function ReportCharts({ allLeads, monthlyLeads, selectedMonth }: Props) {
  const funnelData = useMemo(
    () =>
      STAGE_ORDER.map((stage) => ({
        stage: STAGE_LABELS[stage],
        total: monthlyLeads.filter((l) => l.stage === stage).length,
        fill: STAGE_HEX[stage],
      })),
    [monthlyLeads],
  );

  const lossData = useMemo(() => {
    const lost = monthlyLeads.filter((l) => l.stage === 'perdidos');
    const counts: Record<string, number> = {};
    lost.forEach((l) => {
      const reason = l.loss_reason || 'Não informado';
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [monthlyLeads]);

  const dddData = useMemo(() => {
    const stats = getLostLeadsByDdd(monthlyLeads);
    return stats.slice(0, 10).map((s) => ({
      ddd: s.ddd,
      perdidos: s.count,
      fill: '#ef4444',
    }));
  }, [monthlyLeads]);

  const evolutionData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const buckets: Array<{
      key: string;
      label: string;
      recebidos: number;
      ganhos: number;
      perdidos: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({
        key,
        label: formatReferenceMonth(key).split(' ')[0],
        recebidos: 0,
        ganhos: 0,
        perdidos: 0,
      });
    }
    const byKey: Record<string, typeof buckets[number]> = {};
    buckets.forEach((b) => { byKey[b.key] = b; });

    allLeads.forEach((l) => {
      if (l.lead_source && l.lead_source !== 'marketing') return;
      const ref = l.reference_month;
      const bucket = ref ? byKey[ref] : undefined;
      if (!bucket) return;
      bucket.recebidos += 1;
      if (l.stage === 'venda') bucket.ganhos += 1;
      if (l.stage === 'perdidos') bucket.perdidos += 1;
    });

    return buckets;
  }, [allLeads, selectedMonth]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
      {/* Funil */}
      <Card className="border-border/50 hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter size={16} className="text-primary" />
            Funil de conversão por etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Loss reasons donut */}
      <Card className="border-border/50 hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <PieIcon size={16} className="text-destructive" />
            Motivos de perda ({lossData.reduce((s, d) => s + d.count, 0)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lossData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
              Nenhum lead perdido no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={lossData}
                  dataKey="count"
                  nameKey="reason"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {lossData.map((_, i) => (
                    <Cell key={i} fill={LOSS_COLORS[i % LOSS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* DDD map */}
      <Card className="border-border/50 hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin size={16} className="text-amber-500" />
            Top DDDs com mais perdas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dddData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados de DDD no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dddData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="ddd" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="perdidos" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly evolution */}
      <Card className="border-border/50 hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            Evolução mês a mês (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={evolutionData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="recebidos" name="Recebidos" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ganhos" name="Ganhos" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="perdidos" name="Perdidos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
