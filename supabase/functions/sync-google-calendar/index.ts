import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALENDAR_ID = "davidjeanreis.29@gmail.com";

async function getServiceAccountToken(): Promise<string> {
  console.log("=== INÍCIO: getServiceAccountToken ===");

  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  console.log("GOOGLE_SERVICE_ACCOUNT_JSON existe:", !!saJson);
  console.log("GOOGLE_SERVICE_ACCOUNT_JSON length:", saJson?.length ?? 0);

  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret not set");

  let sa: any;
  try {
    sa = JSON.parse(saJson);
    console.log("JSON.parse OK");
    console.log("type:", sa.type);
    console.log("project_id:", sa.project_id);
    console.log("client_email:", sa.client_email);
    console.log("client_id:", sa.client_id);
    console.log("token_uri:", sa.token_uri);
    console.log("private_key exists:", !!sa.private_key);
    console.log("private_key starts with:", sa.private_key?.substring(0, 30));
    console.log("private_key length:", sa.private_key?.length);
  } catch (parseErr) {
    console.error("ERRO ao fazer JSON.parse:", parseErr.message);
    console.error("Primeiros 100 chars do JSON:", saJson?.substring(0, 100));
    throw new Error(`Failed to parse service account JSON: ${parseErr.message}`);
  }

  if (sa.type !== "service_account") {
    throw new Error(`JSON type inválido: "${sa.type}" (esperado: "service_account")`);
  }

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

  console.log("JWT header+payload criados");

  // Import private key and sign
  let cryptoKey: CryptoKey;
  try {
    const pemBody = sa.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\n/g, "");
    const binaryKey = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));

    console.log("PEM decoded, binaryKey length:", binaryKey.length);

    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    console.log("crypto.subtle.importKey OK");
  } catch (keyErr) {
    console.error("ERRO ao importar private key:", keyErr.message, keyErr.stack);
    throw new Error(`Failed to import private key: ${keyErr.message}`);
  }

  let signature: ArrayBuffer;
  try {
    signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      enc.encode(unsignedToken)
    );
    console.log("JWT assinado com sucesso");
  } catch (signErr) {
    console.error("ERRO ao assinar JWT:", signErr.message, signErr.stack);
    throw new Error(`Failed to sign JWT: ${signErr.message}`);
  }

  const signatureB64 = base64url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  console.log("Trocando JWT por access token em:", sa.token_uri);
  const tokenRes = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  console.log("Token exchange status:", tokenRes.status);

  if (tokenData.error) {
    console.error("Token exchange error:", JSON.stringify(tokenData));
    throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
  }

  console.log("Access token obtido com sucesso, expires_in:", tokenData.expires_in);
  console.log("=== FIM: getServiceAccountToken ===");
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { appointment_id, action } = body;
    console.log("=== REQUISIÇÃO RECEBIDA ===");
    console.log("appointment_id:", appointment_id);
    console.log("action:", action);

    if (!appointment_id && action !== "test") {
      return new Response(JSON.stringify({ error: "appointment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── TEST action: validate auth + calendar access ──
    if (action === "test") {
      console.log("=== MODO TESTE ===");
      try {
        const accessToken = await getServiceAccountToken();
        console.log("Auth inicializado com sucesso");

        const calendarId = encodeURIComponent(CALENDAR_ID);
        const listUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?maxResults=3&orderBy=startTime&singleEvents=true&timeMin=${new Date().toISOString()}`;
        console.log("Testando acesso ao calendário:", CALENDAR_ID);

        const listRes = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const listData = await listRes.json();
        console.log("Calendar list status:", listRes.status);

        if (!listRes.ok) {
          console.error("ERRO ao acessar calendário:", JSON.stringify(listData));
          return new Response(JSON.stringify({
            success: false,
            error: "Calendar access failed",
            status: listRes.status,
            details: listData.error?.message || JSON.stringify(listData),
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Calendário acessível! Eventos encontrados:", listData.items?.length ?? 0);
        return new Response(JSON.stringify({
          success: true,
          message: "Service Account auth OK, calendar accessible",
          calendar_id: CALENDAR_ID,
          events_found: listData.items?.length ?? 0,
          events_summary: listData.items?.map((e: any) => ({ id: e.id, summary: e.summary, start: e.start })),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (testErr) {
        console.error("ERRO GOOGLE CALENDAR (test):", testErr.message, testErr.stack);
        return new Response(JSON.stringify({
          success: false,
          error: testErr.message,
          stack: testErr.stack,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Normal flow: create/delete events ──
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessToken = await getServiceAccountToken();
    console.log("Auth inicializado para operação:", action || "create");

    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("*, barbers(name), services(name, duration_minutes), profiles(full_name, email)")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appt) {
      console.error("Appointment not found:", apptError?.message);
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Appointment encontrado:", { id: appt.id, date: appt.appointment_date, time: appt.appointment_time, status: appt.status });

    const calAction = action || "create";
    const calendarId = encodeURIComponent(CALENDAR_ID);

    // DELETE event
    if (calAction === "delete" && appt.google_event_id && !appt.google_event_id.startsWith("pending_")) {
      console.log("Deletando evento:", appt.google_event_id);
      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${appt.google_event_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );

      console.log("Delete status:", deleteRes.status);
      const deleteBody = await deleteRes.text();

      if (deleteRes.ok || deleteRes.status === 404) {
        await supabaseAdmin.from("appointments").update({ google_event_id: null }).eq("id", appointment_id);
        console.log("Evento deletado e google_event_id limpo");
        return new Response(JSON.stringify({ success: true, message: "Event deleted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("Delete event error:", deleteBody);
      return new Response(JSON.stringify({ error: "Failed to delete event", details: deleteBody }), {
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

    console.log("Criando evento:", JSON.stringify(event, null, 2));

    const createRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }
    );

    const createBody = await createRes.text();
    console.log("Create event status:", createRes.status);

    if (!createRes.ok) {
      console.error("Create event error:", createBody);
      return new Response(JSON.stringify({ error: "Failed to create event", details: createBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdEvent = JSON.parse(createBody);
    console.log("Evento criado com sucesso, google_event_id:", createdEvent.id);

    await supabaseAdmin.from("appointments").update({
      google_event_id: createdEvent.id,
    }).eq("id", appointment_id);

    console.log("google_event_id salvo no banco");

    return new Response(JSON.stringify({
      success: true,
      message: "Event created",
      google_event_id: createdEvent.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ERRO GOOGLE CALENDAR:", error.message, error.stack);
    return new Response(JSON.stringify({
      error: error.message || "Internal error",
      stack: error.stack,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
