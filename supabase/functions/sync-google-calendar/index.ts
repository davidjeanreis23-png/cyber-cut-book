import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getValidAccessToken(supabaseAdmin: any, settings: any) {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("ID_DO_CLIENTE_DO_GOOGLE")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const expiresAt = new Date(settings.google_token_expires_at);
  const now = new Date();

  // If token is still valid (with 5min buffer), return it
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return settings.google_access_token;
  }

  // Refresh the token
  console.log("Refreshing Google access token...");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: settings.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await response.json();
  if (tokenData.error) {
    throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error}`);
  }

  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabaseAdmin.from("settings").update({
    google_access_token: tokenData.access_token,
    google_token_expires_at: newExpiresAt,
  }).eq("id", settings.id);

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { appointment_id, action } = await req.json();
    if (!appointment_id) {
      return new Response(JSON.stringify({ error: "appointment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get settings with tokens
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings?.google_calendar_connected || !settings?.google_refresh_token) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calendarId = settings.google_calendar_id || "primary";

    // Get valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(supabaseAdmin, settings);

    // Fetch appointment
    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("*, barbers(name), services(name, duration_minutes), profiles(full_name, email)")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calAction = action || "create";

    // DELETE event
    if (calAction === "delete" && appt.google_event_id && !appt.google_event_id.startsWith("pending_")) {
      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appt.google_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (deleteRes.ok || deleteRes.status === 404) {
        await supabaseAdmin.from("appointments").update({ google_event_id: null }).eq("id", appointment_id);
        return new Response(JSON.stringify({ success: true, message: "Event deleted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errText = await deleteRes.text();
      console.error("Delete event error:", errText);
      return new Response(JSON.stringify({ error: "Failed to delete event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE event
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
        overrides: [{ method: "popup", minutes: 30 }],
      },
    };

    const createRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Create event error:", errText);
      return new Response(JSON.stringify({ error: "Failed to create event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdEvent = await createRes.json();

    // Save google_event_id
    await supabaseAdmin.from("appointments").update({
      google_event_id: createdEvent.id,
    }).eq("id", appointment_id);

    return new Response(JSON.stringify({
      success: true,
      message: "Event created",
      google_event_id: createdEvent.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
