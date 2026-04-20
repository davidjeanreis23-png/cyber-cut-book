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
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id obrigatório");

    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, email, plan_price")
      .eq("id", tenant_id)
      .single();
    if (tErr || !tenant) throw new Error("Barbearia não encontrada");

    const origin = req.headers.get("origin") || "https://cyber-cut-book.lovable.app";

    // Mercado Pago Subscription dinâmica (preapproval)
    const body = {
      reason: `AutoBarber PRO - ${tenant.name}`,
      external_reference: tenant.id,
      payer_email: tenant.email,
      back_url: `${origin}/blocked?status=success`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Number(tenant.plan_price) || 39.0,
        currency_id: "BRL",
      },
      status: "pending",
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error", mpData);
      throw new Error(`Mercado Pago: ${JSON.stringify(mpData)}`);
    }

    await supabase
      .from("tenants")
      .update({ subscription_id: mpData.id })
      .eq("id", tenant.id);

    return new Response(
      JSON.stringify({ init_point: mpData.init_point, subscription_id: mpData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("create-subscription error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
