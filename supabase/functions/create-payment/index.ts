import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { appointment_id, service_name, price, payer_email, payment_method } = await req.json();
    if (!appointment_id || !service_name || !price || !payer_email) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Mercado Pago não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force a single payment type when the user picked one in the app
    // Mercado Pago payment_type_id reference: "credit_card", "debit_card", "ticket" (boleto), "bank_transfer" (Pix), "atm"
    const ALL_TYPES = ["credit_card", "debit_card", "ticket", "atm", "bank_transfer"];
    let excluded_payment_types: { id: string }[] = [];
    if (payment_method === "pix") {
      excluded_payment_types = ALL_TYPES.filter((t) => t !== "bank_transfer").map((id) => ({ id }));
    } else if (payment_method === "card") {
      excluded_payment_types = ALL_TYPES.filter((t) => t !== "credit_card" && t !== "debit_card").map((id) => ({ id }));
    }

    const preference = {
      items: [
        {
          title: `AutoBarber - ${service_name}`,
          quantity: 1,
          unit_price: Number(price),
          currency_id: "BRL",
        },
      ],
      payer: { email: payer_email },
      external_reference: appointment_id,
      back_urls: {
        success: "https://cyber-cut-book.lovable.app/appointments?payment=success",
        failure: "https://cyber-cut-book.lovable.app/appointments?payment=failure",
        pending: "https://cyber-cut-book.lovable.app/appointments?payment=pending",
      },
      auto_return: "approved",
      payment_methods: {
        excluded_payment_types,
        installments: 1,
      },
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MercadoPago error:", mpData);
      return new Response(JSON.stringify({ error: "Erro ao criar pagamento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update appointment with payment ref
    await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    ).from("appointments").update({
      payment_ref: mpData.id,
    }).eq("id", appointment_id);

    // Use production init_point by default. sandbox_init_point only kicks in
    // automatically when the access token is a TEST-... credential.
    const isSandboxToken = ACCESS_TOKEN.startsWith("TEST-");
    return new Response(JSON.stringify({
      init_point: isSandboxToken ? (mpData.sandbox_init_point || mpData.init_point) : (mpData.init_point || mpData.sandbox_init_point),
      preference_id: mpData.id,
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
