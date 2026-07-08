"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <nav className="flex items-center justify-between border-b border-edge bg-surface-1/80 px-5 py-3 backdrop-blur">
      <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
        Venture<span className="text-accent">Graph</span>
      </Link>
      {user && (
        <div className="flex items-center gap-3 text-xs text-ink-3">
          <span className="hidden sm:inline">{user.email}</span>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="rounded-lg border border-edge px-2.5 py-1 transition hover:bg-surface-2 hover:text-ink-2"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
