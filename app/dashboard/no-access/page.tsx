"use client";

import { useRouter } from "next/navigation";

export default function NoAccessPage() {
  const router = useRouter();

  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md">

        <div className="text-5xl mb-4">🚫</div>

        <h1 className="text-2xl font-black mb-2">
          Giriş İcazəniz Yoxdur
        </h1>

        <p className="text-gray-500 mb-6">
          Bu səhifəyə baxmaq üçün yetkiniz yoxdur.
        </p>

        <button
          onClick={() => router.push("/dashboard")}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
        >
          Dashboard-a Qayıt
        </button>

      </div>
    </div>
  );
}