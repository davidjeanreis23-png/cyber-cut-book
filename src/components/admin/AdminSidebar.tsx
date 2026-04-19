import { Scissors, LayoutDashboard, Calendar, Users, UserCircle, DollarSign, FileBarChart, Award, Bell, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type AdminSection =
  | "stats"
  | "appointments"
  | "barbers"
  | "services"
  | "clients"
  | "financial"
  | "reports"
  | "loyalty"
  | "notifications"
  | "settings";

const items: { value: AdminSection; label: string; icon: any }[] = [
  { value: "stats", label: "Dashboard", icon: LayoutDashboard },
  { value: "appointments", label: "Agendamentos", icon: Calendar },
  { value: "barbers", label: "Barbeiros", icon: Scissors },
  { value: "services", label: "Serviços", icon: Users },
  { value: "clients", label: "Clientes", icon: UserCircle },
  { value: "financial", label: "Financeiro", icon: DollarSign },
  { value: "reports", label: "Relatórios", icon: FileBarChart },
  { value: "loyalty", label: "Fidelidade", icon: Award },
  { value: "notifications", label: "Notificações", icon: Bell },
  { value: "settings", label: "Configurações", icon: Settings },
];

interface AdminSidebarProps {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
}

const AdminSidebar = ({ active, onChange }: AdminSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-primary/30 bg-sidebar"
    >
      <SidebarHeader className="border-b border-primary/20 py-4">
        <div className="flex items-center gap-2 px-2">
          <Scissors className="h-6 w-6 text-primary animate-glow-pulse shrink-0" />
          {!collapsed && (
            <span className="font-display text-lg tracking-wider text-neon truncate">
              AUTOBARBER
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = active === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      asChild
                      tooltip={collapsed ? item.label : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => onChange(item.value)}
                        className={cn(
                          "relative w-full flex items-center gap-2 transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary font-semibold"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary"
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary"
                            style={{ boxShadow: "0 0 8px hsl(var(--primary))" }}
                          />
                        )}
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;
