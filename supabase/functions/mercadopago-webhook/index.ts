import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Mercado Pago webhook -> marks appointment as paid and creates a "Pagamento confirmado" notification.
 * The notification trigger then dispatches a push automatically.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response("Missing MP token", { status: 500, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    // MP sends: { type: 'payment', data: { id: '...' } }
    const paymentId = body?.data?.id || new URL(req.url).searchParams.get("id");
    const topic = body?.type || body?.topic || new URL(req.url).searchParams.get("topic");

    if (!paymentId || (topic && topic !== "payment")) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment details
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!mpResp.ok) {
      console.error("[mp-webhook] failed to fetch payment", await mpResp.text());
      return new Response("ok", { headers: corsHeaders });
    }
    const payment = await mpResp.json();

    const appointmentId = payment?.external_reference;
    const status = payment?.status; // approved | pending | rejected | refunded
    const amount = payment?.transaction_amount || 0;

    if (!appointmentId) {
      return new Response(JSON.stringify({ ok: true, no_ref: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (status === "approved") {
      const { data: appt } = await supabase
        .from("appointments")
        .select("id, user_id, payment_status")
        .eq("id", appointmentId)
        .maybeSingle();

      if (appt && appt.payment_status !== "paid") {
        await supabase
          .from("appointments")
          .update({ payment_status: "paid", status: "confirmed" })
          .eq("id", appointmentId);

        await supabase.from("notifications").insert({
          user_id: appt.user_id,
          title: "💰 Pagamento confirmado!",
          message: `Pagamento de R$ ${Number(amount).toFixed(2)} recebido. Seu agendamento está garantido.`,
          type: "success",
          appointment_id: appointmentId,
        });
      }
    } else if (status === "refunded" || status === "cancelled") {
      await supabase
        .from("appointments")
        .update({ payment_status: "refunded" })
        .eq("id", appointmentId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[mp-webhook] error", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
