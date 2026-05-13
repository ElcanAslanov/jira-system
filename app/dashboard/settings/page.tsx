"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function SettingsPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const [users, setUsers] = useState<any[]>([]);
  const [password, setPassword] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);

  const [myPassword, setMyPassword] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showMyPassword, setShowMyPassword] = useState(false);
  const [showUserPassword, setShowUserPassword] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [hasMore, setHasMore] = useState(false);
  const [currentCount, setCurrentCount] = useState(0);

  const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    let alive = true;

    try {
      setUsersLoading(true);

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        if (alive) {
          setUsers([]);
          setCurrentCount(0);
          setHasMore(false);
        }

        return;
      }

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`/api/admin/list-users?${params.toString()}`, {
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || "Users could not be loaded");
      }

      if (alive) {
        setUsers(Array.isArray(result.users) ? result.users : []);
        setCurrentCount(Number(result.count || 0));
        setHasMore(Boolean(result.hasMore));
      }
    } catch (err) {
      console.error("Settings users load error:", err);

      if (alive) {
        setUsers([]);
        setCurrentCount(0);
        setHasMore(false);
      }
    } finally {
      if (alive) {
        setUsersLoading(false);
      }
    }

    return () => {
      alive = false;
    };
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await fetchUsers();
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fetchUsers]);

  const pageInfoText = useMemo(() => {
    if (usersLoading) return "Yüklənir...";

    if (currentCount === 0) {
      return `Səhifə ${page}`;
    }

    return `Səhifə ${page} • ${currentCount} nəticə`;
  }, [page, currentCount, usersLoading]);

  const changeMyPassword = async () => {
    if (myPassword.length < 6) {
      alert(t.passwordMin);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: myPassword,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert(t.passwordChanged);
      setMyPassword("");
      setShowMyPassword(false);
    }
  };

  const changeUserPassword = async () => {
    if (!selectedUser?.id) return;

    if (!password || password.length < 6) {
      alert(t.passwordMin);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          password,
        }),
      });

      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else {
        alert(t.passwordUpdated);
        setSelectedUser(null);
        setPassword("");
        setShowUserPassword(false);
      }
    } catch (err) {
      console.error("Password update error:", err);
      alert("Xəta baş verdi");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setPassword("");
    setShowUserPassword(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#e42526]/10 blur-3xl" />
        <div className="absolute -bottom-24 left-20 h-52 w-52 rounded-full bg-slate-900/5 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-bold text-[#c91f20]">
              <Settings size={14} />
              Task Flow
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {t.settings}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Şifrə dəyişiklikləri və sistem istifadəçilərinin giriş
              təhlükəsizliyi bu paneldən idarə olunur.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Cari səhifə
              </p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {currentCount}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Təhlükəsizlik
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm font-bold text-emerald-600">
                <ShieldCheck size={17} />
                Aktiv
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_1fr]">
        {/* My Password */}
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526]">
              <LockKeyhole size={21} />
            </div>

            <div>
              <h2 className="text-base font-black text-slate-950">
                {t.changeMyPassword}
              </h2>
              <p className="text-xs text-slate-400">Minimum 6 simvol</p>
            </div>
          </div>

          <div className="relative">
            <input
              type={showMyPassword ? "text" : "password"}
              placeholder={t.newPassword}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
              value={myPassword}
              onChange={(e) => setMyPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && changeMyPassword()}
            />

            <button
              type="button"
              onClick={() => setShowMyPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#e42526]"
            >
              {showMyPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            onClick={changeMyPassword}
            disabled={loading}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e42526] text-sm font-bold text-white shadow-sm transition hover:bg-[#c91f20] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.change}
          </button>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs leading-5 text-slate-500">
              Şifrəni yenilədikdən sonra növbəti girişdə yeni şifrə istifadə
              olunacaq.
            </p>
          </div>
        </section>

        {/* Users */}
        <section className="rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-base font-black text-slate-950">
                  {t.systemUsers}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {pageInfoText}
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <div className="relative w-full lg:w-80">
                  <Search
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Axtar: ad, soyad, email..."
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  />
                </div>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} / səhifə
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {usersLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: pageSize > 20 ? 10 : pageSize }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-2xl bg-slate-100"
                  />
                )
              )}
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-100 text-slate-400">
                <UserRound size={25} />
              </div>

              <h3 className="mt-4 text-sm font-black text-slate-900">
                İstifadəçi tapılmadı
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Axtarış sözünü dəyişərək yenidən yoxlayın.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        {t.name}
                      </th>
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        {t.surname}
                      </th>
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        {t.email}
                      </th>
                      <th className="px-5 py-3 text-center text-[11px] font-black uppercase tracking-wider text-slate-400">
                        {t.edit}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="transition hover:bg-[#fff8f8]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-100 text-xs font-black text-slate-700">
                              {user.ad?.[0]}
                              {user.soyad?.[0]}
                            </div>
                            <span className="text-sm font-bold text-slate-900">
                              {user.ad || "-"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {user.soyad || "-"}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-500">
                          {user.email || "-"}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e42526] active:scale-[0.98]"
                          >
                            {t.edit}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="space-y-3 p-4 md:hidden">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-slate-700 shadow-sm">
                        {user.ad?.[0]}
                        {user.soyad?.[0]}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {user.ad || "-"} {user.soyad || "-"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {user.email || "-"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedUser(user)}
                      className="h-10 w-full rounded-2xl bg-slate-900 text-xs font-bold text-white transition hover:bg-[#e42526] active:scale-[0.98]"
                    >
                      {t.edit}
                    </button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  {pageInfoText}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || usersLoading}
                    className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Əvvəlki
                  </button>

                  <div className="grid h-10 min-w-10 place-items-center rounded-2xl bg-slate-900 px-3 text-xs font-black text-white">
                    {page}
                  </div>

                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasMore || usersLoading}
                    className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Növbəti
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

     {/* Modal */}
{mounted &&
  selectedUser &&
  createPortal(
    <div className="fixed left-0 top-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-[#020617]/75 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              {t.changePasswordFor}
            </h3>
            <p className="mt-1 break-all text-sm text-slate-500">
              {selectedUser.email}
            </p>
          </div>

          <button
            onClick={closeModal}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="relative">
            <input
              type={showUserPassword ? "text" : "password"}
              placeholder={t.newPassword}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && changeUserPassword()}
            />

            <button
              type="button"
              onClick={() => setShowUserPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#e42526]"
            >
              {showUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeModal}
              disabled={loading}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {t.cancel}
            </button>

            <button
              onClick={changeUserPassword}
              disabled={loading}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#e42526] px-5 text-sm font-bold text-white transition hover:bg-[#c91f20] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.change}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )}
    </div>
  );
}