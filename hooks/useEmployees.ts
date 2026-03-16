"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

let cache: any = null;
let cacheTime = 0;

const CACHE_DURATION = 1000 * 60 * 5; // 5 dəqiqə

export function useEmployees() {
  const [data, setData] = useState<any[]>(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    const now = Date.now();

    // cache valid isə fetch etmə
    if (cache && now - cacheTime < CACHE_DURATION) {
      setData(cache);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;

        if (!token) return;

        const res = await fetch("/api/admin/employees", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();

        cache = json.employees || [];
        cacheTime = Date.now();

        setData(cache);
      } catch (err) {
        console.error("Employees fetch error:", err);
      }

      setLoading(false);
    }

    load();
  }, []);

  return { employees: data, loading };
}