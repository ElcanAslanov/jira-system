"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

type UseEmployeesOptions = {
  enabled?: boolean;
};

export function useEmployees(options?: UseEmployeesOptions) {
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ["employees"],
    enabled,
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      if (!token) return [];

      const res = await fetch("/api/admin/employees", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Employees could not be loaded");
      }

      const json = await res.json();
      return json.employees || [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}