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
import { Plus, Crown, Building2, DollarSign, Clock, CheckCircle2, XCircle, Ban, RefreshCw, Loader2, Pencil, KeyRound } from "lucide-react";
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
  const mrr = active * 29.99;

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

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", owner_name: "", email: "", phone: "",
    status: "trial" as Tenant["status"],
    trial_start: "", trial_end: "", paid_until: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTenant, setPwdTenant] = useState<Tenant | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

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

  const openEdit = (t: Tenant) => {
    setEditing(t);
    setEditForm({
      name: t.name,
      owner_name: t.owner_name,
      email: t.email,
      phone: t.phone || "",
      status: t.status,
      trial_start: "",
      trial_end: t.trial_end ? t.trial_end.slice(0, 10) : "",
      paid_until: t.paid_until ? t.paid_until.slice(0, 10) : "",
    });
    supabase.from("tenants").select("trial_start").eq("id", t.id).maybeSingle().then(({ data }) => {
      if (data?.trial_start) setEditForm((f) => ({ ...f, trial_start: String(data.trial_start).slice(0, 10) }));
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      const payload: any = {
        name: editForm.name,
        owner_name: editForm.owner_name,
        email: editForm.email,
        phone: editForm.phone || null,
        status: editForm.status,
        trial_start: editForm.trial_start ? new Date(editForm.trial_start).toISOString() : null,
        trial_end: editForm.trial_end ? new Date(editForm.trial_end).toISOString() : null,
        paid_until: editForm.paid_until ? new Date(editForm.paid_until).toISOString() : null,
      };
      const { error } = await supabase.from("tenants").update(payload).eq("id", editing.id);
      if (error) throw error;
      toast.success("Barbearia atualizada");
      setEditOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setEditSaving(false);
    }
  };

  const openPwd = (t: Tenant) => {
    setPwdTenant(t);
    setPwdValue("");
    setPwdOpen(true);
  };

  const savePwd = async () => {
    if (!pwdTenant) return;
    if (pwdValue.length < 6) { toast.error("Senha mínima de 6 caracteres"); return; }
    setPwdSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant-password", {
        body: { tenant_id: pwdTenant.id, new_password: pwdValue },
      });
      if (error) {
        const ctx: any = (error as any)?.context;
        let msg = error.message;
        if (ctx?.body) {
          try { const p = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body; if (p?.error) msg = p.error; } catch {}
        }
        throw new Error(msg);
      }
      toast.success(`Senha atualizada para ${(data?.updated || []).join(", ")}`);
      setPwdOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar senha");
    } finally {
      setPwdSaving(false);
    }
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
              <TableHead>Cadastro</TableHead>
              <TableHead>Trial Fim</TableHead>
              <TableHead>Pago até</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma barbearia ainda.</TableCell></TableRow>
            ) : tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                </TableCell>
                <TableCell><StatusBadge status={t.status} trialEnd={t.trial_end} /></TableCell>
                <TableCell className="text-xs">{format(new Date(t.created_at), "dd/MM/yyyy")}</TableCell>
                <TableCell className="text-xs">{t.trial_end ? format(new Date(t.trial_end), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="text-xs">{t.paid_until ? format(new Date(t.paid_until), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="Editar"><Pencil className="h-4 w-4 text-primary" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => openPwd(t)} title="Alterar senha"><KeyRound className="h-4 w-4 text-yellow-400" /></Button>
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

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Barbearia</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Responsável</Label><Input value={editForm.owner_name} onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Status</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Tenant["status"] })}
              >
                <option value="trial">Trial</option>
                <option value="active">Ativo</option>
                <option value="blocked">Bloqueado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div><Label>Trial Início</Label><Input type="date" value={editForm.trial_start} onChange={(e) => setEditForm({ ...editForm, trial_start: e.target.value })} /></div>
            <div><Label>Trial Fim</Label><Input type="date" value={editForm.trial_end} onChange={(e) => setEditForm({ ...editForm, trial_end: e.target.value })} /></div>
            <div className="col-span-2"><Label>Pago até (assinatura)</Label><Input type="date" value={editForm.paid_until} onChange={(e) => setEditForm({ ...editForm, paid_until: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Use estas datas para controlar testes — ex.: Início 20/04/2026, Fim 22/04/2026. O acesso é bloqueado automaticamente quando "Trial Fim" passa (status=trial) ou "Pago até" expira.
          </p>
          <Button variant="neon" onClick={saveEdit} disabled={editSaving} className="w-full">
            {editSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Definir senha — {pwdTenant?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha (mínimo 6 caracteres)</Label>
            <Input type="text" value={pwdValue} onChange={(e) => setPwdValue(e.target.value)} placeholder="Nova senha de acesso" />
            <p className="text-xs text-muted-foreground">Aplicada ao admin desta barbearia ({pwdTenant?.email}).</p>
          </div>
          <Button variant="neon" onClick={savePwd} disabled={pwdSaving} className="w-full">
            {pwdSaving ? "Atualizando..." : "Atualizar senha"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Subscriptions Tab ───
const SubscriptionsTab = ({ tenants, reload, setTenants }: { tenants: Tenant[]; reload: () => void; setTenants: React.Dispatch<React.SetStateAction<Tenant[]>> }) => {
  const [busy, setBusy] = useState<{ id: string; action: "renew" | "cancel" } | null>(null);

  const extractError = (e: any): string => {
    // Supabase functions.invoke errors often hide the body in e.context
    const ctx = e?.context;
    if (ctx?.body) {
      try {
        const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.error) return parsed.error;
      } catch { /* ignore */ }
    }
    return e?.message || "Erro desconhecido";
  };

  const renew = async (t: Tenant) => {
    setBusy({ id: t.id, action: "renew" });
    try {
      const { data, error } = await supabase.functions.invoke("renew-subscription-manual", {
        body: { tenant_id: t.id, days: 30 },
      });
      if (error) throw error;
      // Optimistic update
      setTenants((prev) => prev.map((x) => x.id === t.id ? { ...x, status: "active", paid_until: data?.paid_until ?? x.paid_until } : x));
      toast.success(`"${t.name}" renovada por +30 dias`);
      reload();
    } catch (e: any) {
      toast.error(`Falha ao renovar: ${extractError(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (t: Tenant) => {
    if (!confirm(`Cancelar a assinatura de "${t.name}"? Isso bloqueia o acesso e cancela no Mercado Pago.`)) return;
    setBusy({ id: t.id, action: "cancel" });
    try {
      const { error } = await supabase.functions.invoke("cancel-subscription", {
        body: { tenant_id: t.id },
      });
      if (error) throw error;
      // Optimistic update
      setTenants((prev) => prev.map((x) => x.id === t.id ? { ...x, status: "cancelled" } : x));
      toast.success(`Assinatura de "${t.name}" cancelada`);
      reload();
    } catch (e: any) {
      toast.error(`Falha ao cancelar: ${extractError(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassCard className="p-4 overflow-x-auto">
      <h2 className="font-display text-2xl text-neon mb-4">Assinaturas</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Plano PRO — <span className="text-primary font-semibold">R$ 29,99/mês</span> • Webhook MP:{" "}
        <code className="text-xs">https://tegbsetxdvgqojmlfwig.supabase.co/functions/v1/mercadopago-webhook</code>
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Barbearia</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Subscription ID</TableHead>
            <TableHead>Pago até</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem barbearias</TableCell></TableRow>
          ) : tenants.map((t) => {
            const overdue = t.paid_until && new Date(t.paid_until) < new Date();
            return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  {t.status === "cancelled" ? (
                    <Badge className="bg-gray-500/20 text-gray-400 border border-gray-500/40">Cancelada</Badge>
                  ) : t.status === "blocked" ? (
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/40">Bloqueada</Badge>
                  ) : t.status === "active" && !overdue ? (
                    <Badge className="bg-green-500/20 text-green-400 border border-green-500/40">Ativa</Badge>
                  ) : overdue ? (
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/40">Atrasada</Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">Trial</Badge>
                  )}
                </TableCell>
                <TableCell>R$ {Number(t.plan_price || 29.99).toFixed(2)}</TableCell>
                <TableCell className="text-xs max-w-[160px] truncate" title={t.subscription_id || ""}>
                  {t.subscription_id || "—"}
                </TableCell>
                <TableCell>{t.paid_until ? format(new Date(t.paid_until), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      size="sm"
                      variant="neon-outline"
                      disabled={busy?.id === t.id}
                      onClick={() => renew(t)}
                      title="Renovar +30 dias"
                    >
                      {busy?.id === t.id && busy.action === "renew"
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                      {busy?.id === t.id && busy.action === "renew" ? "Renovando..." : "Renovar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy?.id === t.id || t.status === "cancelled"}
                      onClick={() => cancel(t)}
                      title="Cancelar assinatura"
                      className="text-red-400 hover:text-red-300"
                    >
                      {busy?.id === t.id && busy.action === "cancel"
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Ban className="h-3 w-3" />}
                      {busy?.id === t.id && busy.action === "cancel" ? "Cancelando..." : "Cancelar"}
                    </Button>
                  </div>
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
            {section === "subscriptions" && <SubscriptionsTab tenants={tenants} reload={load} setTenants={setTenants} />}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Master;
