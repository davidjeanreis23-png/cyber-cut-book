import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import webpush from "npm:web-push@3.6.7";

interface SendPushBody {
  user_id?: string;
  user_ids?: string[];
  title: string;
  message: string;
  url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@autobarber.app";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const body = (await req.json()) as SendPushBody;

    if (!body.title || !body.message) {
      return new Response(JSON.stringify({ error: "title and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ids = body.user_ids || (body.user_id ? [body.user_id] : []);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "user_id or user_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, push_token")
      .in("id", ids);

    if (error) throw error;

    const payload = JSON.stringify({
      title: body.title,
      body: body.message,
      url: body.url || "/",
    });

    const results = await Promise.allSettled(
      (profiles || [])
        .filter((p) => p.push_token)
        .map(async (p) => {
          try {
            const sub = JSON.parse(p.push_token!);
            await webpush.sendNotification(sub, payload);
            return { user_id: p.id, sent: true };
          } catch (e: any) {
            // Subscription expired or invalid -> clear it
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              await supabase.from("profiles").update({ push_token: null }).eq("id", p.id);
            }
            return { user_id: p.id, sent: false, error: e?.message || String(e) };
          }
        })
    );

    const out = results.map((r) => (r.status === "fulfilled" ? r.value : { error: String(r.reason) }));

    return new Response(JSON.stringify({ results: out }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-push] error", e);
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
