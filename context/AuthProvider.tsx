"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthContextType = {
  user: any;
  token: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadEmployee(authUser: any) {
    try {
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
    } catch (e) {
      console.error("loadEmployee error:", e);
      setUser(authUser); // fallback
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // ✅ ƏN VACİB — getUser istifadə et
        const { data: userData } = await supabase.auth.getUser();
        const authUser = userData?.user;

        if (!mounted) return;

        if (!authUser) {
          setUser(null);
          setToken(null);
          setLoading(false);
          return;
        }

        // token ayrıca götürürük
        const { data: sessionData } = await supabase.auth.getSession();

        setToken(sessionData?.session?.access_token ?? null);

        await loadEmployee(authUser);

        setLoading(false);
      } catch (e) {
        console.error("Auth init error:", e);
        setLoading(false);
      }
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        try {
          if (!session?.user) {
            setUser(null);
            setToken(null);
            return;
          }

          setToken(session.access_token);

          await loadEmployee(session.user);
        } catch (e) {
          console.error("Auth change error:", e);
        }
      }
    );

    // 🔥 failsafe — loading donmasın
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}