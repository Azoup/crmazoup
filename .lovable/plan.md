# Melhorias no CRM Azoup

Nada existente será removido. Nenhum dado no banco será apagado. Todas as melhorias somam funcionalidade e polimento visual.

## 1. Pipeline + Produtividade

**Cabeçalho das colunas repaginado**
- Cada coluna ganha faixa superior colorida pela cor da etapa (prospecção, interesse, reunião, proposta, venda, congelados, perdidos).
- Contador de leads + soma de valor total da coluna (ex: `12 leads · R$ 84k`).
- Ícone da etapa + botão discreto para colapsar a coluna.

**Cards repaginados**
- Hierarquia mais clara: nome grande, empresa em cinza, badges reorganizadas (temperatura, valor, mês, "No CRM há Xd", AC, reunião, live, novo).
- Barra lateral esquerda mais expressiva com a cor da etapa/urgência.
- Avatar circular com iniciais coloridas por temperatura.
- Rodapé compacto com WhatsApp + ligação rápida (tel:).
- Micro animações: `hover-scale` suave, `fade-in` ao carregar, `scale-in` ao entrar na coluna, pulse no ícone quando "próximo contato" está atrasado.

**Filtros e ordenação rápidos** (barra acima do pipeline)
- Ordenar por: mais recente, mais antigo no CRM, maior valor, mais quente, próximo contato.
- Filtro rápido: temperatura, DDD, mês de entrada, tag "Live", "Link enviado".

**Barra de comandos (Ctrl+K / Cmd+K)**
- Busca global de lead por nome, empresa, telefone, e-mail.
- Ações rápidas: "Abrir próximo lead a contatar", "Ir para relatório do mês", "Novo lead manual".

**Botão "Próximo lead a contatar"**
- Fixo no topo do pipeline. Abre o lead com `next_contact` mais atrasado (ou mais próximo) da carteira do usuário. Se não houver, sugere o lead mais antigo sem contato.

## 2. Inteligência e Alertas

**Lead Score automático (0-100)**
- Fórmula: temperatura (quente=40, morno=25, frio=10) + valor (até 25 pts proporcional) + recência de interação (até 20) + engajamento (histórico, live contatado, link enviado — até 15).
- Aparece como barrinha no card e como coluna no relatório.
- Não altera dado existente — é calculado em runtime.

**Painel de alertas** (novo widget no topo do Dashboard)
- Leads parados há mais de 7 dias sem interação.
- Reuniões marcadas sem follow-up após 24h.
- Propostas enviadas sem resposta há mais de 5 dias.
- Leads "Live" ainda não contatados há mais de 2 dias.

**Ranking semanal de SDRs** (visível ao Gestor)
- Leads movidos, reuniões marcadas, propostas enviadas, vendas fechadas na semana. Medalhas 🥇🥈🥉.

## 3. Dashboard e Relatórios

**Novos gráficos na aba Relatórios**
- Funil de conversão por etapa (com % de passagem entre etapas).
- Tempo médio que o lead permanece em cada etapa.
- Taxa de perda por motivo (donut) — já usando os novos motivos.
- Evolução mês a mês (barras: recebidos, ganhos, perdidos, congelados).
- Mapa por DDD (top 10 DDDs com mais leads e com mais perdas — reaproveita `dddStats.ts`).
- Comparativo entre SDRs (leads na carteira, conversão, ticket médio) — visível ao Gestor.

**Export**
- Botão "Exportar relatório completo em PDF" com todos os gráficos + tabela.

## 4. Comunicação + Qualidade de Dados

**Templates de WhatsApp por etapa**
- Nova tabela `message_templates` (id, user_id, stage, title, body).
- Modal de mensagem rápida no card: escolhe template, substitui `{nome}`, `{empresa}`, `{primeiro_nome}` e abre WhatsApp Web.
- Gestor pode criar templates compartilhados.

**Detecção de leads duplicados**
- Ao criar ou editar, verifica telefone e e-mail contra a carteira do usuário. Se duplicado, mostra aviso amarelo com link para o lead existente. Não bloqueia salvamento.

**Validação de DDD/telefone**
- Ao salvar, formata para `(DD) 9XXXX-XXXX`, valida DDD brasileiro (11–99 conhecidos) e destaca em amarelo se inválido.

## 5. Animações novas (global)

- `fade-in` nas listas ao carregar.
- `scale-in` em modais.
- `slide-in-right` em toasts customizados de alerta.
- `hover-scale` nos botões de ação primária.
- Keyframe custom `pulse-glow` no card do próximo lead a contatar quando atrasado.
- Transição suave (`transition-all duration-300`) nos movimentos de coluna do kanban.

---

## Detalhes técnicos

**Banco (uma migration)**
- Nova tabela `message_templates` com RLS (SDR vê os próprios + compartilhados do gestor da carteira; Gestor gerencia os próprios e os compartilhados).
- Nenhuma alteração destrutiva. Nenhuma coluna removida.

**Frontend**
- `LeadCard.tsx`: repaginação + avatar + lead score + animações.
- `KanbanColumn.tsx` (ou equivalente): cabeçalho novo + colapsar + soma de valor.
- `PipelineToolbar.tsx` (novo): ordenação + filtros rápidos + botão "próximo lead".
- `CommandPalette.tsx` (novo): shadcn `Command` + atalho Ctrl+K global.
- `LeadScore.ts` (novo): função pura de cálculo.
- `AlertsWidget.tsx` (novo): usado no Dashboard.
- `ReportView.tsx`: novos gráficos (Recharts) + export PDF.
- `MessageTemplatesModal.tsx` (novo) + integração no card.
- `dedupe.ts` (novo) + hook `useDuplicateCheck`.
- `phoneValidation.ts` (novo).
- `tailwind.config.ts`: keyframe `pulse-glow`.

**Ordem de implementação**
1. Migration `message_templates`.
2. Repaginação do card + coluna + animações.
3. Lead score + painel de alertas.
4. Toolbar (ordenação/filtros/próximo lead) + Command palette.
5. Novos gráficos + export PDF.
6. Templates WhatsApp + dedupe + validação de telefone.

## Fora de escopo (para não inchar esta rodada)
- Integração com telefonia/VoIP.
- App mobile nativo.
- IA generativa para redigir mensagens (posso adicionar depois via Lovable AI).

Se aprovado, começo pela migration e sigo na ordem acima, sem tocar em nenhum dado existente.