import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Scissors, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPPORT_WHATSAPP = "5524992241560";

const Blocked = () => {
  const { user, tenant, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!tenant) {
      toast.error("Sem informações da barbearia");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-subscription", {
        body: { tenant_id: tenant.id },
      });
      if (error) throw error;
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error("Não foi possível gerar o link de pagamento");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar assinatura");
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    `Olá! Preciso de ajuda com minha conta AutoBarber (${tenant?.name || user?.email || ""}).`
  )}`;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      <div className="relative z-10 max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-5 rounded-full glass border-neon animate-glow-pulse">
            <Scissors className="h-12 w-12 text-primary" />
          </div>
        </div>

        <div>
          <h1 className="font-display text-4xl tracking-wider text-neon">AUTOBARBER</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-1">
            Acesso suspenso
          </p>
        </div>

        <div className="glass border-neon rounded-xl p-6 space-y-4">
          <h2 className="font-display text-2xl text-foreground">
            Seu período de teste encerrou ou sua assinatura está suspensa.
          </h2>
          <p className="text-muted-foreground">
            Assine o plano <span className="text-primary font-semibold">PRO</span> por apenas{" "}
            <span className="text-primary font-bold">R$ 39/mês</span> e continue usando o
            AutoBarber sem limites.
          </p>

          <Button
            variant="neon"
            size="lg"
            className="w-full text-base animate-glow-pulse"
            onClick={handleSubscribe}
            disabled={loading}
          >
            <Sparkles className="h-5 w-5" />
            {loading ? "Gerando link..." : "ASSINAR AGORA — R$ 39/mês"}
          </Button>

          <Button variant="neon-outline" size="lg" asChild className="w-full">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" />
              Falar com suporte
            </a>
          </Button>
        </div>

        <button
          onClick={() => signOut()}
          className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
};

export default Blocked;
