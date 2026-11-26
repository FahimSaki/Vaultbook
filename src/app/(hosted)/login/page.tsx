import { LoginForm } from "@/components/HostedAuthForms";
import { signupAllowed } from "@/server/auth/hosted";
export default async function LoginPage() {
  return <LoginForm showSignup={await signupAllowed()} />;
}
