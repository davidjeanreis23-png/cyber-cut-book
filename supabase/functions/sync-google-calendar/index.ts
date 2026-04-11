import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Google Calendar não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { appointment_id, action } = await req.json();
    if (!appointment_id) {
      return new Response(JSON.stringify({ error: "appointment_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch appointment details
    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("*, barbers(name), services(name, duration_minutes), profiles(full_name, email)")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appt) {
      return new Response(JSON.stringify({ error: "Agendamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get settings for calendar ID
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("google_calendar_id")
      .limit(1)
      .single();

    const calendarId = settings?.google_calendar_id || "primary";

    // Note: Full Google Calendar OAuth flow requires a refresh token stored per-user.
    // This is a placeholder that logs the event details.
    // To fully implement, you'd need to store OAuth refresh tokens and exchange them.
    
    const startDateTime = `${appt.appointment_date}T${appt.appointment_time}:00`;
    const durationMins = (appt as any).services?.duration_minutes || 30;
    const endDate = new Date(`${startDateTime}-03:00`);
    endDate.setMinutes(endDate.getMinutes() + durationMins);

    const event = {
      summary: `AutoBarber - ${(appt as any).services?.name || "Agendamento"}`,
      description: `Cliente: ${(appt as any).profiles?.full_name || "N/A"}\nBarbeiro: ${(appt as any).barbers?.name || "N/A"}\nE-mail: ${(appt as any).profiles?.email || "N/A"}`,
      start: {
        dateTime: `${startDateTime}-03:00`,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
        ],
      },
    };

    console.log("Google Calendar event prepared:", JSON.stringify(event));
    console.log("Calendar ID:", calendarId);
    console.log("Action:", action || "create");

    // For now, store the event data for future OAuth integration
    // When OAuth refresh tokens are available, this will create real events
    await supabaseAdmin.from("appointments").update({
      google_event_id: `pending_sync_${appointment_id}`,
    }).eq("id", appointment_id);

    return new Response(JSON.stringify({
      success: true,
      message: "Evento preparado para sincronização",
      event,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
