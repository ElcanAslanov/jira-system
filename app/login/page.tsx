"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Workflow,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async () => {
    if (!email || !password) {
      alert("Email və şifrə daxil edin");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      router.push("/dashboard/tasks");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f7fb]">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(228,37,38,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.10),transparent_30%)]" />
      <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#e42526]/10 blur-3xl" />
      <div className="absolute -right-28 bottom-10 h-96 w-96 rounded-full bg-slate-900/10 blur-3xl" />

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left Branding Panel */}
        {/* Left Branding Panel */}
<section className="hidden lg:flex relative flex-col justify-between overflow-hidden p-10 xl:p-14">
  {/* Decorative grid */}
  <div className="absolute inset-0 opacity-[0.35]">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] bg-[size:42px_42px]" />
  </div>

  <div className="relative z-10 flex items-center gap-3">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <Image
        src="/cahan.png"
        alt="Cahan Logo"
        width={42}
        height={42}
        className="h-9 w-9 object-contain"
        priority
      />
    </div>

    <div>
      <p className="text-sm font-semibold text-slate-900">Cahan Holding</p>
      <p className="text-xs text-slate-500">Task Flow</p>
    </div>
  </div>

  {/* Visual area */}
  <div className="relative z-10 mx-auto w-full max-w-xl">
    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-bold text-slate-800 shadow-sm backdrop-blur">
      <span className="h-2.5 w-2.5 rounded-full bg-[#e42526]" />
      İş axınına davam et
    </div>

    <div className="relative">
      {/* Main preview card */}
      <div className="rounded-[2rem] border border-white/80 bg-white/75 p-5 shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">Bugünkü tapşırıqlar</p>
            <p className="text-xs text-slate-500">Task Flow board</p>
          </div>

          <div className="rounded-full bg-[#e42526]/10 px-3 py-1 text-xs font-black text-[#e42526]">
            12 aktiv
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Column 1 */}
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-black text-slate-600">Açıq</p>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                4
              </span>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="mb-2 h-2 w-16 rounded-full bg-slate-200" />
                <div className="h-2 w-24 rounded-full bg-slate-100" />
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="mb-2 h-2 w-20 rounded-full bg-slate-200" />
                <div className="h-2 w-14 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="rounded-2xl bg-[#e42526]/5 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-black text-[#e42526]">İcrada</p>
              <span className="rounded-full bg-[#e42526]/10 px-2 py-0.5 text-[10px] font-bold text-[#e42526]">
                5
              </span>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl border border-[#e42526]/10 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#e42526]" />
                  <div className="h-2 w-16 rounded-full bg-slate-200" />
                </div>
                <div className="h-2 w-24 rounded-full bg-slate-100" />
              </div>

              <div className="rounded-xl border border-[#e42526]/10 bg-white p-3 shadow-sm">
                <div className="mb-2 h-2 w-20 rounded-full bg-slate-200" />
                <div className="h-2 w-16 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-black text-slate-600">Tamam</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                3
              </span>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
                <div className="mb-2 h-2 w-16 rounded-full bg-emerald-200" />
                <div className="h-2 w-20 rounded-full bg-slate-100" />
              </div>

              <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
                <div className="mb-2 h-2 w-20 rounded-full bg-emerald-200" />
                <div className="h-2 w-14 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge 1 */}
      <div className="absolute -left-8 top-20 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e42526]/10 text-[#e42526]">
            <Workflow size={19} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900">Workflow</p>
            <p className="text-[11px] text-slate-500">real-time</p>
          </div>
        </div>
      </div>

      {/* Floating badge 2 */}
      <div className="absolute -right-6 -bottom-6 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-8">
          <p className="text-xs font-black text-slate-900">Progress</p>
          <p className="text-xs font-black text-[#e42526]">78%</p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[78%] rounded-full bg-[#e42526]" />
        </div>
      </div>
    </div>
  </div>

  <p className="relative z-10 text-xs text-slate-400">
    © {new Date().getFullYear()} Cahan Holding
  </p>
</section>

        {/* Login Panel */}
        <main className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="mb-6 flex justify-center lg:hidden">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                <Image
                  src="/cahan.png"
                  alt="Cahan Logo"
                  width={70}
                  height={70}
                  className="h-14 w-14 object-contain"
                  priority
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
              <div className="mb-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e42526]/10 px-3 py-1.5 text-xs font-bold text-[#e42526]">
                  <span className="h-2 w-2 rounded-full bg-[#e42526]" />
                  Cahan Flow
                </div>

                <h2 className="text-3xl font-black tracking-tight text-slate-950">
                  Xoş gəlmişsiniz
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Hesabınıza daxil olaraq tapşırıq panelinə keçin.
                </p>
              </div>

              {/* Email */}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  placeholder="email@cahan.az"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Şifrə
                </label>

                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm font-medium text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && login()}
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#e42526]"
                    aria-label={show ? "Şifrəni gizlət" : "Şifrəni göstər"}
                  >
                    {show ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {/* Button */}
              <button
                onClick={login}
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e42526] text-sm font-bold text-white shadow-lg shadow-[#e42526]/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#c91f20] hover:shadow-xl hover:shadow-[#e42526]/30 active:translate-y-0 disabled:pointer-events-none disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Giriş edilir...
                  </>
                ) : (
                  <>
                    Daxil ol
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </>
                )}
              </button>

           
            </div>

            <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">
              © {new Date().getFullYear()} Cahan Holding — Task Flow
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}