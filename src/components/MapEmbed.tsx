import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MapEmbedProps {
  address?: string | null;
  className?: string;
  height?: number;
  title?: string;
}

/**
 * Preview de mapa embutido (iframe do Google Maps) sem necessidade de API key.
 * Usa o modo "place" embed público do Google Maps.
 */
const MapEmbed = ({
  address,
  className,
  height = 320,
  title = "NOSSA LOCALIZAÇÃO",
}: MapEmbedProps) => {
  const [resolved, setResolved] = useState<string | null>(address || null);

  useEffect(() => {
    if (address) {
      setResolved(address);
      return;
    }
    supabase
      .from("settings")
      .select("barber_address")
      .limit(1)
      .single()
      .then(({ data }) => setResolved(data?.barber_address || null));
  }, [address]);

  if (!resolved) return null;

  const src = `https://www.google.com/maps?q=${encodeURIComponent(resolved)}&output=embed`;

  return (
    <section className={cn("py-16 px-4", className)}>
      <div className="container mx-auto max-w-5xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl text-center tracking-wider text-neon">
            {title}
          </h2>
        </div>
        <p className="text-center text-muted-foreground text-sm mb-6">{resolved}</p>

        <div
          className="relative rounded-xl overflow-hidden border-2 border-primary/40 shadow-[0_0_30px_hsl(var(--primary)/0.25)] bg-card"
          style={{ height }}
        >
          <iframe
            title="Mapa da barbearia"
            src={src}
            width="100%"
            height="100%"
            style={{ border: 0, filter: "grayscale(0.2) contrast(1.05)" }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
};

export default MapEmbed;
