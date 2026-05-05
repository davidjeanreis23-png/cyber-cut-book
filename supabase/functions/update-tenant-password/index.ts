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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autorização");

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: any) => r.role === "master")) {
      throw new Error("Apenas master pode alterar senha");
    }

    const { tenant_id, new_password } = await req.json();
    if (!tenant_id || !new_password) throw new Error("tenant_id e new_password são obrigatórios");
    if (String(new_password).length < 6) throw new Error("Senha deve ter ao menos 6 caracteres");

    // Find admin user(s) for this tenant
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, email")
      .eq("tenant_id", tenant_id);
    if (pErr) throw pErr;
    if (!profiles || profiles.length === 0) throw new Error("Nenhum usuário vinculado a esta barbearia");

    // Filter to those with role=admin
    const ids = profiles.map((p: any) => p.id);
    const { data: adminRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .in("user_id", ids)
      .eq("role", "admin");
    const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));
    const targets = profiles.filter((p: any) => adminIds.has(p.id));
    if (targets.length === 0) throw new Error("Nenhum admin vinculado a esta barbearia");

    const updated: string[] = [];
    for (const t of targets) {
      const { error } = await admin.auth.admin.updateUserById(t.id, { password: new_password });
      if (error) throw error;
      updated.push(t.email);
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("update-tenant-password error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
