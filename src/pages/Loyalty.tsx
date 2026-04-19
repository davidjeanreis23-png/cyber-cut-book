import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";

import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Award, TrendingUp, TrendingDown, Scissors, Gift } from "lucide-react";

interface Reward { id: string; name: string; description: string | null; points_needed: number; }
interface Transaction { id: string; points: number; description: string; created_at: string; }

const Loyalty = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [cutsCount, setCutsCount] = useState(0);
  const [rewardAvailable, setRewardAvailable] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchData = async () => {
    if (!user) return;
    const [p, r, t] = await Promise.all([
      supabase.from("loyalty_points").select("points,cuts_count,reward_available").eq("user_id", user.id).maybeSingle(),
      supabase.from("loyalty_rewards").select("*").eq("is_active", true).order("points_needed"),
      supabase.from("loyalty_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (p.data) {
      setPoints(p.data.points);
      setCutsCount(p.data.cuts_count || 0);
      setRewardAvailable(!!p.data.reward_available);
    }
    if (r.data) setRewards(r.data);
    if (t.data) setTransactions(t.data);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleRedeem = async (reward: Reward) => {
    if (points < reward.points_needed) { toast.error("Pontos insuficientes"); return; }
    toast.info("Solicitação de resgate enviada ao administrador!");
  };

  const remaining = Math.max(0, 10 - cutsCount);
  const progressPct = Math.min(100, (cutsCount / 10) * 100);

  return (
    <div className="min-h-screen">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-display text-2xl text-center tracking-wider text-neon mb-8">FIDELIDADE</h1>

        {/* Cuts progress card */}
        <GlassCard className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              <h2 className="font-display text-sm tracking-wider">PROGRAMA 10 CORTES</h2>
            </div>
            <span className="font-display text-lg text-neon">{cutsCount}/10</span>
          </div>

          <Progress value={progressPct} className="h-3 mb-3" />

          {rewardAvailable ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/40">
              <Gift className="h-6 w-6 text-primary animate-glow-pulse shrink-0" />
              <div>
                <p className="font-display text-sm text-neon">CORTE GRÁTIS DISPONÍVEL!</p>
                <p className="text-xs text-muted-foreground">Apresente esta tela ao barbeiro no próximo agendamento.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              {remaining === 10
                ? "Comece sua jornada — a cada 10 cortes, ganhe 1 grátis 🎉"
                : `Faltam ${remaining} ${remaining === 1 ? "corte" : "cortes"} para ganhar 1 corte grátis`}
            </p>
          )}
        </GlassCard>

        {/* Points card */}
        <GlassCard className="text-center mb-8">
          <Award className="h-10 w-10 text-primary mx-auto mb-2" />
          <p className="font-display text-3xl text-neon">{points}</p>
          <p className="text-sm text-muted-foreground">pontos acumulados</p>
        </GlassCard>

        {rewards.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display text-lg tracking-wider mb-4">RECOMPENSAS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rewards.map(r => (
                <GlassCard key={r.id} animate={false}>
                  <p className="font-display text-sm tracking-wider mb-1">{r.name}</p>
                  {r.description && <p className="text-xs text-muted-foreground mb-2">{r.description}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">{r.points_needed} pts</span>
                    <Button variant="neon" size="sm" disabled={points < r.points_needed} onClick={() => handleRedeem(r)}>
                      Resgatar
                    </Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-lg tracking-wider mb-4">HISTÓRICO</h2>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma transação ainda</p>
          ) : (
            <div className="space-y-3">
              {transactions.map(t => (
                <GlassCard key={t.id} animate={false} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {t.points > 0 ? <TrendingUp className="h-4 w-4 text-accent" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                    <div>
                      <p className="text-sm">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  <span className={t.points > 0 ? "text-accent font-display text-sm" : "text-destructive font-display text-sm"}>
                    {t.points > 0 ? "+" : ""}{t.points}
                  </span>
                </GlassCard>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Loyalty;
