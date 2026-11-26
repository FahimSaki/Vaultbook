import { notFound } from "next/navigation";
import { isPortable } from "@/server/config";

export default function HostedAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isPortable) notFound();
  return <main className="mx-auto w-full max-w-sm p-6 pt-24">{children}</main>;
}
