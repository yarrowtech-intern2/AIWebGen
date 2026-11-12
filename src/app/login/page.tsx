import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Log in · AgentWebBuilder" };

export default function LoginPage() {
  return <AuthPage mode="login" />;
}
