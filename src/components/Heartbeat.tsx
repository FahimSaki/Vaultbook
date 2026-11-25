"use client";
import { useEffect, useState } from "react";

export function Heartbeat() {
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch("/api/heartbeat?ping=1", { cache: "no-store" });
        const j = (await r.json()) as { saveError?: string | null };
        setSaveError(j.saveError ?? null);
      } catch {
        /* the launcher watches for missing heartbeats, not the page */
      }
    };
    void ping();
    const t = setInterval(ping, 15_000);
    return () => clearInterval(t);
  }, []);

  return saveError ? (
    <div
      role="alert"
      className="bg-destructive px-4 py-2 text-center text-sm text-white"
    >
      Your latest changes are not saved. Check that the USB stick is connected.
      Retrying automatically…
    </div>
  ) : null;
}
