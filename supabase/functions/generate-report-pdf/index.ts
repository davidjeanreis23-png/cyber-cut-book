import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ReportPayload {
  from: string;
  to: string;
  period: string;
  computed: {
    income: number;
    expense: number;
    profit: number;
    byBarber: { name: string; appointments: number; revenue: number; commission: number }[];
    byService: { name: string; count: number; revenue: number }[];
    byPayment: { name: string; value: number }[];
    dailyRevenue: { date: string; value: number }[];
    newClients: number;
    recurringClients: number;
  };
}

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

const buildHTML = (p: ReportPayload) => {
  const { from, to, computed: c } = p;
  const generatedAt = new Date().toLocaleString("pt-BR");
  const totalPayments = c.byPayment.reduce((s, x) => s + x.value, 0) || 1;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório AutoBarber — ${from} a ${to}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'DM Sans', -apple-system, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; }
  h1 { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 36px; letter-spacing: 2px; margin: 0 0 4px; color: #6d28d9; }
  h2 { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 22px; letter-spacing: 1px; margin: 28px 0 10px; color: #1a1a1a; border-bottom: 2px solid #6d28d9; padding-bottom: 4px; }
  .header-meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .summary { display: flex; gap: 12px; margin: 18px 0; }
  .summary-card { flex: 1; padding: 14px; border: 1px solid #e5e5e5; border-radius: 8px; }
  .summary-card .label { font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; }
  .summary-card .value { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 24px; margin-top: 4px; }
  .income { color: #16a34a; }
  .expense { color: #dc2626; }
  .profit { color: #6d28d9; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eaeaea; }
  th { background: #f5f3ff; font-weight: 600; color: #4c1d95; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  td.num, th.num { text-align: right; }
  .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; }
  .empty { color: #999; font-style: italic; padding: 8px 0; font-size: 13px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>AUTOBARBER</h1>
  <div class="header-meta">
    Relatório financeiro • Período: <strong>${from}</strong> a <strong>${to}</strong> • Gerado em ${generatedAt}
  </div>

  <div class="summary">
    <div class="summary-card"><div class="label">Entradas</div><div class="value income">${fmt(c.income)}</div></div>
    <div class="summary-card"><div class="label">Saídas</div><div class="value expense">${fmt(c.expense)}</div></div>
    <div class="summary-card"><div class="label">Lucro Líquido</div><div class="value profit">${fmt(c.profit)}</div></div>
  </div>

  <h2>Por Barbeiro</h2>
  ${c.byBarber.length === 0 ? '<div class="empty">Sem dados no período.</div>' : `
  <table>
    <thead><tr><th>Barbeiro</th><th class="num">Agendamentos</th><th class="num">Receita</th><th class="num">Comissão</th></tr></thead>
    <tbody>
      ${c.byBarber.map(b => `
        <tr><td>${b.name}</td><td class="num">${b.appointments}</td><td class="num">${fmt(b.revenue)}</td><td class="num">${fmt(b.commission)}</td></tr>
      `).join("")}
    </tbody>
  </table>`}

  <h2>Por Serviço</h2>
  ${c.byService.length === 0 ? '<div class="empty">Sem dados no período.</div>' : `
  <table>
    <thead><tr><th>Serviço</th><th class="num">Quantidade</th><th class="num">Receita</th></tr></thead>
    <tbody>
      ${c.byService.map(s => `
        <tr><td>${s.name}</td><td class="num">${s.count}</td><td class="num">${fmt(s.revenue)}</td></tr>
      `).join("")}
    </tbody>
  </table>`}

  <h2>Por Forma de Pagamento</h2>
  ${c.byPayment.length === 0 ? '<div class="empty">Sem dados no período.</div>' : `
  <table>
    <thead><tr><th>Forma</th><th class="num">Total</th><th class="num">%</th></tr></thead>
    <tbody>
      ${c.byPayment.map(p => `
        <tr><td>${p.name}</td><td class="num">${fmt(p.value)}</td><td class="num">${((p.value / totalPayments) * 100).toFixed(1)}%</td></tr>
      `).join("")}
    </tbody>
  </table>`}

  <h2>Clientes</h2>
  <table>
    <thead><tr><th>Categoria</th><th class="num">Quantidade</th></tr></thead>
    <tbody>
      <tr><td>Novos clientes</td><td class="num">${c.newClients}</td></tr>
      <tr><td>Clientes recorrentes</td><td class="num">${c.recurringClients}</td></tr>
    </tbody>
  </table>

  <div class="footer">AutoBarber • Sistema de Gestão • ${generatedAt}</div>

  <script>window.onload = function() { setTimeout(function(){ window.print(); }, 300); };</script>
</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = (await req.json()) as ReportPayload;
    if (!payload?.computed) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const html = buildHTML(payload);
    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro generate-report-pdf:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
