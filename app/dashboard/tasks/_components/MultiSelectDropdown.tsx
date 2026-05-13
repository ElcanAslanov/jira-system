"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import { cn } from "./taskUtils";

export default function MultiSelectDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (vals: string[]) => void;
}) {
  const { lang } = useLang();
  const t = translations[lang];

  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string[]>(value);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTemp(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="relative">
      <div className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-2xl border px-4 text-sm font-bold transition",
          open
            ? "border-[#e42526] bg-[#fff1f1] text-[#c91f20] ring-4 ring-[#e42526]/10"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
        )}
      >
        <span className={value.length ? "text-slate-900" : "text-slate-400"}>
          {value.length ? `${value.length} ${t.selected}` : placeholder}
        </span>
        <ChevronDown size={16} className={cn("transition", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="absolute z-[60] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 p-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.search}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold outline-none focus:border-[#e42526] focus:ring-4 focus:ring-[#e42526]/10"
                />
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto">
              {filtered.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-4 py-2.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={temp.includes(opt.value)}
                    onChange={() => {
                      setTemp((prev) =>
                        prev.includes(opt.value)
                          ? prev.filter((v) => v !== opt.value)
                          : [...prev, opt.value]
                      );
                    }}
                    className="accent-[#e42526]"
                  />
                  <span className="text-sm font-bold text-slate-700">
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-between gap-2 border-t border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                onClick={() => setTemp([])}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-100"
              >
                {t.clear}
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange(temp);
                  setOpen(false);
                }}
                className="flex-1 rounded-xl bg-[#e42526] px-4 py-2 text-sm font-black text-white hover:bg-[#c91f20]"
              >
                {t.done}
              </button>
            </div>
          </div>

          <div className="fixed inset-0 z-[50]" onClick={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}