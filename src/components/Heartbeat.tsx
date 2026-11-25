"use client";
import { useEffect, useState } from "react";

export function Heartbeat() {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch("/api/heartbeat?ping=1", { cache: "no-store" });
        setErr(
          ((await r.json()) as { saveError?: string | null }).saveError ?? null,
        );
      } catch {}
    };
    void ping();
    const t = setInterval(ping, 15_000);
    return () => clearInterval(t);
  }, []);
  return err ? (
    <div className="bg-destructive px-4 py-2 text-center text-sm text-white">
      Not saved. Check the USB stick is connected. Retrying…
    </div>
  ) : null;
}
