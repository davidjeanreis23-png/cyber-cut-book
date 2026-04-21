import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import GlassCard from "@/components/GlassCard";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Send, Calendar as CalendarIcon, BarChart3 } from "lucide-react";

type SettingsRow = {
  id: string;
  push_confirmed: boolean;
  push_cancelled: boolean;
  push_reminder_24h: boolean;
  push_payment: boolean;
  push_loyalty_points: boolean;
  push_reward_available: boolean;
};

const TOGGLES: { key: keyof Omit<SettingsRow, "id">; label: string; emoji: string }[] = [
  { key: "push_confirmed", label: "Agendamento confirmado", emoji: "✅" },
  { key: "push_cancelled", label: "Agendamento cancelado", emoji: "❌" },
  { key: "push_reminder_24h", label: "Lembrete 24h antes", emoji: "⏰" },
  { key: "push_payment", label: "Pagamento confirmado", emoji: "💰" },
  { key: "push_loyalty_points", label: "Pontos ganhos", emoji: "⭐" },
  { key: "push_reward_available", label: "Recompensa disponível", emoji: "🎁" },
];

const NotificationsTab = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [counts, setCounts] = useState({ today: 0, week: 0 });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    setSettings(data as SettingsRow | null);

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startWeek = new Date(now.getTime() - 7 * 86400000).toISOString();
    const [t, w] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", startToday),
      supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", startWeek),
    ]);
    setCounts({ today: t.count || 0, week: w.count || 0 });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key: keyof Omit<SettingsRow, "id">, value: boolean) => {
    if (!settings) return;
    setSaving(true);
    const next = { ...settings, [key]: value };
    setSettings(next);
    const { error } = await supabase
      .from("notification_settings")
      .update({ [key]: value } as any)
      .eq("id", settings.id);
    if (error) {
      toast.error("Não foi possível salvar");
      setSettings(settings);
    } else {
      toast.success("Preferência atualizada");
    }
    setSaving(false);
  };

  const sendTest = async () => {
    if (!user) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-push", {
        body: {
          user_id: user.id,
          title: "🔔 Push de teste",
          message: "Se você está vendo isso, as notificações estão funcionando!",
          url: "/admin",
        },
      });
      if (error) throw error;
      toast.success("Push de teste enviado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar push");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!settings) return <p className="text-muted-foreground">Configurações não inicializadas.</p>;

  return (
    <div className="space-y-6">
      {/* Counters */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard animate={false} className="text-center">
          <CalendarIcon className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="font-display text-2xl text-neon">{counts.today}</p>
          <p className="text-xs text-muted-foreground">Enviadas hoje</p>
        </GlassCard>
        <GlassCard animate={false} className="text-center">
          <BarChart3 className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="font-display text-2xl text-neon">{counts.week}</p>
          <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
        </GlassCard>
      </div>

      {/* Test push */}
      <GlassCard animate={false}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-primary" />
            <div>
              <p className="font-body font-semibold text-sm">Enviar push de teste</p>
              <p className="text-xs text-muted-foreground">Dispara uma notificação para o seu próprio dispositivo.</p>
            </div>
          </div>
          <Button variant="neon" onClick={sendTest} disabled={sending}>
            {sending ? "Enviando..." : "Testar"}
          </Button>
        </div>
      </GlassCard>

      {/* Toggles */}
      <GlassCard animate={false}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-display text-sm tracking-wider">TIPOS DE NOTIFICAÇÃO</h3>
        </div>
        <div className="space-y-3">
          {TOGGLES.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
            >
              <Label htmlFor={t.key} className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <span className="text-lg">{t.emoji}</span>
                <span className="text-sm">{t.label}</span>
              </Label>
              <Switch
                id={t.key}
                checked={!!settings[t.key]}
                onCheckedChange={(v) => toggle(t.key, v)}
                disabled={saving}
              />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default NotificationsTab;
