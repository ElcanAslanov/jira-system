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

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 🔥 parallel fetch (çox vacib)
        const [
          { data: userData },
          { data: sessionData }
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);

        const authUser = userData?.user;

        if (!mounted) return;

        if (!authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // employee fetch
        const { data: employee } = await supabase
          .from("employees")
          .select(`role_id, roles(name)`)
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (!mounted) return;

        setUser({
          ...authUser,
          role_id: employee?.role_id ?? null,
          role: employee?.roles?.[0]?.name ?? null,
          token: sessionData?.session?.access_token ?? null,
        });

      } catch (e) {
        console.error("Auth init error:", e);
      }

      if (mounted) setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          setUser(null);
          return;
        }

        setUser((prev: any) => ({
          ...session.user,
          role_id: prev?.role_id,
          role: prev?.role,
          token: session.access_token,
        }));
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

export function useAuth() {
  return useContext(AuthContext);
}