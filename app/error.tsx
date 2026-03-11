"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <h2 className="text-xl font-bold">Xəta baş verdi</h2>

      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Yenidən yüklə
      </button>
    </div>
  );
}