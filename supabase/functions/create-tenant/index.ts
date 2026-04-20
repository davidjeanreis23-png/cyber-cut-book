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
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autorização");

    // Verificar caller é master
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isMaster = (roles || []).some((r: any) => r.role === "master");
    if (!isMaster) throw new Error("Apenas master pode cadastrar barbearias");

    const payload = await req.json();
    const { name, owner_name, email, phone, cpf_cnpj, address, city, state } = payload;
    if (!name || !owner_name || !email) throw new Error("Campos obrigatórios faltando");

    // Cria tenant
    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .insert({ name, owner_name, email, phone, cpf_cnpj, address, city, state })
      .select()
      .single();
    if (tErr) throw tErr;

    // Cria usuário auth com senha temporária
    const tempPassword = `Auto${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 1000)}`;
    const { data: authUser, error: aErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: owner_name, phone, tenant_id: tenant.id },
    });

    if (aErr) {
      console.warn("Erro criando user (talvez já exista):", aErr.message);
    }

    const userId = authUser?.user?.id;
    if (userId) {
      // Vincula tenant_id ao profile (criado por trigger handle_new_user) e dá role admin
      await admin.from("profiles").update({ tenant_id: tenant.id }).eq("id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: "admin" });

      // Cria settings padrão para o tenant
      await admin.from("settings").insert({ tenant_id: tenant.id });
    }

    // Envia e-mail boas-vindas via Resend (best-effort)
    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AutoBarber <onboarding@resend.dev>",
            to: [email],
            subject: "Bem-vindo ao AutoBarber 🎉",
            html: `
              <h2>Olá ${owner_name}!</h2>
              <p>Sua barbearia <strong>${name}</strong> foi cadastrada no AutoBarber.</p>
              <p>Você tem 5 dias de teste grátis para experimentar tudo.</p>
              <p><strong>Acesso:</strong></p>
              <ul>
                <li>E-mail: ${email}</li>
                <li>Senha temporária: <code>${tempPassword}</code></li>
              </ul>
              <p>Acesse: <a href="https://cyber-cut-book.lovable.app/auth">https://cyber-cut-book.lovable.app/auth</a></p>
              <p>Após 5 dias, assine o plano PRO por R$ 39/mês para continuar usando.</p>
            `,
          }),
        });
      } catch (e) {
        console.warn("Resend falhou:", e);
      }
    }

    return new Response(
      JSON.stringify({ tenant, temp_password: tempPassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("create-tenant error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
