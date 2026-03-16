"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthContextType = {
  user: any;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadEmployee(authUser: any) {
    const { data: employee } = await supabase
      .from("employees")
      .select(`
        role_id,
        roles (
          name
        )
      `)
      .eq("user_id", authUser.id)
      .maybeSingle();

    setUser({
      ...authUser,
      role_id: employee?.role_id ?? null,
      role: employee?.roles?.[0]?.name ?? null,
    });
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!data?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      await loadEmployee(data.user);
      setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          setUser(null);
          return;
        }

        await loadEmployee(session.user);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser() {
  return useContext(AuthContext);
}