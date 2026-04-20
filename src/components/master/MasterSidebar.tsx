import { Crown, LayoutDashboard, Building2, CreditCard } from "lucide-react";
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

export type MasterSection = "dashboard" | "tenants" | "subscriptions";

const items: { value: MasterSection; label: string; icon: any }[] = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "tenants", label: "Barbearias", icon: Building2 },
  { value: "subscriptions", label: "Assinaturas", icon: CreditCard },
];

interface Props {
  active: MasterSection;
  onChange: (s: MasterSection) => void;
}

const MasterSidebar = ({ active, onChange }: Props) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-2 border-primary/40"
      style={{
        background: "linear-gradient(180deg, hsl(240 60% 8%) 0%, hsl(260 50% 6%) 100%)",
      }}
    >
      <SidebarHeader className="border-b-2 border-primary/40 py-4">
        <div className="flex items-center gap-2 px-2">
          <Crown className="h-6 w-6 text-primary animate-glow-pulse shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-lg tracking-wider text-neon truncate">
                MASTER
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                AutoBarber SaaS
              </span>
            </div>
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
                    <SidebarMenuButton asChild tooltip={collapsed ? item.label : undefined}>
                      <button
                        type="button"
                        onClick={() => onChange(item.value)}
                        className={cn(
                          "relative w-full flex items-center gap-2 transition-colors",
                          isActive
                            ? "bg-primary/20 text-primary font-semibold"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary"
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary"
                            style={{ boxShadow: "0 0 12px hsl(var(--primary))" }}
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

export default MasterSidebar;
