import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { TrendingUp, TrendingDown, Wallet, Users as UsersIcon } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const EXPENSE_CATEGORIES = ["Aluguel", "Produtos", "Energia/Água", "Salários", "Marketing", "Outros"];
const PAYMENT_METHODS = ["pix", "card", "cash", "outros"];
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--muted-foreground))"];

interface Tx {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  payment_method: string | null;
  transaction_date: string;
  barber_id: string | null;
  service_id: string | null;
}

interface Earning {
  id: string;
  amount: number;
  percentage: number;
  earned_date: string;
  barber_id: string;
  barbers?: { name: string } | null;
}

interface Service { id: string; name: string; price: number; }
interface Barber { id: string; name: string; }
interface Commission { id?: string; service_id: string; barber_id: string; percentage: number; }

const FinancialTab = () => {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);

  // New transaction form
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Commission editor
  const [editingService, setEditingService] = useState<string>("");

  const fetchAll = async () => {
    const [t, e, s, b, c] = await Promise.all([
      supabase.from("financial_transactions").select("*").order("transaction_date", { ascending: false }).limit(200),
      supabase.from("commission_earnings").select("*, barbers(name)").order("earned_date", { ascending: false }).limit(500),
      supabase.from("services").select("id,name,price").order("name"),
      supabase.from("barbers").select("id,name").eq("is_active", true).order("name"),
      supabase.from("service_commissions").select("*"),
    ]);
    setTxs((t.data as any) || []);
    setEarnings((e.data as any) || []);
    setServices(s.data || []);
    setBarbers(b.data || []);
    setCommissions((c.data as any) || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const saveTx = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.from("financial_transactions").insert({
      type, amount: value, category, description: description || null,
      payment_method: paymentMethod, transaction_date: txDate,
    });
    if (error) toast.error("Erro ao salvar"); else {
      toast.success("Lançamento salvo");
      setAmount(""); setDescription("");
      fetchAll();
    }
  };

  const deleteTx = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir"); else { toast.success("Excluído"); fetchAll(); }
  };

  // Commission editing for a specific service
  const serviceCommissions = useMemo(
    () => commissions.filter(c => c.service_id === editingService),
    [commissions, editingService]
  );
  const totalPercentage = serviceCommissions.reduce((sum, c) => sum + Number(c.percentage), 0);

  const setBarberPercentage = (barberId: string, percentage: number) => {
    setCommissions(prev => {
      const existing = prev.find(c => c.service_id === editingService && c.barber_id === barberId);
      if (existing) {
        return prev.map(c =>
          c.service_id === editingService && c.barber_id === barberId ? { ...c, percentage } : c
        );
      }
      return [...prev, { service_id: editingService, barber_id: barberId, percentage }];
    });
  };

  const saveCommissions = async () => {
    if (!editingService) return;
    if (Math.round(totalPercentage * 100) / 100 !== 100) {
      toast.error(`A soma dos percentuais deve ser 100% (atual: ${totalPercentage.toFixed(2)}%)`);
      return;
    }
    // Delete existing and re-insert
    await supabase.from("service_commissions").delete().eq("service_id", editingService);
    const toInsert = serviceCommissions.filter(c => c.percentage > 0).map(c => ({
      service_id: c.service_id, barber_id: c.barber_id, percentage: c.percentage,
    }));
    if (toInsert.length > 0) {
      const { error } = await supabase.from("service_commissions").insert(toInsert);
      if (error) { toast.error("Erro ao salvar"); return; }
    }
    toast.success("Divisão salva");
    fetchAll();
  };

  // Balances
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const balanceFor = (since: string) => {
    const filtered = txs.filter(t => t.transaction_date >= since);
    const income = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, balance: income - expense };
  };

  const dayBal = balanceFor(today);
  const weekBal = balanceFor(weekStart);
  const monthBal = balanceFor(monthStart);

  // Charts data (last 7 days)
  const last7Days = useMemo(() => {
    const days: { date: string; income: number; expense: number; }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = format(new Date(Date.now() - i * 86400000), "yyyy-MM-dd");
      const filtered = txs.filter(t => t.transaction_date === d);
      days.push({
        date: format(new Date(d + "T00:00"), "dd/MM"),
        income: filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
        expense: filtered.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return days;
  }, [txs]);

  const paymentMethodData = useMemo(() => {
    const map: Record<string, number> = {};
    txs.filter(t => t.type === "income" && t.transaction_date >= monthStart).forEach(t => {
      const k = t.payment_method || "outros";
      map[k] = (map[k] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [txs, monthStart]);

  // Earnings by barber (current month)
  const earningsByBarber = useMemo(() => {
    const map: Record<string, { name: string; amount: number }> = {};
    earnings.filter(e => e.earned_date >= monthStart).forEach(e => {
      const name = e.barbers?.name || "—";
      if (!map[e.barber_id]) map[e.barber_id] = { name, amount: 0 };
      map[e.barber_id].amount += Number(e.amount);
    });
    return Object.values(map);
  }, [earnings, monthStart]);

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Hoje", data: dayBal },
          { label: "Semana", data: weekBal },
          { label: "Mês", data: monthBal },
        ].map((b, i) => (
          <GlassCard key={i} animate={false}>
            <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">{b.label}</p>
            <p className="font-display text-3xl text-neon mb-3">R$ {b.data.balance.toFixed(2)}</p>
            <div className="flex justify-between text-xs">
              <span className="text-green-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> R$ {b.data.income.toFixed(2)}</span>
              <span className="text-red-500 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> R$ {b.data.expense.toFixed(2)}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard animate={false}>
          <h3 className="font-display text-sm tracking-wider mb-3">FATURAMENTO — ÚLTIMOS 7 DIAS</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7Days}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="income" fill="hsl(var(--primary))" name="Entradas" />
              <Bar dataKey="expense" fill="hsl(var(--destructive))" name="Saídas" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard animate={false}>
          <h3 className="font-display text-sm tracking-wider mb-3">FORMAS DE PAGAMENTO (MÊS)</h3>
          {paymentMethodData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentMethodData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {paymentMethodData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      {/* New transaction */}
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">NOVO LANÇAMENTO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            {type === "expense" ? (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Serviço, Produto..." />
            )}
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <Button variant="neon" className="mt-4" onClick={saveTx}>SALVAR LANÇAMENTO</Button>
      </GlassCard>

      {/* Commission editor */}
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">DIVISÃO POR SERVIÇO (COMISSÕES)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <Label>Serviço</Label>
            <Select value={editingService} onValueChange={setEditingService}>
              <SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
              <SelectContent>
                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — R$ {Number(s.price).toFixed(2)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {editingService && (
          <>
            <div className="space-y-2">
              {barbers.map(b => {
                const c = serviceCommissions.find(c => c.barber_id === b.id);
                return (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-body">{b.name}</span>
                    <Input
                      type="number" step="0.01" min="0" max="100"
                      className="w-28"
                      value={c?.percentage ?? ""}
                      onChange={e => setBarberPercentage(b.id, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground w-6">%</span>
                  </div>
                );
              })}
            </div>
            <div className={`mt-3 text-sm font-body ${Math.round(totalPercentage * 100) / 100 === 100 ? "text-green-500" : "text-destructive"}`}>
              Total: {totalPercentage.toFixed(2)}% {Math.round(totalPercentage * 100) / 100 !== 100 && "(deve fechar 100%)"}
            </div>
            <Button variant="neon" className="mt-3" onClick={saveCommissions}>SALVAR DIVISÃO</Button>
          </>
        )}
      </GlassCard>

      {/* Commissions earned by barber (month) */}
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">COMISSÕES POR BARBEIRO (MÊS)</h3>
        {earningsByBarber.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma comissão registrada.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={earningsByBarber}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" name="Comissão" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Recent transactions */}
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">LANÇAMENTOS RECENTES</h3>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {txs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lançamento.</p>}
          {txs.map(t => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium">
                  <span className={t.type === "income" ? "text-green-500" : "text-red-500"}>
                    {t.type === "income" ? "+" : "−"} R$ {Number(t.amount).toFixed(2)}
                  </span>
                  <span className="text-muted-foreground ml-2">• {t.category}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {format(new Date(t.transaction_date + "T00:00"), "dd/MM/yyyy")} {t.description && `• ${t.description}`} {t.payment_method && `• ${t.payment_method}`}
                </p>
              </div>
              <ConfirmDeleteButton onConfirm={() => deleteTx(t.id)} title="Excluir lançamento?" />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default FinancialTab;
