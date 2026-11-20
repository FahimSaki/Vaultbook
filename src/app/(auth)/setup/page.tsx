import { redirect } from "next/navigation";
import { vaultExists } from "@/server/portable/vault";
import { SetupForm } from "@/components/AuthForms";

export default async function SetupPage() {
  if (await vaultExists()) redirect("/unlock");
  return <SetupForm />;
}
