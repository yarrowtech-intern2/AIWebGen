import Link from "next/link";
import type { ReactNode } from "react";

/** The app mark: a dark orb with two LED "eyes", echoing the home bot. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="awb-orb" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#4a4a5c" />
          <stop offset="1" stopColor="#0d0d12" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#awb-orb)" />
      <rect x="10" y="10.5" width="4" height="8" rx="2" fill="#ffd59a" />
      <rect x="18" y="10.5" width="4" height="8" rx="2" fill="#ffd59a" />
      <path d="M12 22.2q4 2.4 8 0" stroke="#ffd59a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Top bar used by the home and auth pages: wordmark left, a glass control pill right. */
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="relative z-20 flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-5">
      <Link href="/" className="flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <LogoMark />
        <span className="text-lg font-semibold tracking-tight sm:text-xl">
          AgentWeb<span className="text-muted-foreground">Builder</span>
        </span>
      </Link>
      {children && <div className="glass-surface flex items-center gap-1 rounded-full p-1">{children}</div>}
    </header>
  );
}
