import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}

const GlassCard = ({ children, className, animate = true }: GlassCardProps) => {
  return (
    <div
      className={cn(
        "glass rounded-lg p-6",
        animate && "animate-slide-up",
        className
      )}
    >
      {children}
    </div>
  );
};

export default GlassCard;
