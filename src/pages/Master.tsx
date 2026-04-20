import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MasterSidebar, { MasterSection } from "@/components/master/MasterSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Crown, Building2, DollarSign, Clock, CheckCircle2, XCircle, Ban, RefreshCw } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Tenant {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  status: "trial" | "active" | "blocked" | "cancelled";
  plan_price: number;
  trial_end: string;
  paid_until: string | null;
  subscription_id: string | null;
  created_at: string;
  city: string | null;
  state: string | null;
}

const StatusBadge = ({ status, trialEnd }: { status: string; trialEnd?: string }) => {
  if (status === "trial") {
    const days = trialEnd ? Math.max(0, differenceInDays(new Date(trialEnd), new Date())) : 0;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">🟡 Trial — {days}d restantes</Badge>;
  }
  if (status === "active") return <Badge className="bg-green-500/20 text-green-400 border border-green-500/40">🟢 Ativo</Badge>;
  if (status === "blocked") return <Badge className="bg-red-500/20 text-red-400 border border-red-500/40">🔴 Bloqueado</Badge>;
  return <Badge className="bg-gray-500/20 text-gray-400 border border-gray-500/40">⚫ Cancelado</Badge>;
};

// ─── Dashboard Tab ───
const DashboardTab = ({ tenants }: { tenants: Tenant[] }) => {
  const total = tenants.length;
  const trial = tenants.filter((t) => t.status === "trial").length;
  const active = tenants.filter((t) => t.status === "active").length;
  const blocked = tenants.filter((t) => t.status === "blocked").length;
  const cancelled = tenants.filter((t) => t.status === "cancelled").length;
  const mrr = active * 39;

  const cards = [
    { label: "Total", value: total, icon: Building2, color: "text-primary" },
    { label: "Em Trial", value: trial, icon: Clock, color: "text-yellow-400" },
    { label: "Ativos", value: active, icon: CheckCircle2, color: "text-green-400" },
    { label: "Bloqueados", value: blocked, icon: Ban, color: "text-red-400" },
    { label: "Cancelados", value: cancelled, icon: XCircle, color: "text-gray-400" },
    { label: "MRR Estimado", value: `R$ ${mrr.toFixed(2)}`, icon: DollarSign, color: "text-primary" },
  ];

  const recent = [...tenants].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <GlassCard key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
                <p className={`text-2xl font-display ${c.color}`}>{c.value}</p>
              </div>
              <c.icon className={`h-8 w-8 ${c.color} opacity-60`} />
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-4">
        <h3 className="font-display text-lg text-neon mb-3">Últimos cadastros</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barbearia</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhuma barbearia cadastrada</TableCell></TableRow>
            ) : recent.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><StatusBadge status={t.status} trialEnd={t.trial_end} /></TableCell>
                <TableCell>{format(new Date(t.created_at), "dd/MM/yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
};

// ─── Tenants Tab ───
const TenantsTab = ({ tenants, reload }: { tenants: Tenant[]; reload: () => void }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", owner_name: "", email: "", phone: "", cpf_cnpj: "",
    address: "", city: "", state: "",
  });

  const submit = async () => {
    if (!form.name || !form.owner_name || !form.email) {
      toast.error("Nome, responsável e e-mail são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tenant", { body: form });
      if (error) throw error;
      toast.success(`Barbearia criada! Senha temporária: ${data.temp_password}`);
      setOpen(false);
      setForm({ name: "", owner_name: "", email: "", phone: "", cpf_cnpj: "", address: "", city: "", state: "" });
      reload();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: Tenant["status"]) => {
    const { error } = await supabase.from("tenants").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status atualizado"); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-2xl text-neon">Barbearias</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="neon"><Plus className="h-4 w-4" /> Nova Barbearia</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Cadastrar Barbearia</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome da barbearia *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="col-span-2"><Label>Responsável *</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
              <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
              <div className="col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            </div>
            <Button variant="neon" onClick={submit} disabled={saving} className="w-full">
              {saving ? "Criando..." : "Criar Barbearia"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <GlassCard className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma barbearia ainda. Clique em "Nova Barbearia".</TableCell></TableRow>
            ) : tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                </TableCell>
                <TableCell><StatusBadge status={t.status} trialEnd={t.trial_end} /></TableCell>
                <TableCell>{t.city || "—"}{t.state ? `/${t.state}` : ""}</TableCell>
                <TableCell>{format(new Date(t.created_at), "dd/MM/yyyy")}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, "active")} title="Ativar"><CheckCircle2 className="h-4 w-4 text-green-400" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, "blocked")} title="Bloquear"><Ban className="h-4 w-4 text-red-400" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, "cancelled")} title="Cancelar"><XCircle className="h-4 w-4 text-gray-400" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
};

// ─── Subscriptions Tab ───
const SubscriptionsTab = ({ tenants, reload }: { tenants: Tenant[]; reload: () => void }) => {
  const renew = async (t: Tenant) => {
    const newPaid = new Date();
    newPaid.setMonth(newPaid.getMonth() + 1);
    const { error } = await supabase
      .from("tenants")
      .update({ paid_until: newPaid.toISOString(), status: "active" })
      .eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success("Renovado +30 dias"); reload(); }
  };

  return (
    <GlassCard className="p-4 overflow-x-auto">
      <h2 className="font-display text-2xl text-neon mb-4">Assinaturas</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Barbearia</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Subscription ID</TableHead>
            <TableHead>Pago até</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem barbearias</TableCell></TableRow>
          ) : tenants.map((t) => {
            const overdue = t.paid_until && new Date(t.paid_until) < new Date();
            return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  {t.status === "active" && !overdue ? (
                    <Badge className="bg-green-500/20 text-green-400 border border-green-500/40">Pago</Badge>
                  ) : overdue ? (
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/40">Atrasado</Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs">{t.subscription_id || "—"}</TableCell>
                <TableCell>{t.paid_until ? format(new Date(t.paid_until), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="neon-outline" onClick={() => renew(t)}>
                    <RefreshCw className="h-3 w-3" /> Renovar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </GlassCard>
  );
};

const Master = () => {
  const { isMaster, loading } = useAuth();
  const [section, setSection] = useState<MasterSection>("dashboard");
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const load = async () => {
    const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
    setTenants((data as any) || []);
  };

  useEffect(() => {
    if (isMaster) load();
  }, [isMaster]);

  if (loading) return null;
  if (!isMaster) return <Navigate to="/" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <MasterSidebar active={section} onChange={setSection} />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b-2 border-primary/30 flex items-center px-4 gap-3"
            style={{ background: "linear-gradient(90deg, hsl(240 60% 8%) 0%, hsl(260 50% 6%) 100%)" }}>
            <SidebarTrigger />
            <Crown className="h-5 w-5 text-primary" />
            <span className="font-display tracking-widest text-neon">PAINEL MASTER</span>
          </header>
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            {section === "dashboard" && <DashboardTab tenants={tenants} />}
            {section === "tenants" && <TenantsTab tenants={tenants} reload={load} />}
            {section === "subscriptions" && <SubscriptionsTab tenants={tenants} reload={load} />}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Master;
