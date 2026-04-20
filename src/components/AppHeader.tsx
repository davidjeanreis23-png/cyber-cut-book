import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Scissors, LogOut, Shield, Calendar, Crown } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationsBell from "@/components/NotificationsBell";

const AppHeader = () => {
  const { user, isAdmin, isMaster, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-40 glass border-b border-neon">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <Scissors className="h-7 w-7 text-primary animate-glow-pulse" />
          <span className="font-display text-2xl tracking-wider text-neon">
            AUTOBARBER
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/appointments" className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Agendamentos</span>
                </Link>
              </Button>
              {isAdmin && (
                <Button variant="neon-outline" size="sm" asChild>
                  <Link to="/admin" className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              )}
              {isMaster && (
                <Button variant="neon" size="sm" asChild>
                  <Link to="/master" className="flex items-center gap-1.5">
                    <Crown className="h-4 w-4" />
                    <span className="hidden sm:inline">Master</span>
                  </Link>
                </Button>
              )}
              <NotificationsBell />
              <ThemeToggle />
              <div className="flex items-center gap-1 ml-1">
                <span className="text-sm text-muted-foreground hidden md:inline">
                  {profile?.full_name || user.email}
                </span>
                <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button variant="neon" size="sm" asChild>
                <Link to="/auth">Entrar</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default AppHeader;
