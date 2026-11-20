import { redirect } from "next/navigation";
import { vaultExists } from "@/server/portable/vault";
import { UnlockForm } from "@/components/AuthForms";

export default async function UnlockPage() {
  if (!(await vaultExists())) redirect("/setup");
  return <UnlockForm />;
}
