"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

type Role = { id: string; name: string };
type Perm = { key: string; label: string };
type Company = { id: number; name: string };

type Msg = {
  type: "ok" | "err";
  text: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function RolePermissionsPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const [guides, setGuides] = useState<any[]>([]);
  const [selectedGuides, setSelectedGuides] = useState<string[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Perm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [guideSearch, setGuideSearch] = useState("");
  const [msg, setMsg] = useState<Msg | null>(null);

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(true);
  const [isCompaniesOpen, setIsCompaniesOpen] = useState(true);
  const [isGuidesOpen, setIsGuidesOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setReady(true);
      }
    };

    checkSession();
  }, []);

  const sidebarGroups = [
    {
      title: t.dashboard,
      permissions: ["dashboard.view"],
    },
    {
      title: t.employees,
      permissions: ["employees.view", "employees.create"],
    },
    {
      title: t.structure,
      permissions: [
        "companies.view",
        "departments.view",
        "positions.view",
        "roles.view",
      ],
    },
    {
      title: t.tasks,
      permissions: ["tasks.view", "tasks.create", "tasks.log.view"],
    },
    {
      title: t.taskButtons,
      permissions: [
        "tasks.edit.list",
        "tasks.delete.list",
        "tasks.export.list",
        "tasks.print.list",
        "tasks.edit.drawer",
        "tasks.delete.drawer",
        "tasks.export.drawer",
        "tasks.print.drawer",
      ],
    },
    {
      title: t.recurringTasks,
      permissions: ["recurring.view", "recurring.create"],
    },
    {
      title: t.recurringButtons,
      permissions: [
        "recurring.view.button",
        "recurring.pause.button",
        "recurring.delete.button",
      ],
    },
    {
      title: t.permissions,
      permissions: ["role_permissions.view"],
    },
    {
      title: t.settings,
      permissions: ["settings.view"],
    },
  ];

  useEffect(() => {
    if (!ready) return;

    async function load() {
      setPageLoading(true);

      try {
        const [{ data: rolesData }, { data: permData }, { data: companyData }] =
          await Promise.all([
            supabase.from("roles").select("id,name").order("name"),
            supabase.from("permissions").select("key,label"),
            supabase.from("companies").select("id,name").order("name"),
          ]);

        setRoles(rolesData || []);
        setPermissions(permData || []);
        setCompanies(companyData || []);

        if (rolesData?.length) {
          setSelectedRole(rolesData[0].id);
        }
      } catch (e: any) {
        setMsg({ type: "err", text: e?.message || "Məlumat yüklənmədi" });
      } finally {
        setPageLoading(false);
      }
    }

    load();
  }, [ready]);

  useEffect(() => {
    if (!selectedRole) return;

    async function loadRoleData() {
      setMsg(null);

      const [{ data: perms }, { data: comps }, { data: roleGuides }] =
        await Promise.all([
          supabase
            .from("role_permissions")
            .select("permission_key")
            .eq("role_id", selectedRole),

          supabase
            .from("role_company_access")
            .select("company_id")
            .eq("role_id", selectedRole),

          supabase
            .from("role_assignable_guides")
            .select("guide_id")
            .eq("role_id", selectedRole),
        ]);

      setSelectedPerms((perms || []).map((p: any) => p.permission_key));
      setSelectedCompanies((comps || []).map((c: any) => c.company_id));
      setSelectedGuides((roleGuides || []).map((g: any) => g.guide_id));
    }

    loadRoleData();
  }, [selectedRole]);

  useEffect(() => {
    if (!selectedCompanies.length) {
      setGuides([]);
      return;
    }

    loadGuides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanies]);

  function toggle(key: string) {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  function toggleGuide(id: string) {
    setSelectedGuides((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  function toggleCompany(id: number) {
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function loadGuides() {
    const { data } = await supabase
      .from("employees")
      .select(
        `
        id,
        ad,
        soyad,
        company_id,
        roles!inner(name)
      `
      )
      .in("company_id", selectedCompanies)
      .eq("roles.name", "REHBER");

    setGuides(data || []);
  }

  async function save() {
    if (!selectedRole) return;

    setLoading(true);
    setMsg(null);

    try {
      await supabase.from("role_permissions").delete().eq("role_id", selectedRole);

      if (selectedPerms.length > 0) {
        await supabase.from("role_permissions").insert(
          selectedPerms.map((key) => ({
            role_id: selectedRole,
            permission_key: key,
          }))
        );
      }

      await supabase
        .from("role_company_access")
        .delete()
        .eq("role_id", selectedRole);

      if (selectedCompanies.length > 0) {
        await supabase.from("role_company_access").insert(
          selectedCompanies.map((company_id) => ({
            role_id: selectedRole,
            company_id,
          }))
        );
      }

      await supabase
        .from("role_assignable_guides")
        .delete()
        .eq("role_id", selectedRole);

      if (selectedGuides.length > 0) {
        await supabase.from("role_assignable_guides").insert(
          selectedGuides.map((guide_id) => ({
            role_id: selectedRole,
            guide_id,
            company_id: guides.find((g) => g.id === guide_id)?.company_id,
          }))
        );
      }

      setMsg({ type: "ok", text: t.savedSuccess });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Yadda saxlanılmadı" });
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return permissions;

    return permissions.filter((p) => {
      const key = p.key?.toLowerCase() || "";
      const label = p.label?.toLowerCase() || "";

      return (
        key.includes(search.toLowerCase()) ||
        label.includes(search.toLowerCase())
      );
    });
  }, [permissions, search]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companies;

    return companies.filter((c) =>
      c.name.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [companies, companySearch]);

  const filteredGuides = useMemo(() => {
    const q = guideSearch.trim().toLowerCase();

    if (!q) return guides;

    return guides.filter((g) =>
      `${g.ad ?? ""} ${g.soyad ?? ""}`.toLowerCase().includes(q)
    );
  }, [guideSearch, guides]);

  const selectedRoleName =
    roles.find((role) => role.id === selectedRole)?.name || "-";

  if (pageLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-28 animate-pulse rounded-[28px] border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-[28px] border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {msg && (
        <AlertBox type={msg.type} text={msg.text} onClose={() => setMsg(null)} />
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
              <ShieldCheck size={14} />
              {t.rolePermissions}
            </div>

            <h2 className="text-xl font-black text-slate-950">
              {selectedRoleName}
            </h2>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Rol üçün menyu, düymə, şirkət və rəhbər icazələrini seçin.
            </p>
          </div>

          <div className="min-w-full lg:min-w-[360px]">
            <label className="text-xs font-black uppercase tracking-wide text-slate-400">
              {t.selectRole}
            </label>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <PermissionSection
            title={t.permissions}
            icon={LockKeyhole}
            open={isPermissionsOpen}
            onToggle={() => setIsPermissionsOpen((p) => !p)}
            count={selectedPerms.length}
            total={permissions.length}
          >
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t.search}
            />

            <div className="mt-4 space-y-3">
              {sidebarGroups.map((group) => {
                const groupPerms = filtered.filter(
                  (p) => p.key && group.permissions.includes(p.key)
                );

                if (groupPerms.length === 0) return null;

                const isOpen = openGroup === group.title;
                const activeCount = groupPerms.filter((p) =>
                  selectedPerms.includes(p.key)
                ).length;

                return (
                  <div
                    key={group.title}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenGroup(isOpen ? null : group.title)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white"
                    >
                      <div>
                        <div className="text-sm font-black text-slate-800">
                          {group.title}
                        </div>
                        <div className="mt-0.5 text-xs font-bold text-slate-400">
                          {activeCount} / {groupPerms.length}
                        </div>
                      </div>

                      <ChevronDown
                        size={18}
                        className={cn(
                          "text-slate-400 transition",
                          isOpen && "rotate-180 text-[#e42526]"
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div className="grid gap-2 border-t border-slate-200 bg-white p-3">
                        {groupPerms.map((perm) => {
                          const active = selectedPerms.includes(perm.key);

                          return (
                            <PermissionItem
                              key={perm.key}
                              active={active}
                              title={perm.label}
                              subtitle={perm.key}
                              tone="green"
                              onClick={() => toggle(perm.key)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </PermissionSection>

          <PermissionSection
            title={t.companyPermissions}
            icon={Building2}
            open={isCompaniesOpen}
            onToggle={() => setIsCompaniesOpen((p) => !p)}
            count={selectedCompanies.length}
            total={companies.length}
          >
            <SearchInput
              value={companySearch}
              onChange={setCompanySearch}
              placeholder={t.searchCompany}
            />

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {filteredCompanies.map((company) => {
                const active = selectedCompanies.includes(company.id);

                return (
                  <PermissionItem
                    key={company.id}
                    active={active}
                    title={company.name}
                    subtitle={`ID: ${company.id}`}
                    tone="blue"
                    onClick={() => toggleCompany(company.id)}
                  />
                );
              })}
            </div>
          </PermissionSection>

          <PermissionSection
            title={t.guidePermissions}
            icon={UsersRound}
            open={isGuidesOpen}
            onToggle={() => setIsGuidesOpen((p) => !p)}
            count={selectedGuides.length}
            total={guides.length}
          >
            <SearchInput
              value={guideSearch}
              onChange={setGuideSearch}
              placeholder={t.search}
            />

            {selectedCompanies.length === 0 ? (
              <EmptyMini text="Əvvəl şirkət seçin." />
            ) : filteredGuides.length === 0 ? (
              <EmptyMini text={t.employeeNotFound || "Rəhbər tapılmadı"} />
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {filteredGuides.map((g) => {
                  const active = selectedGuides.includes(g.id);

                  return (
                    <PermissionItem
                      key={g.id}
                      active={active}
                      title={`${g.ad} ${g.soyad}`}
                      subtitle={`company_id: ${g.company_id}`}
                      tone="purple"
                      onClick={() => toggleGuide(g.id)}
                    />
                  );
                })}
              </div>
            )}
          </PermissionSection>
        </div>

        <aside className="xl:sticky xl:top-5 xl:self-start">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
              <h3 className="text-base font-black text-slate-950">
                Xülasə
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Seçilmiş role tətbiq olunacaq icazələr
              </p>
            </div>

            <div className="space-y-3 p-5">
              <SummaryCard
                icon={LockKeyhole}
                label={t.permissions}
                value={`${selectedPerms.length} / ${permissions.length}`}
                tone="green"
              />
              <SummaryCard
                icon={Building2}
                label={t.companyPermissions}
                value={`${selectedCompanies.length} / ${companies.length}`}
                tone="blue"
              />
              <SummaryCard
                icon={UsersRound}
                label={t.guidePermissions}
                value={`${selectedGuides.length} / ${guides.length}`}
                tone="purple"
              />

              <button
                type="button"
                onClick={save}
                disabled={loading}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e42526] text-sm font-black text-white shadow-sm shadow-[#e42526]/20 transition hover:bg-[#c91f20] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    {t.saving}
                  </>
                ) : (
                  <>
                    <Save size={17} />
                    {t.save}
                  </>
                )}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function PermissionSection({
  title,
  icon: Icon,
  open,
  onToggle,
  count,
  total,
  children,
}: {
  title: string;
  icon: any;
  open: boolean;
  onToggle: () => void;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526]">
            <Icon size={18} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-slate-950">
              {title}
            </h3>
            <p className="mt-0.5 text-xs font-bold text-slate-400">
              {count} / {total}
            </p>
          </div>
        </div>

        <ChevronDown
          size={20}
          className={cn(
            "shrink-0 text-slate-400 transition",
            open && "rotate-180 text-[#e42526]"
          )}
        />
      </button>

      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
      />

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`🔍 ${placeholder}`}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
      />
    </div>
  );
}

function PermissionItem({
  active,
  title,
  subtitle,
  tone,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  tone: "green" | "blue" | "purple";
  onClick: () => void;
}) {
  const activeTone =
    tone === "blue"
      ? "border-blue-300 bg-blue-50"
      : tone === "purple"
        ? "border-violet-300 bg-violet-50"
        : "border-emerald-300 bg-emerald-50";

  const iconTone =
    tone === "blue"
      ? "bg-blue-600"
      : tone === "purple"
        ? "bg-violet-600"
        : "bg-emerald-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]",
        active
          ? activeTone
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
          active ? `${iconTone} border-transparent text-white` : "border-slate-300 bg-white text-transparent"
        )}
      >
        <Check size={13} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-800">
          {title}
        </span>

        {subtitle && (
          <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-400">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: "green" | "blue" | "purple";
}) {
  const cls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "purple"
        ? "bg-violet-50 text-violet-700"
        : "bg-emerald-50 text-emerald-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-2xl", cls)}>
          <Icon size={18} />
        </div>

        <div>
          <div className="text-sm font-black text-slate-950">{value}</div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
      {text}
    </div>
  );
}

function AlertBox({
  type,
  text,
  onClose,
}: {
  type: "ok" | "err";
  text: string;
  onClose: () => void;
}) {
  const ok = type === "ok";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-bold",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
        ) : (
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
        )}

        <span>{text}</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/70"
      >
        <X size={14} />
      </button>
    </div>
  );
}