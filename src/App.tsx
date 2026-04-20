import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Booking from "./pages/Booking";
import Appointments from "./pages/Appointments";
import Loyalty from "./pages/Loyalty";
import Admin from "./pages/Admin";
import Master from "./pages/Master";
import Blocked from "./pages/Blocked";
import GoogleCalendarCallback from "./pages/GoogleCalendarCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const isTenantBlocked = (tenant: any) => {
  if (!tenant) return false;
  if (tenant.status === "blocked" || tenant.status === "cancelled") return true;
  if (tenant.status === "trial" && new Date(tenant.trial_end) < new Date()) return true;
  return false;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, tenant, isMaster } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isMaster && isTenantBlocked(tenant)) return <Navigate to="/blocked" replace />;
  return <>{children}</>;
};

import { useWebPush } from "@/hooks/useWebPush";

const PushBootstrap = () => {
  useWebPush();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PushBootstrap />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Index />} />
            <Route path="/blocked" element={<Blocked />} />
            <Route path="/booking" element={<ProtectedRoute><Booking /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/loyalty" element={<ProtectedRoute><Loyalty /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/master" element={<ProtectedRoute><Master /></ProtectedRoute>} />
            <Route path="/auth/google/callback" element={<ProtectedRoute><GoogleCalendarCallback /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
