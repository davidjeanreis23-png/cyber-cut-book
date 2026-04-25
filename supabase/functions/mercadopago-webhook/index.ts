import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Mercado Pago webhook
 * Handles two flows:
 *  1) `payment` events tied to an `appointment_id` (external_reference) -> mark appointment as paid
 *  2) `preapproval` events (SaaS monthly subscription) -> activate/block tenant + extend paid_until
 *  3) `authorized_payment` events (recurring monthly charge of a preapproval) -> renew tenant +30d
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response("Missing MP token", { status: 500, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as any));

    // MP can send payload in many shapes. Normalize:
    const topic =
      body?.type ||
      body?.topic ||
      url.searchParams.get("type") ||
      url.searchParams.get("topic");
    const resourceId =
      body?.data?.id ||
      body?.resource ||
      url.searchParams.get("id") ||
      url.searchParams.get("data.id");

    console.log("[mp-webhook] topic:", topic, "id:", resourceId);

    if (!topic || !resourceId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no topic/id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ──────────────────────────────────────────────
    // 1) PREAPPROVAL (subscription created/updated/cancelled)
    // ──────────────────────────────────────────────
    if (topic === "preapproval" || topic === "subscription_preapproval") {
      const mpResp = await fetch(
        `https://api.mercadopago.com/preapproval/${resourceId}`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      if (!mpResp.ok) {
        console.error("[mp-webhook] preapproval fetch failed", await mpResp.text());
        return new Response("ok", { headers: corsHeaders });
      }
      const pre = await mpResp.json();
      const tenantId = pre?.external_reference;
      const status = pre?.status; // authorized | paused | cancelled | pending

      if (!tenantId) {
        return new Response(JSON.stringify({ ok: true, no_tenant_ref: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let tenantStatus: "active" | "blocked" | "cancelled" | "trial" | null = null;
      let paidUntil: string | null = null;

      if (status === "authorized") {
        tenantStatus = "active";
        paidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (status === "paused") {
        tenantStatus = "blocked";
      } else if (status === "cancelled") {
        tenantStatus = "cancelled";
      }

      const update: Record<string, unknown> = { subscription_id: pre.id };
      if (tenantStatus) update.status = tenantStatus;
      if (paidUntil) update.paid_until = paidUntil;

      const { error: upErr } = await supabase
        .from("tenants")
        .update(update)
        .eq("id", tenantId);
      if (upErr) console.error("[mp-webhook] tenant update error", upErr);

      return new Response(JSON.stringify({ ok: true, kind: "preapproval", status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────
    // 2) AUTHORIZED_PAYMENT (recurring monthly charge inside a preapproval)
    // ──────────────────────────────────────────────
    if (topic === "authorized_payment" || topic === "subscription_authorized_payment") {
      const apResp = await fetch(
        `https://api.mercadopago.com/authorized_payments/${resourceId}`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      if (!apResp.ok) {
        console.error("[mp-webhook] auth_payment fetch failed", await apResp.text());
        return new Response("ok", { headers: corsHeaders });
      }
      const ap = await apResp.json();
      const status = ap?.status; // approved | rejected | pending
      const preapprovalId = ap?.preapproval_id;
      if (status === "approved" && preapprovalId) {
        const paidUntil = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();
        await supabase
          .from("tenants")
          .update({ status: "active", paid_until: paidUntil })
          .eq("subscription_id", preapprovalId);
      }
      return new Response(JSON.stringify({ ok: true, kind: "authorized_payment", status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────
    // 3) PAYMENT (one-off appointment payment via Checkout Pro)
    // ──────────────────────────────────────────────
    if (topic === "payment") {
      const mpResp = await fetch(
        `https://api.mercadopago.com/v1/payments/${resourceId}`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      if (!mpResp.ok) {
        console.error("[mp-webhook] payment fetch failed", await mpResp.text());
        return new Response("ok", { headers: corsHeaders });
      }
      const payment = await mpResp.json();

      const externalRef = payment?.external_reference as string | undefined;
      const status = payment?.status;
      const amount = payment?.transaction_amount || 0;

      // If external_reference looks like a tenant id (subscription one-off), handle accordingly.
      // Otherwise treat as appointment.
      if (!externalRef) {
        return new Response(JSON.stringify({ ok: true, no_ref: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try as appointment first
      const { data: appt } = await supabase
        .from("appointments")
        .select("id, user_id, payment_status")
        .eq("id", externalRef)
        .maybeSingle();

      if (appt) {
        if (status === "approved" && appt.payment_status !== "paid") {
          await supabase
            .from("appointments")
            .update({ payment_status: "paid", status: "confirmed" })
            .eq("id", externalRef);

          await supabase.from("notifications").insert({
            user_id: appt.user_id,
            title: "💰 Pagamento confirmado!",
            message: `Pagamento de R$ ${Number(amount).toFixed(2)} recebido. Seu agendamento está garantido.`,
            type: "success",
            appointment_id: externalRef,
          });
        } else if (status === "refunded" || status === "cancelled") {
          await supabase
            .from("appointments")
            .update({ payment_status: "refunded" })
            .eq("id", externalRef);
        }
      }

      return new Response(JSON.stringify({ ok: true, kind: "payment", status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, ignored_topic: topic }), {
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
