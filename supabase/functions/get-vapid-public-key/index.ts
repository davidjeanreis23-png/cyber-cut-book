import { corsHeaders } from "../_shared/cors.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "Web Push não configurado" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 503,
    });
  }
  return new Response(JSON.stringify({ publicKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
