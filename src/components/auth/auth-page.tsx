import { Sparkles } from "lucide-react";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthForm } from "./auth-form";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          AgentWebBuilder
        </span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {mode === "login" ? "Log in to keep building your sites." : "Build websites by chatting with Claude."}
          </p>
          <Suspense>
            <AuthForm mode={mode} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
