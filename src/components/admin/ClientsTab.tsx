import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GlassCard from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { format, differenceInDays } from "date-fns";
import { User } from "lucide-react";

interface Client {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  appointments: any[];
  totalSpent: number;
  visits: number;
  lastVisit: string | null;
  avgFrequency: number | null;
}

const ClientsTab = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    const load = async () => {
      const [profilesRes, apptsRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,phone").order("full_name"),
        supabase.from("appointments")
          .select("id,user_id,appointment_date,appointment_time,payment_method,status,services(name,price),barbers(name)")
          .order("appointment_date", { ascending: false }),
      ]);
      const profiles = profilesRes.data || [];
      const appts = (apptsRes.data as any[]) || [];

      const byUser: Record<string, any[]> = {};
      appts.forEach(a => {
        if (!byUser[a.user_id]) byUser[a.user_id] = [];
        byUser[a.user_id].push(a);
      });

      const result: Client[] = profiles.map(p => {
        const userAppts = (byUser[p.id] || []).filter(a => a.status === "completed");
        const totalSpent = userAppts.reduce((s, a) => s + Number(a.services?.price || 0), 0);
        const visits = userAppts.length;
        const lastVisit = userAppts[0]?.appointment_date || null;
        let avgFrequency = null;
        if (userAppts.length > 1) {
          const dates = userAppts.map(a => new Date(a.appointment_date).getTime()).sort();
          const span = (dates[dates.length - 1] - dates[0]) / 86400000;
          avgFrequency = Math.round(span / (userAppts.length - 1));
        }
        return {
          ...p,
          appointments: byUser[p.id] || [],
          totalSpent, visits, lastVisit, avgFrequency,
        };
      });
      setClients(result.sort((a, b) => b.totalSpent - a.totalSpent));
    };
    load();
  }, []);

  const filtered = clients.filter(c =>
    !search ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="text-sm text-primary hover:underline">
          ← Voltar para lista
        </button>
        <GlassCard animate={false}>
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border border-neon">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-xl tracking-wider">{selected.full_name || "—"}</p>
              <p className="text-sm text-muted-foreground">{selected.email}</p>
              {selected.phone && <p className="text-sm text-muted-foreground">{selected.phone}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Total gasto</p>
              <p className="font-display text-xl text-neon">R$ {selected.totalSpent.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Visitas</p>
              <p className="font-display text-xl text-neon">{selected.visits}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Última visita</p>
              <p className="font-body text-sm">{selected.lastVisit ? format(new Date(selected.lastVisit + "T00:00"), "dd/MM/yyyy") : "—"}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Frequência média</p>
              <p className="font-body text-sm">{selected.avgFrequency ? `${selected.avgFrequency} dias` : "—"}</p>
            </div>
          </div>
          <h4 className="font-display text-sm tracking-wider mb-2">HISTÓRICO DE ATENDIMENTOS</h4>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {selected.appointments.length === 0 && <p className="text-sm text-muted-foreground">Sem atendimentos.</p>}
            {selected.appointments.map((a: any) => (
              <div key={a.id} className="flex justify-between border-b border-border/30 py-2 last:border-0 text-sm">
                <div>
                  <p className="font-body font-medium">{a.services?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(a.appointment_date + "T00:00"), "dd/MM/yyyy")} {a.appointment_time} • {a.barbers?.name} • {a.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-primary font-semibold">R$ {Number(a.services?.price || 0).toFixed(2)}</p>
                  {a.payment_method && <p className="text-xs text-muted-foreground">{a.payment_method}</p>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nome, email ou telefone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-md"
      />
      <div className="space-y-2 max-h-[70vh] overflow-y-auto">
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full text-left"
          >
            <GlassCard animate={false} className="py-3 hover:border-primary transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-body font-semibold">{c.full_name || c.email || "—"}</p>
                  <p className="text-xs text-muted-foreground">{c.email} {c.phone && `• ${c.phone}`}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-sm text-neon">R$ {c.totalSpent.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{c.visits} visitas</p>
                </div>
              </div>
            </GlassCard>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente.</p>}
      </div>
    </div>
  );
};

export default ClientsTab;
