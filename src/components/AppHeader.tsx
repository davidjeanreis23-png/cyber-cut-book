import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Scissors, LogOut, Shield, Calendar } from "lucide-react";

const AppHeader = () => {
  const { user, isAdmin, profile, signOut } = useAuth();
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
          <span className="font-display text-xl tracking-widest text-neon">
            AUTOBARBER
          </span>
        </Link>

        <nav className="flex items-center gap-3">
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
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {profile?.full_name || user.email}
                </span>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <Button variant="neon" size="sm" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default AppHeader;
