import { cn } from "@/lib/utils";
import { forwardRef, HTMLAttributes, ReactNode } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className, animate = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass rounded-lg p-6",
          animate && "animate-slide-up",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export default GlassCard;
