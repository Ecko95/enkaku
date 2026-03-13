"use client";

import { useState, useCallback } from "react";

function getInitialPermission(): NotificationPermission {
  if (typeof Notification !== "undefined") {
    return Notification.permission;
  }
  return "default";
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") {
      setPermission(Notification.permission);
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      if (!document.hidden) return;
      try {
        new Notification(title, { icon: "/icon-192.png", ...options });
      } catch {
        // notification failed silently
      }
    },
    [],
  );

  return { permission, requestPermission, notify };
}
