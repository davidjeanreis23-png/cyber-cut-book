import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MapButtonProps {
  address?: string | null;
  variant?: "neon" | "neon-outline" | "ghost" | "default";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

/**
 * Botão "Ver no mapa" — abre Google Maps em nova aba.
 * Se nenhum endereço for passado, busca de settings.barber_address.
 */
const MapButton = ({
  address,
  variant = "neon-outline",
  size = "sm",
  className,
  label = "Ver no mapa",
}: MapButtonProps) => {
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

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolved)}`;

  return (
    <Button asChild variant={variant} size={size} className={cn(className)}>
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir endereço no Google Maps">
        <MapPin className="h-4 w-4" />
        <span>{label}</span>
      </a>
    </Button>
  );
};

export default MapButton;
