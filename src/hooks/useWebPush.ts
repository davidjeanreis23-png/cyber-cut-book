import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export const useWebPush = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");

        // Ask permission (only if not yet decided)
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }
        if (Notification.permission !== "granted") return;

        // Reuse existing subscription before fetching the VAPID key
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          // Cache VAPID key in sessionStorage to avoid repeated edge function calls
          let publicKey = sessionStorage.getItem("vapid_pk");
          if (!publicKey) {
            const { data: keyData, error: keyError } = await supabase.functions.invoke(
              "get-vapid-public-key"
            );
            if (keyError || !keyData?.publicKey) {
              console.warn("[push] Failed to fetch VAPID public key", keyError);
              return;
            }
            publicKey = keyData.publicKey as string;
            sessionStorage.setItem("vapid_pk", publicKey);
          }

          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        if (cancelled) return;

        // Save subscription on profile
        const token = JSON.stringify(sub.toJSON());
        await supabase
          .from("profiles")
          .update({ push_token: token })
          .eq("id", user.id);
      } catch (e) {
        console.warn("[push] subscribe failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
};
