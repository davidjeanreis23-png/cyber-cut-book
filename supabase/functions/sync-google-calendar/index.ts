import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALENDAR_ID = "davidjeanreis.29@gmail.com";

async function getServiceAccountToken(): Promise<string> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret not set");

  const sa = JSON.parse(saJson);
  const scope = "https://www.googleapis.com/auth/calendar";
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    enc.encode(unsignedToken)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    console.error("Token exchange error:", JSON.stringify(tokenData));
    throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
  }

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

    // Get access token via Service Account
    const accessToken = await getServiceAccountToken();

    // Fetch appointment with relations
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
    const calendarId = encodeURIComponent(CALENDAR_ID);

    // DELETE event
    if (calAction === "delete" && appt.google_event_id && !appt.google_event_id.startsWith("pending_")) {
      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${appt.google_event_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
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
      summary: `AutoBarber - ${(appt as any).services?.name || "Agendamento"} com ${(appt as any).barbers?.name || "N/A"}`,
      description: `Cliente: ${(appt as any).profiles?.full_name || "N/A"}\nE-mail: ${(appt as any).profiles?.email || "N/A"}`,
      start: { dateTime: `${startDateTime}-03:00`, timeZone: "America/Sao_Paulo" },
      end: { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    };

    const createRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Create event error:", errText);
      return new Response(JSON.stringify({ error: "Failed to create event", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdEvent = await createRes.json();

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
