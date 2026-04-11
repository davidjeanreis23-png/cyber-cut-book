import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import GlassCard from "@/components/GlassCard";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const GoogleCalendarCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(`Autorização negada: ${error}`);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("Código de autorização não encontrado");
      return;
    }

    const exchangeCode = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("google-calendar-auth", {
          body: {
            action: "exchange_code",
            code,
            redirect_uri: `${window.location.origin}/auth/google/callback`,
          },
        });

        if (fnError || data?.error) {
          setStatus("error");
          setMessage(data?.error || fnError?.message || "Erro ao conectar");
          return;
        }

        setStatus("success");
        setMessage("Google Calendar conectado com sucesso!");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Erro inesperado");
      }
    };

    exchangeCode();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <p className="font-display tracking-wider">CONECTANDO GOOGLE CALENDAR...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-display tracking-wider text-green-400 mb-4">{message}</p>
            <Button variant="neon" onClick={() => navigate("/admin")}>VOLTAR AO PAINEL</Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="font-display tracking-wider text-red-400 mb-4">{message}</p>
            <Button variant="neon" onClick={() => navigate("/admin")}>VOLTAR AO PAINEL</Button>
          </>
        )}
      </GlassCard>
    </div>
  );
};

export default GoogleCalendarCallback;
