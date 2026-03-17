"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      if (!token) return [];

      const res = await fetch("/api/admin/employees", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      return json.employees || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}