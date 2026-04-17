import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Download, FileText } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--muted-foreground))"];

const ReportsTab = () => {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "custom">("month");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Adjust dates when period changes
  useEffect(() => {
    const now = new Date();
    if (period === "day") setFrom(format(startOfDay(now), "yyyy-MM-dd"));
    else if (period === "week") setFrom(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    else if (period === "month") setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
    if (period !== "custom") setTo(format(now, "yyyy-MM-dd"));
  }, [period]);

  const loadReport = async () => {
    setLoading(true);
    const [txRes, apptRes, earnRes] = await Promise.all([
      supabase.from("financial_transactions").select("*, services(name), barbers(name)")
        .gte("transaction_date", from).lte("transaction_date", to),
      supabase.from("appointments").select("*, services(name, price), barbers(name), profiles(full_name, email)")
        .gte("appointment_date", from).lte("appointment_date", to),
      supabase.from("commission_earnings").select("*, barbers(name), services(name)")
        .gte("earned_date", from).lte("earned_date", to),
    ]);
    setData({
      txs: txRes.data || [],
      appts: apptRes.data || [],
      earnings: earnRes.data || [],
    });
    setLoading(false);
  };

  useEffect(() => { loadReport(); }, [from, to]);

  const computed = useMemo(() => {
    if (!data) return null;
    const income = data.txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const expense = data.txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const profit = income - expense;

    // By barber
    const byBarber: Record<string, { name: string; appointments: number; revenue: number; commission: number }> = {};
    data.appts.forEach((a: any) => {
      const id = a.barber_id;
      if (!byBarber[id]) byBarber[id] = { name: a.barbers?.name || "—", appointments: 0, revenue: 0, commission: 0 };
      byBarber[id].appointments++;
      if (a.status === "completed") byBarber[id].revenue += Number(a.services?.price || 0);
    });
    data.earnings.forEach((e: any) => {
      if (byBarber[e.barber_id]) byBarber[e.barber_id].commission += Number(e.amount);
    });

    // By service
    const byService: Record<string, { name: string; count: number; revenue: number }> = {};
    data.appts.filter((a: any) => a.status === "completed").forEach((a: any) => {
      const id = a.service_id;
      if (!byService[id]) byService[id] = { name: a.services?.name || "—", count: 0, revenue: 0 };
      byService[id].count++;
      byService[id].revenue += Number(a.services?.price || 0);
    });

    // By payment method
    const byPayment: Record<string, number> = {};
    data.txs.filter((t: any) => t.type === "income").forEach((t: any) => {
      const k = t.payment_method || "outros";
      byPayment[k] = (byPayment[k] || 0) + Number(t.amount);
    });

    // Daily revenue
    const byDate: Record<string, number> = {};
    data.txs.filter((t: any) => t.type === "income").forEach((t: any) => {
      byDate[t.transaction_date] = (byDate[t.transaction_date] || 0) + Number(t.amount);
    });
    const dailyRevenue = Object.entries(byDate).sort().map(([date, value]) => ({
      date: format(new Date(date + "T00:00"), "dd/MM"),
      value,
    }));

    // Clients new vs recurring
    const clientCounts: Record<string, number> = {};
    data.appts.forEach((a: any) => {
      clientCounts[a.user_id] = (clientCounts[a.user_id] || 0) + 1;
    });
    const newClients = Object.values(clientCounts).filter(c => c === 1).length;
    const recurringClients = Object.values(clientCounts).filter(c => c > 1).length;

    return {
      income, expense, profit,
      byBarber: Object.values(byBarber),
      byService: Object.values(byService).sort((a, b) => b.count - a.count),
      byPayment: Object.entries(byPayment).map(([name, value]) => ({ name, value })),
      dailyRevenue,
      newClients, recurringClients,
    };
  }, [data]);

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("generate-report-pdf", {
        body: { from, to, computed, period },
      });
      if (error || !result?.html) {
        toast.error("Erro ao gerar relatório");
        return;
      }
      // Open a new tab with the HTML and trigger print
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(result.html);
        w.document.close();
        setTimeout(() => w.print(), 500);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">FILTRO DE PERÍODO</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Período</Label>
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Diário</SelectItem>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensal</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>De</Label>
            <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPeriod("custom"); }} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={to} onChange={e => { setTo(e.target.value); setPeriod("custom"); }} />
          </div>
          <div className="flex items-end">
            <Button variant="neon" onClick={exportPDF} disabled={exporting || !computed} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Gerando..." : "EXPORTAR PDF"}
            </Button>
          </div>
        </div>
      </GlassCard>

      {loading && <p className="text-center text-muted-foreground">Carregando...</p>}

      {computed && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard animate={false}>
              <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">Entradas</p>
              <p className="font-display text-2xl text-green-500">R$ {computed.income.toFixed(2)}</p>
            </GlassCard>
            <GlassCard animate={false}>
              <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">Saídas</p>
              <p className="font-display text-2xl text-red-500">R$ {computed.expense.toFixed(2)}</p>
            </GlassCard>
            <GlassCard animate={false}>
              <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">Lucro Líquido</p>
              <p className="font-display text-2xl text-neon">R$ {computed.profit.toFixed(2)}</p>
            </GlassCard>
          </div>

          {/* Daily revenue chart */}
          {computed.dailyRevenue.length > 0 && (
            <GlassCard animate={false}>
              <h3 className="font-display text-sm tracking-wider mb-3">FATURAMENTO DIÁRIO</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={computed.dailyRevenue}>
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By barber */}
            <GlassCard animate={false}>
              <h3 className="font-display text-sm tracking-wider mb-3">POR BARBEIRO</h3>
              {computed.byBarber.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={computed.byBarber}>
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita" />
                      <Bar dataKey="commission" fill="hsl(var(--accent))" name="Comissão" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1 text-sm">
                    {computed.byBarber.map((b, i) => (
                      <div key={i} className="flex justify-between border-b border-border/30 py-1 last:border-0">
                        <span>{b.name} ({b.appointments} agend.)</span>
                        <span className="text-muted-foreground">R$ {b.revenue.toFixed(2)} • Com.: R$ {b.commission.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </GlassCard>

            {/* By service */}
            <GlassCard animate={false}>
              <h3 className="font-display text-sm tracking-wider mb-3">SERVIÇOS MAIS REALIZADOS</h3>
              {computed.byService.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={computed.byService.slice(0, 8)} layout="vertical">
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* By payment */}
            <GlassCard animate={false}>
              <h3 className="font-display text-sm tracking-wider mb-3">FORMAS DE PAGAMENTO</h3>
              {computed.byPayment.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={computed.byPayment} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${e.name}: ${((e.percent || 0) * 100).toFixed(0)}%`}>
                      {computed.byPayment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* Clients */}
            <GlassCard animate={false}>
              <h3 className="font-display text-sm tracking-wider mb-3">CLIENTES NO PERÍODO</h3>
              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                  <span className="font-body">Novos clientes</span>
                  <span className="font-display text-xl text-primary">{computed.newClients}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                  <span className="font-body">Clientes recorrentes</span>
                  <span className="font-display text-xl text-primary">{computed.recurringClients}</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsTab;
