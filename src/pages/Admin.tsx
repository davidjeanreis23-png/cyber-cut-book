import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";

import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BarChart3, Calendar, Users, Bell } from "lucide-react";
import { format } from "date-fns";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import FinancialTab from "@/components/admin/FinancialTab";
import ReportsTab from "@/components/admin/ReportsTab";
import ClientsTab from "@/components/admin/ClientsTab";
import AdminSidebar, { AdminSection } from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useState as useStateReact } from "react";

// ─── Stats Tab ───
const StatsTab = () => {
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, revenue: 0, users: 0 });

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      const weekAgo = format(new Date(now.getTime() - 7 * 86400000), "yyyy-MM-dd");
      const monthAgo = format(new Date(now.getTime() - 30 * 86400000), "yyyy-MM-dd");

      const [t, w, m, u] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("appointment_date", today),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("appointment_date", weekAgo),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("appointment_date", monthAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({ today: t.count || 0, week: w.count || 0, month: m.count || 0, revenue: 0, users: u.count || 0 });
    };
    fetch();
  }, []);

  const metrics = [
    { label: "Hoje", value: stats.today, icon: Calendar },
    { label: "Semana", value: stats.week, icon: BarChart3 },
    { label: "Mês", value: stats.month, icon: BarChart3 },
    { label: "Usuários", value: stats.users, icon: Users },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <GlassCard key={i} animate={false} className="text-center">
          <m.icon className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="font-display text-2xl text-neon">{m.value}</p>
          <p className="text-xs text-muted-foreground">{m.label}</p>
        </GlassCard>
      ))}
    </div>
  );
};

