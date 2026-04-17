import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "onboarding@resend.dev";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Resend não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, appointment } = await req.json();
    if (!to || !appointment) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6c2bd9, #9333ea); padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 4px; color: #fff;">✂️ AUTOBARBER</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #a78bfa; margin-top: 0;">${subject || "Confirmação de Agendamento"}</h2>
          <div style="background: #16162a; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Barbeiro:</strong> ${appointment.barber_name}</p>
            <p style="margin: 8px 0;"><strong>Serviço:</strong> ${appointment.service_name}</p>
            <p style="margin: 8px 0;"><strong>Data:</strong> ${appointment.date}</p>
            <p style="margin: 8px 0;"><strong>Horário:</strong> ${appointment.time}</p>
            <p style="margin: 8px 0;"><strong>Valor:</strong> R$ ${Number(appointment.price).toFixed(2)}</p>
          </div>
          <p style="color: #a0a0a0; font-size: 14px;">Obrigado por agendar conosco! Caso precise cancelar ou alterar, acesse nosso site.</p>
        </div>
        <div style="background: #16162a; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          AutoBarber © ${new Date().getFullYear()} • Todos os direitos reservados
        </div>
      </div>
    `;

    // Use Resend API directly (gateway requires connector setup)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `AutoBarber <${EMAIL_FROM}>`,
        to: [to],
        subject: subject || "Confirmação de Agendamento - AutoBarber",
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Email send error:", data);
      return new Response(JSON.stringify({ error: "Erro ao enviar e-mail", details: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
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
