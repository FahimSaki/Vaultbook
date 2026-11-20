import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isPortable } from "../config";

export async function assertLocalHost() {
  if (!isPortable) return;
  const host = ((await headers()).get("host") ?? "").split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost") notFound();
}

export function hostBlocked(req: Request): Response | null {
  if (!isPortable) return null;
  const host = (req.headers.get("host") ?? "").split(":")[0];
  return host === "127.0.0.1" || host === "localhost"
    ? null
    : new Response("Not found", { status: 404 });
}