// ─── Appointments Tab ───
const AppointmentsTab = () => {
  const [appts, setAppts] = useState<any[]>([]);
  const [statusF, setStatusF] = useState("all");

  const fetchAppts = async () => {
    const q = supabase.from("appointments")
      .select("*, barbers(name), services(name, price), profiles(full_name, email)")
      .order("appointment_date", { ascending: false }).limit(100);
    const { data } = await q;
    setAppts(data || []);
  };

  useEffect(() => { fetchAppts(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status: status as any }).eq("id", id);
    toast.success("Status atualizado");
    fetchAppts();
  };

  const deleteAppt = async (id: string, googleEventId: string | null) => {
    // Tenta remover do Google Calendar primeiro (best effort)
    if (googleEventId) {
      try {
        await supabase.functions.invoke("sync-google-calendar", {
          body: { appointment_id: id, action: "delete" },
        });
      } catch (e) {
        console.error("Erro ao remover do Google Calendar:", e);
      }
    }
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir agendamento");
    else { toast.success("Agendamento excluído"); fetchAppts(); }
  };

  const filtered = appts.filter(a => statusF === "all" || a.status === statusF);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {filtered.map(a => (
          <GlassCard key={a.id} animate={false} className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-body font-semibold text-base text-foreground truncate">
                  {a.profiles?.full_name || a.profiles?.email || "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {a.services?.name || "—"}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span>{format(new Date(a.appointment_date + "T00:00"), "dd/MM/yyyy")} • {a.appointment_time}</span>
                  <span>{a.barbers?.name}</span>
                  <span className="text-primary font-semibold">R$ {Number(a.services?.price || 0).toFixed(2)}</span>
                  <span className="opacity-70">• {a.status}</span>
                  {a.payment_method && <span className="opacity-70">• {a.payment_method}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.status === "confirmed" && (
                  <>
                    <Button size="sm" variant="neon" onClick={() => updateStatus(a.id, "completed")}>Concluir</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(a.id, "cancelled")}>Cancelar</Button>
                  </>
                )}
                <ConfirmDeleteButton
                  onConfirm={() => deleteAppt(a.id, a.google_event_id)}
                  title="Excluir agendamento?"
                  description="O evento também será removido do Google Calendar (se sincronizado). Esta ação não pode ser desfeita."
                />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

// ─── Barbers Tab ───
const BarbersTab = () => {
  const [barbers, setBarbers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const fetch = async () => {
    const { data } = await supabase.from("barbers").select("*").order("name");
    setBarbers(data || []);
  };
  useEffect(() => { fetch(); }, []);

  const save = async () => {
    const obj = { name, photo_url: photoUrl || null, specialties: specialties ? specialties.split(",").map(s => s.trim()) : null, bio: bio || null };
    if (editing) {
      await supabase.from("barbers").update(obj).eq("id", editing);
      toast.success("Barbeiro atualizado");
    } else {
      await supabase.from("barbers").insert(obj);
      toast.success("Barbeiro criado");
    }
    setName(""); setPhotoUrl(""); setSpecialties(""); setBio(""); setEditing(null);
    fetch();
  };

  const edit = (b: any) => {
    setEditing(b.id); setName(b.name); setPhotoUrl(b.photo_url || "");
    setSpecialties(b.specialties?.join(", ") || ""); setBio(b.bio || "");
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("barbers").update({ is_active: !active }).eq("id", id);
    fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("barbers").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir. Pode existir agendamento vinculado.");
    else { toast.success("Barbeiro excluído"); fetch(); }
  };

  return (
    <div className="space-y-6">
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">{editing ? "EDITAR" : "NOVO"} BARBEIRO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Foto (URL)</Label><Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} /></div>
          <div><Label>Especialidades (separar por vírgula)</Label><Input value={specialties} onChange={e => setSpecialties(e.target.value)} /></div>
          <div><Label>Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="neon" onClick={save} disabled={!name}>Salvar</Button>
          {editing && <Button variant="ghost" onClick={() => { setEditing(null); setName(""); setPhotoUrl(""); setSpecialties(""); setBio(""); }}>Cancelar</Button>}
        </div>
      </GlassCard>

      <div className="space-y-3">
        {barbers.map(b => (
          <GlassCard key={b.id} animate={false} className="flex items-center justify-between py-3">
            <div className="flex-1 min-w-0">
              <p className="font-body font-semibold text-base">{b.name}</p>
              <p className="text-sm text-muted-foreground">{b.specialties?.join(", ") || "—"}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b.id, b.is_active)} />
              <Button variant="ghost" size="sm" onClick={() => edit(b)}>Editar</Button>
              <ConfirmDeleteButton
                onConfirm={() => remove(b.id)}
                title={`Excluir ${b.name}?`}
                description="Esta ação não pode ser desfeita."
              />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

// ─── Services Tab ───
const ServicesTab = () => {
  const [services, setServices] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const fetch = async () => {
    const { data } = await supabase.from("services").select("*").order("name");
    setServices(data || []);
  };
  useEffect(() => { fetch(); }, []);

  const save = async () => {
    const obj = { name, description: description || null, category: category || null, duration_minutes: parseInt(duration), price: parseFloat(price) };
    if (editing) {
      await supabase.from("services").update(obj).eq("id", editing);
      toast.success("Serviço atualizado");
    } else {
      await supabase.from("services").insert(obj);
      toast.success("Serviço criado");
    }
    setName(""); setDescription(""); setCategory(""); setDuration("30"); setPrice(""); setEditing(null);
    fetch();
  };

  const edit = (s: any) => {
    setEditing(s.id); setName(s.name); setDescription(s.description || "");
    setCategory(s.category || ""); setDuration(String(s.duration_minutes)); setPrice(String(s.price));
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("services").update({ is_active: !active }).eq("id", id);
    fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir. Pode existir agendamento vinculado.");
    else { toast.success("Serviço excluído"); fetch(); }
  };

  return (
    <div className="space-y-6">
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">{editing ? "EDITAR" : "NOVO"} SERVIÇO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Categoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="corte, barba, combo..." /></div>
          <div><Label>Duração (min)</Label><Input type="number" value={duration} onChange={e => setDuration(e.target.value)} /></div>
          <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></div>
          <div className="col-span-full"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="neon" onClick={save} disabled={!name || !price}>Salvar</Button>
          {editing && <Button variant="ghost" onClick={() => { setEditing(null); setName(""); setDescription(""); setCategory(""); setDuration("30"); setPrice(""); }}>Cancelar</Button>}
        </div>
      </GlassCard>

      <div className="space-y-3">
        {services.map(s => (
          <GlassCard key={s.id} animate={false} className="flex items-center justify-between py-3">
            <div className="flex-1 min-w-0">
              <p className="font-body font-semibold text-base">{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.duration_minutes}min • R$ {Number(s.price).toFixed(2)} {s.category && `• ${s.category}`}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
              <Button variant="ghost" size="sm" onClick={() => edit(s)}>Editar</Button>
              <ConfirmDeleteButton
                onConfirm={() => remove(s.id)}
                title={`Excluir ${s.name}?`}
                description="Esta ação não pode ser desfeita."
              />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

// ─── Settings Tab ───
const SettingsTab = () => {
  const [settings, setSettings] = useState<any>(null);
  

  useEffect(() => {
    supabase.from("settings").select("*").limit(1).single().then(({ data }) => setSettings(data));
  }, []);

  const save = async () => {
    if (!settings) return;
    const { id, created_at, ...rest } = settings;
    await supabase.from("settings").update(rest).eq("id", id);
    toast.success("Configurações salvas");
    document.documentElement.setAttribute("data-theme", settings.current_theme === "purple-cyber" ? "" : settings.current_theme);
  };

  if (!settings) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Google Calendar - Service Account */}
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">GOOGLE CALENDAR</h3>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Conectado via Service Account • davidjeanreis.29@gmail.com</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Eventos são sincronizados automaticamente ao confirmar ou cancelar agendamentos.</p>
      </GlassCard>

      {/* General Settings */}
      <GlassCard animate={false}>
        <h3 className="font-display text-sm tracking-wider mb-3">CONFIGURAÇÕES GERAIS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Abertura</Label><Input value={settings.opening_time} onChange={e => setSettings({ ...settings, opening_time: e.target.value })} /></div>
          <div><Label>Fechamento</Label><Input value={settings.closing_time} onChange={e => setSettings({ ...settings, closing_time: e.target.value })} /></div>
          <div><Label>Intervalo (min)</Label><Input type="number" value={settings.appointment_interval} onChange={e => setSettings({ ...settings, appointment_interval: parseInt(e.target.value) || 30 })} /></div>
          <div><Label>Pontos por agendamento</Label><Input type="number" value={settings.loyalty_points_per_booking} onChange={e => setSettings({ ...settings, loyalty_points_per_booking: parseInt(e.target.value) || 10 })} /></div>
          <div className="col-span-full"><Label>Endereço</Label><Input value={settings.barber_address || ""} onChange={e => setSettings({ ...settings, barber_address: e.target.value })} /></div>
          <div>
            <Label>Tema</Label>
            <Select value={settings.current_theme} onValueChange={v => setSettings({ ...settings, current_theme: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="purple-cyber">Roxo Cyber</SelectItem>
                <SelectItem value="green-neon">Verde Neon</SelectItem>
                <SelectItem value="blue-electric">Azul Elétrico</SelectItem>
                <SelectItem value="orange-flame">Laranja Chama</SelectItem>
                <SelectItem value="pink-neon">Rosa Neon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="neon" className="mt-6" onClick={save}>SALVAR CONFIGURAÇÕES</Button>
      </GlassCard>
    </div>
  );
};

// ─── Main Admin ───
const SECTION_TITLES: Record<AdminSection, string> = {
  stats: "Dashboard",
  appointments: "Agendamentos",
  barbers: "Barbeiros",
  services: "Serviços",
  clients: "Clientes",
  financial: "Financeiro",
  reports: "Relatórios",
  loyalty: "Fidelidade",
  notifications: "Notificações",
  settings: "Configurações",
};

const PlaceholderTab = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <GlassCard animate={false} className="text-center py-12">
    <Icon className="h-10 w-10 text-primary mx-auto mb-3" />
    <h3 className="font-display text-xl text-neon mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">Em breve neste painel.</p>
  </GlassCard>
);

const Admin = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("stats");

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [isAdmin, loading]);

  if (loading) return null;

  const renderSection = () => {
    switch (section) {
      case "stats": return <StatsTab />;
      case "appointments": return <AppointmentsTab />;
      case "financial": return <FinancialTab />;
      case "reports": return <ReportsTab />;
      case "clients": return <ClientsTab />;
      case "barbers": return <BarbersTab />;
      case "services": return <ServicesTab />;
      case "settings": return <SettingsTab />;
      case "loyalty": return <PlaceholderTab icon={Bell} title="Fidelidade" />;
      case "notifications": return <PlaceholderTab icon={Bell} title="Notificações" />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar active={section} onChange={setSection} />

        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <div className="h-12 flex items-center gap-3 border-b border-primary/20 px-4 sticky top-16 z-30 bg-background/80 backdrop-blur">
            <SidebarTrigger />
            <h1 className="font-display text-sm tracking-widest text-neon uppercase">
              {SECTION_TITLES[section]}
            </h1>
          </div>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-6xl w-full mx-auto">
            {renderSection()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Admin;
