import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import GlassCard from "@/components/GlassCard";
import FloatingParticles from "@/components/FloatingParticles";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message || "Erro ao entrar");
      } else {
        toast.success("Login realizado com sucesso!");
        navigate("/");
      }
    } else {
      if (!fullName.trim()) {
        toast.error("Informe seu nome completo");
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, phone);
      if (error) {
        toast.error(error.message || "Erro ao cadastrar");
      } else {
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <FloatingParticles />
      <GlassCard className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Scissors className="h-12 w-12 text-primary animate-glow-pulse mb-3" />
          <h1 className="font-display text-2xl tracking-widest text-neon">AUTOBARBER</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLogin ? "Acesse sua conta" : "Crie sua conta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (opcional)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>

          <Button type="submit" variant="neon" className="w-full" disabled={loading}>
            {loading ? "Carregando..." : isLogin ? "ENTRAR" : "CRIAR CONTA"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {isLogin ? "Não tem conta? Criar agora" : "Já tem conta? Fazer login"}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default Auth;
