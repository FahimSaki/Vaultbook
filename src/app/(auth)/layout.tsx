import { notFound } from "next/navigation";
import { isPortable } from "@/server/config";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isPortable) notFound(); // setup/unlock/recover exist only in the portable edition
  return <main className="mx-auto w-full max-w-sm p-6 pt-24">{children}</main>;
}
