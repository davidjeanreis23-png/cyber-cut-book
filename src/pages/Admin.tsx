import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import ThemeToggle from "@/components/ThemeToggle";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart3, Calendar, Users, Scissors, Award, Settings, CreditCard, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-display tracking-wider">{a.profiles?.full_name || a.profiles?.email || "—"}</p>
                <p className="text-xs text-muted-foreground">{a.barbers?.name} • {a.services?.name} • {format(new Date(a.appointment_date + "T00:00"), "dd/MM/yyyy")} {a.appointment_time}</p>
                <p className="text-xs text-muted-foreground">R$ {Number(a.services?.price || 0).toFixed(2)} • {a.status}</p>
              </div>
              <div className="flex gap-2">
                {a.status === "confirmed" && (
                  <>
                    <Button size="sm" variant="neon" onClick={() => updateStatus(a.id, "completed")}>Concluir</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(a.id, "cancelled")}>Cancelar</Button>
                  </>
                )}
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
            <div>
              <p className="font-display text-sm tracking-wider">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.specialties?.join(", ") || "—"}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b.id, b.is_active)} />
              <Button variant="ghost" size="sm" onClick={() => edit(b)}>Editar</Button>
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
            <div>
              <p className="font-display text-sm tracking-wider">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.duration_minutes}min • R$ {Number(s.price).toFixed(2)} {s.category && `• ${s.category}`}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
              <Button variant="ghost" size="sm" onClick={() => edit(s)}>Editar</Button>
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
const Admin = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [isAdmin, loading]);

  if (loading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <ThemeToggle />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="font-display text-2xl text-center tracking-wider text-neon mb-8">PAINEL ADMIN</h1>

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="w-full flex flex-wrap gap-1 h-auto bg-card border border-neon p-1 mb-6">
            {[
              { v: "stats", icon: BarChart3, label: "Estatísticas" },
              { v: "appointments", icon: Calendar, label: "Agendamentos" },
              { v: "barbers", icon: Scissors, label: "Barbeiros" },
              { v: "services", icon: Users, label: "Serviços" },
              { v: "settings", icon: Settings, label: "Configurações" },
            ].map(t => (
              <TabsTrigger key={t.v} value={t.v} className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="appointments"><AppointmentsTab /></TabsContent>
          <TabsContent value="barbers"><BarbersTab /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
