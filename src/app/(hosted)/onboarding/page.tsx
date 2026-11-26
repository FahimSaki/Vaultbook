import { redirect } from "next/navigation";
import { hostedCtxOrNull, hostedSession } from "@/server/auth/hosted";
import { OnboardingForm } from "@/components/HostedAuthForms";

export default async function OnboardingPage() {
  if (!(await hostedSession())) redirect("/login");
  if (await hostedCtxOrNull()) redirect("/products");
  return <OnboardingForm />;
}
