import Link from "next/link";
import { getCtx } from "@/server/auth/ctx";
import { IdleLock } from "@/components/Idlelock";
import { Button } from "@/components/ui/button";
import { lockAction } from "@/app/(auth)/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getCtx(); // redirects to /unlock or /setup if not authenticated
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/products" className="font-semibold">
          Vaultbook
        </Link>
        <div className="flex items-center gap-3">
          <IdleLock />
          <Link href="/settings" className="text-sm underline">
            Settings
          </Link>
          <form action={lockAction}>
            <Button type="submit" variant="outline" size="sm">
              Lock
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
