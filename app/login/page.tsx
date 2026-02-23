"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50 p-4 overflow-hidden">

      {/* Soft Background Decoration */}
      <div className="absolute w-[500px] h-[500px] bg-[#e42526]/10 rounded-full blur-3xl -top-32 -left-32"></div>
      <div className="absolute w-[400px] h-[400px] bg-pink-300/20 rounded-full blur-3xl bottom-0 right-0"></div>

      <div className="relative w-full max-w-md">

        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-gray-100">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/cahan.png"
              alt="Cahan Logo"
              width={130}
              height={130}
              className="object-contain w-28 md:w-32 h-auto"
              priority
            />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-800">
              Xoş gəlmişsiniz!
            </h3>            
          </div>

          {/* Email */}
          <div className="mb-5">
            <label className="block text-gray-600 text-sm mb-2">
              Email
            </label>
            <input
              type="email"
              placeholder=""
              className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-800 border border-gray-200 focus:border-[#e42526] focus:ring-2 focus:ring-[#e42526]/20 outline-none transition-all duration-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
          </div>

          {/* Password */}
          <div className="mb-6 relative">
            <label className="block text-gray-600 text-sm mb-2">
              Şifrə
            </label>
            <input
              type={show ? "text" : "password"}
              placeholder=""
              className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-800 border border-gray-200 focus:border-[#e42526] focus:ring-2 focus:ring-[#e42526]/20 outline-none transition-all duration-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            {/* <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-4 top-[38px] text-gray-400 hover:text-[#e42526]"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button> */}
          </div>

          {/* Button */}
          <button
            onClick={login}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#e42526] hover:bg-[#c81f20] text-white font-semibold py-3 rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-300 disabled:opacity-70"
          >
            {loading && <Loader2 className="animate-spin w-4 h-4" />}
            {loading ? "Giriş edilir..." : "Daxil ol"}
          </button>

        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-6">
          © {new Date().getFullYear()} Cahan - Task Flow
        </p>
      </div>
    </div>
  );
}