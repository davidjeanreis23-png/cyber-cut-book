import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

/**
 * Cron-driven reminder dispatcher.
 * Finds appointments confirmed for ~24h from now (within a 15-min window)
 * and triggers a push notification via the send-push function.
 * Uses notifications table (type = 'reminder_24h') as idempotency key.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Window: appointments scheduled between 23h45m and 24h15m from now
    const now = new Date();
    const lower = new Date(now.getTime() + (24 * 60 - 15) * 60 * 1000);
    const upper = new Date(now.getTime() + (24 * 60 + 15) * 60 * 1000);

    const lowerDate = lower.toISOString().slice(0, 10);
    const upperDate = upper.toISOString().slice(0, 10);

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, user_id, appointment_date, appointment_time, status, services(name), barbers(name)")
      .in("status", ["confirmed"])
      .gte("appointment_date", lowerDate)
      .lte("appointment_date", upperDate);

    if (error) throw error;

    let sent = 0;
    for (const a of appts || []) {
      const apptDt = new Date(`${a.appointment_date}T${a.appointment_time}`);
      if (apptDt < lower || apptDt > upper) continue;

      // Idempotency: check if we already sent a reminder for this appointment
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("appointment_id", a.id)
        .eq("type", "reminder_24h")
        .maybeSingle();
      if (existing) continue;

      const serviceName = (a as any).services?.name || "agendamento";
      const time = a.appointment_time?.slice(0, 5) || a.appointment_time;
      const title = "⏰ Lembrete: corte amanhã";
      const message = `Não esqueça: ${serviceName} às ${time}.`;

      // Insert in-app notification (also serves as idempotency)
      await supabase.from("notifications").insert({
        user_id: a.user_id,
        title,
        message,
        type: "reminder_24h",
        appointment_id: a.id,
      });

      // Fire push
      await supabase.functions.invoke("send-push", {
        body: { user_id: a.user_id, title, message, url: "/appointments" },
      });
      sent++;
    }

    return new Response(JSON.stringify({ checked: (appts || []).length, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[push-reminders] error", e);
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
