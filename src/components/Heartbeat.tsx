"use client";
import { useEffect } from "react";

export function Heartbeat() {
  useEffect(() => {
    const ping = () =>
      fetch("/api/heartbeat?ping=1", { cache: "no-store" }).catch(() => {});
    ping();
    const t = setInterval(ping, 15_000);
    return () => clearInterval(t);
  }, []);
  return null;
}
