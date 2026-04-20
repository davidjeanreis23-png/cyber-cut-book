import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import SEO from "@/components/SEO";

import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import MapButton from "@/components/MapButton";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  barbers: { name: string } | null;
  services: { name: string; price: number } | null;
}

const statusColors: Record<string, string> = {
  confirmed: "bg-primary/20 text-primary",
  completed: "bg-accent/20 text-accent",
  cancelled: "bg-destructive/20 text-destructive",
  pending_payment: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  pending_payment: "Aguardando pagamento",
};

const Appointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, status, payment_status, payment_method, notes, barbers(name), services(name, price)")
      .eq("user_id", user.id)
      .order("appointment_date", { ascending: false });
    setAppointments((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [user]);

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" as any }).eq("id", id);
    if (error) { toast.error("Erro ao cancelar"); return; }
    // Remove do Google Calendar (best effort)
    try {
      await supabase.functions.invoke("sync-google-calendar", {
        body: { appointment_id: id, action: "delete" },
      });
    } catch (e) { console.error("Calendar sync error:", e); }
    toast.success("Agendamento cancelado");
    fetchAppointments();
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.functions.invoke("sync-google-calendar", {
        body: { appointment_id: id, action: "delete" },
      });
    } catch (e) { console.error("Calendar sync error:", e); }
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Agendamento excluído"); fetchAppointments(); }
  };

  const filtered = appointments.filter(a => {
    const matchText = !filter || 
      a.barbers?.name?.toLowerCase().includes(filter.toLowerCase()) ||
      a.services?.name?.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchText && matchStatus;
  });

  return (
    <div className="min-h-screen">
      <SEO title="Meus agendamentos | AutoBarber" description="Acompanhe e gerencie seus agendamentos confirmados, concluídos e cancelados na AutoBarber." path="/appointments" />
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="font-display text-4xl text-center tracking-wider text-neon mb-4">MEUS AGENDAMENTOS</h1>

        <div className="flex justify-center mb-6">
          <MapButton label="Como chegar à barbearia" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input placeholder="Buscar barbeiro ou serviço..." value={filter} onChange={e => setFilter(e.target.value)} className="flex-1" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="pending_payment">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-muted/30 animate-shimmer" style={{ backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.05) 50%, transparent 100%)" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhum agendamento encontrado</p>
        ) : (
          <div className="space-y-4">
            {filtered.map(a => (
              <GlassCard key={a.id} animate={false} className="flex flex-col gap-3">
                {/* Cliente / status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-base text-foreground">
                      {a.services?.name || "Serviço"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Com {a.barbers?.name || "—"}
                    </p>
                  </div>
                  <span className={cn("px-2 py-1 rounded-md text-[11px] font-body font-medium shrink-0", statusColors[a.status])}>
                    {statusLabels[a.status] || a.status}
                  </span>
                </div>

                {/* Footer: horário + preço alinhado à direita */}
                <div className="flex items-end justify-between gap-3 pt-2 border-t border-border/40">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(a.appointment_date + "T00:00"), "dd/MM/yyyy")} • {a.appointment_time}
                    {a.payment_method && <span className="ml-2 opacity-70">· {a.payment_method}</span>}
                  </p>
                  <p className="text-base font-body font-semibold text-primary">
                    R$ {Number(a.services?.price || 0).toFixed(2)}
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-2">
                  {a.status === "confirmed" && new Date(a.appointment_date) >= new Date(new Date().toDateString()) && (
                    <Button variant="destructive" size="sm" onClick={() => handleCancel(a.id)}>
                      Cancelar
                    </Button>
                  )}
                  <ConfirmDeleteButton
                    onConfirm={() => handleDelete(a.id)}
                    title="Excluir este agendamento?"
                    description="O evento também será removido do Google Calendar (se sincronizado). Esta ação não pode ser desfeita."
                  />
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Appointments;
