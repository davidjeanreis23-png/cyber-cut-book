import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";

    // Verify caller is master
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const isMaster = (roles || []).some((r: any) => r.role === "master");
    if (!isMaster) throw new Error("Apenas master pode cancelar assinaturas");

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id obrigatório");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, subscription_id")
      .eq("id", tenant_id)
      .single();
    if (!tenant) throw new Error("Barbearia não encontrada");

    // Cancel at MP if subscription_id exists
    if (tenant.subscription_id) {
      const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${tenant.subscription_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_TOKEN}` },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!mpRes.ok) {
        const err = await mpRes.text();
        console.error("[cancel-subscription] MP error", err);
        // Continue anyway: still block tenant locally
      }
    }

    await admin.from("tenants").update({ status: "cancelled" }).eq("id", tenant_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("cancel-subscription error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
