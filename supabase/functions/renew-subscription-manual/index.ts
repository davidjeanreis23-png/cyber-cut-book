import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const isMaster = (roles || []).some((r: any) => r.role === "master");
    if (!isMaster) throw new Error("Apenas master pode renovar manualmente");

    const { tenant_id, days } = await req.json();
    if (!tenant_id) throw new Error("tenant_id obrigatório");
    const ext = Number(days) || 30;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const paidUntil = new Date(Date.now() + ext * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from("tenants")
      .update({ status: "active", paid_until: paidUntil })
      .eq("id", tenant_id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, paid_until: paidUntil }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("renew-subscription-manual error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
