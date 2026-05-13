"use client";

export default function TasksSkeleton({ label }: { label: string }) {
  return (
    <div className="min-h-screen space-y-6 bg-[#f7f8fb] pb-10">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
       <div className="flex items-center gap-3">
  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e42526] border-t-transparent" />
  <p className="text-sm font-black text-slate-600">Tapşırıqlar hazırlanır...</p>
</div>

        <div className="mt-6 h-8 w-64 animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-xl bg-slate-100" />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[520px] animate-pulse rounded-[28px] border border-slate-200 bg-white shadow-sm"
          />
        ))}
      </section>
    </div>
  );
}