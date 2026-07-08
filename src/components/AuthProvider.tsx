"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { butterbase } from "@/lib/butterbase";

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  accessToken: () => string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  accessToken: () => null,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    butterbase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setUser((data as AuthUser | null) ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { unsubscribe } = butterbase.onAuthStateChange((event, session) => {
      const u = (session as { user?: AuthUser } | null)?.user ?? null;
      if (event === "SIGNED_OUT") setUser(null);
      else if (u) setUser(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const accessToken = () =>
    butterbase.sessionManager.getSession()?.accessToken ?? null;

  const signOut = async () => {
    await butterbase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
