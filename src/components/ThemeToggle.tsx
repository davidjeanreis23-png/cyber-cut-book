import { Sun, Moon } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Quando true (legado), renderiza fixo no canto. Padrão: false (inline no header). */
  floating?: boolean;
  className?: string;
}

const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ floating = false, className }, ref) => {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
      const saved = localStorage.getItem("autobarber-mode");
      if (saved === "light") {
        setIsDark(false);
        document.documentElement.classList.add("light");
      }
    }, []);

    const toggle = () => {
      const next = !isDark;
      setIsDark(next);
      if (next) {
        document.documentElement.classList.remove("light");
        localStorage.setItem("autobarber-mode", "dark");
      } else {
        document.documentElement.classList.add("light");
        localStorage.setItem("autobarber-mode", "light");
      }
    };

    if (floating) {
      return (
        <button
          ref={ref}
          onClick={toggle}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-card border border-neon flex items-center justify-center shadow-elevated hover:shadow-glow-strong transition-all duration-300"
          aria-label="Alternar tema"
        >
          {isDark ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-primary" />}
        </button>
      );
    }

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label="Alternar tema"
        className={cn(className)}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    );
  }
);
ThemeToggle.displayName = "ThemeToggle";

export default ThemeToggle;
