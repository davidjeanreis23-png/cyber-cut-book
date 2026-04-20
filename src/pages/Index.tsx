import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Scissors, Calendar, CreditCard, Users } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import FloatingParticles from "@/components/FloatingParticles";
import GlassCard from "@/components/GlassCard";
import MapButton from "@/components/MapButton";
import MapEmbed from "@/components/MapEmbed";
import SEO from "@/components/SEO";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Barber {
  id: string;
  name: string;
  photo_url: string | null;
  specialties: string[] | null;
  bio: string | null;
}

const Index = () => {
  const { user } = useAuth();
  const [barbers, setBarbers] = useState<Barber[]>([]);

  useEffect(() => {
    const fetchBarbers = async () => {
      const { data } = await supabase.from("barbers").select("*").eq("is_active", true);
      if (data) setBarbers(data);
    };
    if (user) fetchBarbers();
  }, [user]);

  return (
    <div className="min-h-screen">
      <SEO
        title="AutoBarber — Agendamento online para barbearias"
        description="Agende seu corte na AutoBarber: barbeiros qualificados, horários em tempo real e pagamento facilitado. O futuro do estilo começa aqui."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "HairSalon",
          name: "AutoBarber",
          description: "Sistema de agendamento para barbearias",
          url: "https://cyber-cut-book.lovable.app",
          image:
            "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3c4dd637-99f8-4ecf-ace6-29bda94c51be/id-preview-437ad10c--eafe43fb-1114-4fcf-a6f6-0380afebd518.lovable.app-1775869070807.png",
          priceRange: "$$",
          openingHours: "Mo-Sa 08:00-20:00",
        }}
      />
      <AppHeader />

      {/* Hero */}
      <main>
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden" aria-label="Hero">
        <FloatingParticles />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <Scissors className="h-16 w-16 text-primary animate-glow-pulse" />
          </div>
          <h1 className="font-display text-4xl md:text-6xl tracking-wider text-neon mb-4 animate-slide-up">
            O FUTURO DO ESTILO<br />COMEÇA AQUI
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl mb-8 animate-fade-in font-body">
            Agendamento inteligente para a barbearia do futuro
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <Button variant="neon" size="lg" asChild className="animate-glow-pulse text-lg px-8 py-6">
              <Link to={user ? "/booking" : "/auth"}>AGENDAR AGORA</Link>
            </Button>
            {user && (
              <Button variant="neon-outline" size="lg" asChild className="text-lg px-8 py-6">
                <Link to="/appointments">MEUS AGENDAMENTOS</Link>
              </Button>
            )}
          </div>
          <div className="flex justify-center mt-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <MapButton variant="neon-outline" size="lg" label="Ver no mapa" className="text-base px-6 py-5" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
          {[
            { icon: Users, title: "Profissionais Qualificados", desc: "Barbeiros especializados prontos para transformar seu visual" },
            { icon: Calendar, title: "Agendamento Inteligente", desc: "Escolha o horário perfeito com nosso sistema em tempo real" },
            { icon: CreditCard, title: "Pagamento Facilitado", desc: "Pague online ou presencialmente, você escolhe" },
          ].map((f, i) => (
            <GlassCard key={i} className="text-center" >
              <div style={{ animationDelay: `${i * 0.2}s` }}>
                <f.icon className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="font-display text-sm tracking-wider mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Barbers */}
      {barbers.length > 0 && (
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <h2 className="font-display text-2xl text-center tracking-wider text-neon mb-10">NOSSOS BARBEIROS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {barbers.map((b) => (
                <GlassCard key={b.id} className="text-center">
                  {b.photo_url ? (
                    <img src={b.photo_url} alt={b.name} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-2 border-neon" loading="lazy" />
                  ) : (
                    <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-muted flex items-center justify-center border-2 border-neon">
                      <Scissors className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <h3 className="font-display text-sm tracking-wider mb-1">{b.name}</h3>
                  {b.specialties && (
                    <p className="text-xs text-muted-foreground mb-3">{b.specialties.join(" • ")}</p>
                  )}
                  <Button variant="neon-outline" size="sm" asChild>
                    <Link to={`/booking?barber=${b.id}`}>Agendar</Link>
                  </Button>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Localização */}
      <MapEmbed />
      </main>

      {/* Footer */}
      <footer className="border-t border-neon py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground text-sm">
          <p className="font-display tracking-wider mb-2">AUTOBARBER</p>
          <p>Horário: 08:00 – 20:00 • Segunda a Sábado</p>
          <p className="mt-3">© {new Date().getFullYear()} AutoBarber. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
