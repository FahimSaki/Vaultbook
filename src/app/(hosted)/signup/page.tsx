import { redirect } from "next/navigation";
import { SignupForm } from "@/components/HostedAuthForms";
import { signupAllowed } from "@/server/auth/hosted";
export default async function SignupPage() {
  if (!(await signupAllowed())) redirect("/login");
  return <SignupForm />;
}
