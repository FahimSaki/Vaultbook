"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function IdleLock({ minutes = 15 }: { minutes?: number }) {
  const [left, setLeft] = useState(minutes * 60);
  const lastTouch = useRef(0);
  const locked = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const reset = () => {
      if (locked.current) return;

      setLeft(minutes * 60);

      if (Date.now() - lastTouch.current > 30_000) {
        lastTouch.current = Date.now();
        fetch("/api/session/touch", { method: "POST" }).catch(() => {});
      }
    };

    const events = ["pointerdown", "keydown", "scroll"];

    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          if (!locked.current) {
            locked.current = true;

            fetch("/api/lock", { method: "POST" }).finally(() => {
              router.replace("/unlock");
            });
          }

          return 0;
        }

        return s - 1;
      });
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(t);
    };
  }, [minutes, router]);

  return (
    <span className="text-xs text-muted-foreground">
      Auto-lock in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}
