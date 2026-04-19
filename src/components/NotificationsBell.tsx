import { useEffect, useState } from "react";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

const typeIcon = (type: string) => {
  switch (type) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

const NotificationsBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter((n) => !n.read).length;

  const fetchItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,message,type,read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data || []);
  };

  useEffect(() => {
    if (!user) return;
    fetchItems();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-display flex items-center justify-center border border-background"
              style={{ boxShadow: "0 0 8px hsl(var(--primary))" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] sm:w-[380px] p-0 bg-card border-primary/30"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-display text-sm tracking-wider text-neon">NOTIFICAÇÕES</p>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[60vh]">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "px-4 py-3 flex gap-3 cursor-pointer hover:bg-muted/40 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <div className="pt-0.5">{typeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-body", !n.read ? "font-semibold text-foreground" : "text-foreground/80")}>
                        {n.title}
                      </p>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" style={{ boxShadow: "0 0 6px hsl(var(--primary))" }} />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
