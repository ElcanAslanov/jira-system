"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const authUser = session.user;

      // ✅ ROLE_ID + ROLE NAME JOIN
      const { data: employee } = await supabase
        .from("employees")
        .select(`
          role_id,
          roles (
            name
          )
        `)
        .eq("user_id", authUser.id)
        .single();

      setUser({
        ...authUser,
        role_id: employee?.role_id || null,
        role: employee?.roles?.[0]?.name || null,
      });

      setLoading(false);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
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
          .single();

        setUser({
          ...authUser,
          role_id: employee?.role_id || null,
          role: employee?.roles?.[0]?.name || null,
        });
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}