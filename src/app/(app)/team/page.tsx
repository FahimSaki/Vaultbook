import { notFound } from "next/navigation";
import { getCtx } from "@/server/auth/ctx";
import { isPortable } from "@/server/config";
import { listTeam } from "@/server/services/team";
import { Button } from "@/components/ui/button";
import { AddStaffForm } from "@/components/TeamForms";
import { removeStaffAction } from "./actions";

export default async function TeamPage() {
  if (isPortable) notFound();
  const ctx = await getCtx();
  if (ctx.role !== "owner") notFound();
  const members = await listTeam(ctx);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Team</h1>
      <AddStaffForm />
      <ul className="divide-y text-sm">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between py-2">
            <span>
              {m.name} · {m.email} · {m.role}
            </span>
            {m.role === "staff" ? (
              <form action={removeStaffAction.bind(null, m.userId)}>
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
