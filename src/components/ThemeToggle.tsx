import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

const ThemeToggle = () => {
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

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-card border border-neon flex items-center justify-center shadow-elevated hover:shadow-glow-strong transition-all duration-300"
      aria-label="Alternar tema"
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-primary" />
      ) : (
        <Moon className="h-5 w-5 text-primary" />
      )}
    </button>
  );
};

export default ThemeToggle;
