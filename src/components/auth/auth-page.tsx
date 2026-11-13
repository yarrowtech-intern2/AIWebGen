import { Suspense } from "react";
import { HomeBot } from "@/components/home/home-bot";
import { LaserBackground } from "@/components/home/laser-background";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthForm } from "./auth-form";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  return (
    <>
      <LaserBackground />
      <div className="relative z-10 flex flex-1 flex-col">
        <SiteHeader>
          <ThemeToggle />
        </SiteHeader>
        <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-5 px-4 pt-2 pb-6 sm:gap-8 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
          <div className="text-center lg:text-left">
            <HomeBot className="mb-3 items-center [--bot-size:clamp(150px,22dvh,200px)] sm:mb-6 lg:mb-6 lg:items-start lg:[--bot-size:clamp(260px,22vw,320px)]" />
            <h1 className="text-[clamp(2rem,6.4vw,5rem)] leading-[0.98] font-bold tracking-[-0.04em] text-balance">
              {isLogin ? "Welcome back. Let's keep building." : "Build websites by describing them."}
            </h1>
            <p className="mt-4 hidden max-w-md text-base text-muted-foreground sm:block sm:text-lg">
              Your AI co-builder: describe it, watch Claude build it live, then publish in a click.
            </p>
          </div>
          <div className="glass-surface w-full rounded-3xl p-5 sm:p-8">
            <h2 className="mb-1 text-xl font-semibold tracking-tight">{isLogin ? "Log in" : "Create your account"}</h2>
            <p className="mb-4 text-sm text-muted-foreground sm:mb-6">
              {isLogin ? "Pick up where you left off." : "It takes less than a minute."}
            </p>
            <Suspense>
              <AuthForm mode={mode} />
            </Suspense>
          </div>
        </main>
      </div>
    </>
  );
}
