"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error || !authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

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

        if (!mounted) return;

        setUser({
          ...authUser,
          role_id: employee?.role_id || null,
          role: employee?.roles?.[0]?.name || null,
        });

      } catch (err) {
        console.error("useUser error:", err);
        if (mounted) setUser(null);
      }

      if (mounted) setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        return;
      }

      const authUser = session.user;

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

      if (!mounted) return;

      setUser({
        ...authUser,
        role_id: employee?.role_id || null,
        role: employee?.roles?.[0]?.name || null,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };

  }, []);

  return { user, loading };
}