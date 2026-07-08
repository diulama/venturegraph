"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { butterbase } from "@/lib/butterbase";

type Mode = "signin" | "signup";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await butterbase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        setNotice("Account created — signing you in…");
      }
      const { error: signInError } = await butterbase.auth.signIn({
        email,
        password,
      });
      if (signInError) throw new Error(signInError.message);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface-1 p-6 shadow-2xl">
      <div className="mb-5 flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              mode === m
                ? "bg-surface-3 text-ink"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@startup.com"
          className="w-full rounded-lg border border-edge bg-surface-0 px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            mode === "signup"
              ? "Password (8+ chars, mixed case, number, symbol)"
              : "Password"
          }
          className="w-full rounded-lg border border-edge bg-surface-0 px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {notice && <p className="text-xs text-ink-2">{notice}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-50"
        >
          {busy
            ? "One moment…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
