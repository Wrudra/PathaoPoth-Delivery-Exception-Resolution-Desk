import { isLoginConfigured } from "@/lib/blocks/config";
import { LoginScreen } from "./login-screen";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginScreen configured={isLoginConfigured()} />;
}
