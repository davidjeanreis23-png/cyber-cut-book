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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Orbitron:wght@700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 20mm; }
  * { box-sizing: border-box; }
  body { 
    font-family: 'Inter', sans-serif; 
    color: #1a1a1a; 
    margin: 0; 
    padding: 0; 
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Cabeçalho */
  .header {
    background-color: #1a0533;
    color: #ffffff;
    padding: 24px;
    border-bottom: 4px solid #7c3aed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 8px 8px 0 0;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-icon {
    font-size: 32px;
  }
  .header h1 { 
    font-family: 'Orbitron', sans-serif; 
    font-size: 32px; 
    margin: 0; 
    letter-spacing: 2px; 
  }
  .header-meta {
    text-align: right;
  }
  .header-meta .subtitle {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px;
    color: #ffffff;
  }
  .header-meta .period {
    color: #d1d5db;
    font-size: 12px;
  }

  /* Cards de Resumo */
  .summary { 
    display: flex; 
    gap: 16px; 
    margin: 24px 0; 
  }
  .summary-card { 
    flex: 1; 
    padding: 16px; 
    background-color: #f8fafc; 
    border-radius: 8px; 
    border-left-width: 4px;
    border-left-style: solid;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .summary-card.income-card { border-left-color: #16a34a; }
  .summary-card.expense-card { border-left-color: #dc2626; }
  .summary-card.profit-card { border-left-color: #7c3aed; }

  .summary-card .label { 
    font-size: 12px; 
    text-transform: uppercase; 
    color: #6b7280; 
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .summary-card .value { 
    font-family: 'Inter', sans-serif; 
    font-weight: 700;
    font-size: 24px; 
    margin-top: 8px; 
  }
  .income-val { color: #16a34a; }
  .expense-val { color: #dc2626; }
  .profit-val { color: #7c3aed; }

  /* Seções de Dados */
  h2 { 
    font-family: 'Orbitron', sans-serif; 
    font-size: 16px; 
    margin: 32px 0 12px; 
    color: #1a0533; 
    padding-left: 8px;
    border-left: 4px solid #7c3aed;
    line-height: 1;
  }

  /* Tabelas */
  table { 
    width: 100%; 
    border-collapse: collapse; 
    font-size: 13px; 
    margin-top: 8px; 
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }
  th, td { 
    text-align: left; 
    padding: 10px 12px; 
  }
  th { 
    background-color: #1a0533 !important; 
    color: #ffffff; 
    font-weight: 600; 
  }
  tr:nth-child(even) { background-color: #f9fafb !important; }
  tr:not(:last-child) { border-bottom: 1px solid #e5e7eb; }
  
  td.num, th.num { text-align: right; }
  td.bold { font-weight: 700; font-family: 'Inter', sans-serif; }

  .empty { 
    color: #6b7280; 
    font-style: italic; 
    padding: 12px 0; 
    font-size: 13px; 
  }

  /* Rodapé */
  .footer { 
    margin-top: 48px; 
    padding-top: 16px;
    border-top: 1px solid #7c3aed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px; 
    color: #6b7280; 
  }
  .footer-center {
    font-weight: 600;
    color: #1a0533;
  }
</style>
</head>
<body>
  
  <div class="header">
    <div class="header-left">
      <span class="logo-icon">✂️</span>
      <h1>AUTOBARBER</h1>
    </div>
    <div class="header-meta">
      <div class="subtitle">Relatório Financeiro</div>
      <div class="period">Período: ${from} a ${to}<br>Gerado em: ${generatedAt}</div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card income-card">
      <div class="label"><span>↑</span> Entradas</div>
      <div class="value income-val">${fmt(c.income)}</div>
    </div>
    <div class="summary-card expense-card">
      <div class="label"><span>↓</span> Saídas</div>
      <div class="value expense-val">${fmt(c.expense)}</div>
    </div>
    <div class="summary-card profit-card">
      <div class="label"><span>$</span> Lucro Líquido</div>
      <div class="value profit-val">${fmt(c.profit)}</div>
    </div>
  </div>

  <h2>POR BARBEIRO</h2>
  ${c.byBarber.length === 0 ? '<div class="empty">Sem dados no período.</div>' : `
  <table>
    <thead><tr><th>Barbeiro</th><th class="num">Agendamentos</th><th class="num">Receita</th><th class="num">Comissão</th></tr></thead>
    <tbody>
      ${c.byBarber.map(b => `
        <tr><td>${b.name}</td><td class="num">${b.appointments}</td><td class="num bold income-val">${fmt(b.revenue)}</td><td class="num bold profit-val">${fmt(b.commission)}</td></tr>
      `).join("")}
    </tbody>
  </table>`}

  <h2>POR SERVIÇO</h2>
  ${c.byService.length === 0 ? '<div class="empty">Sem dados no período.</div>' : `
  <table>
    <thead><tr><th>Serviço</th><th class="num">Quantidade</th><th class="num">Receita</th></tr></thead>
    <tbody>
      ${c.byService.map(s => `
        <tr><td>${s.name}</td><td class="num">${s.count}</td><td class="num bold income-val">${fmt(s.revenue)}</td></tr>
      `).join("")}
    </tbody>
  </table>`}

  <h2>POR FORMA DE PAGAMENTO</h2>
  ${c.byPayment.length === 0 ? '<div class="empty">Sem dados no período.</div>' : `
  <table>
    <thead><tr><th>Forma</th><th class="num">Total</th><th class="num">%</th></tr></thead>
    <tbody>
      ${c.byPayment.map(p => `
        <tr><td style="text-transform: capitalize;">${p.name}</td><td class="num bold">${fmt(p.value)}</td><td class="num">${((p.value / totalPayments) * 100).toFixed(1)}%</td></tr>
      `).join("")}
    </tbody>
  </table>`}

  <h2>CLIENTES NO PERÍODO</h2>
  <table>
    <thead><tr><th>Categoria</th><th class="num">Quantidade</th></tr></thead>
    <tbody>
      <tr><td>Novos clientes</td><td class="num bold">${c.newClients}</td></tr>
      <tr><td>Clientes recorrentes</td><td class="num bold">${c.recurringClients}</td></tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="footer-left">${generatedAt}</div>
    <div class="footer-center">AutoBarber • Sistema de Gestão</div>
    <div class="footer-right">Página 1 de 1</div>
  </div>

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
