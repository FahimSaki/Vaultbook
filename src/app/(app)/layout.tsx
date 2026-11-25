import Link from "next/link";

import { getCtx } from "@/server/auth/ctx";
import { isPortable } from "@/server/config";
import { IdleLock } from "@/components/Idlelock";
import { Button } from "@/components/ui/button";
import { lockAction } from "@/app/(auth)/actions";

const SOURCE_URL = "https://github.com/FahimSaki/Vaultbook";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCtx(); // redirects to /unlock, /setup or /login if not authenticated
  const demo = process.env.DEMO === "1";

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      {demo ? (
        <p className="mb-4 rounded-lg bg-muted p-2 text-center text-xs">
          Demo with fake data, reset daily. For a real shop, self-host or use
          the portable edition.
        </p>
      ) : null}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/products" className="font-semibold">
            Vaultbook
          </Link>

          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/products">Products</Link>
            <Link href="/buylist">Buy list</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/import">Import / export</Link>
            {!isPortable && ctx.role === "owner" ? (
              <Link href="/team">Team</Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isPortable ? <IdleLock /> : null}

          {isPortable ? (
            <Link href="/settings" className="text-sm underline">
              Settings
            </Link>
          ) : null}

          <form action={lockAction}>
            <Button type="submit" variant="outline" size="sm">
              {isPortable ? "Lock" : "Sign out"}
            </Button>
          </form>
        </div>
      </header>

      {children}

      <footer className="mt-12 border-t pt-4 text-xs text-muted-foreground">
        Powered by{" "}
        <a
          className="underline"
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          Vaultbook
        </a>
        , open source under AGPL-3.0. Source code at the link.
      </footer>
    </div>
  );
}
