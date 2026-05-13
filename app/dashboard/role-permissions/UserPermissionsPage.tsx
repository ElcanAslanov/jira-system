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
  MinusCircle,
  PlusCircle,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

type User = {
  user_id: string;
  ad: string;
  soyad: string;
  email: string;
  role_id: string;
};

type Permission = {
  key: string;
  label: string;
};

type Company = {
  id: number;
  name: string;
};

type Msg = {
  type: "ok" | "err";
  text: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function userName(user?: User) {
  if (!user) return "-";
  return `${user.ad ?? ""} ${user.soyad ?? ""}`.trim() || user.email || "-";
}

export default function UserPermissionsPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const [guides, setGuides] = useState<any[]>([]);
  const [selectedGuides, setSelectedGuides] = useState<number[]>([]);

  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");

  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [userExtras, setUserExtras] = useState<string[]>([]);
  const [userDenies, setUserDenies] = useState<string[]>([]);

  const [roleCompanies, setRoleCompanies] = useState<number[]>([]);
  const [companyExtras, setCompanyExtras] = useState<number[]>([]);
  const [companyDenies, setCompanyDenies] = useState<number[]>([]);

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
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitial() {
    setPageLoading(true);
    setMsg(null);

    try {
      const [
        { data: usersData },
        { data: permsData },
        { data: companyData },
      ] = await Promise.all([
        supabase
          .from("employees")
          .select("user_id,ad,soyad,email,role_id")
          .not("user_id", "is", null)
          .order("ad"),

        supabase.from("permissions").select("key,label"),

        supabase.from("companies").select("id,name").order("name"),
      ]);

      setUsers(usersData || []);
      setPermissions(permsData || []);
      setCompanies(companyData || []);

      if (usersData?.length) {
        setSelectedUserId(usersData[0].user_id);
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Məlumat yüklənmədi" });
    } finally {
      setPageLoading(false);
    }
  }

  async function loadGuides(companyIds: number[]) {
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
      .in("company_id", companyIds)
      .in("roles.name", ["REHBER", "EMPLOYEE"])
      .neq("user_id", selectedUserId);

    setGuides(data || []);
  }

  useEffect(() => {
    if (!selectedUserId) return;

    setSelectedGuides([]);

    const user = users.find((u) => u.user_id === selectedUserId);
    if (!user) return;

    loadPermissions(user.role_id, selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, users]);

  async function loadPermissions(roleId: string, userId: string) {
    setLoading(true);
    setMsg(null);

    const [
      { data: roleData },
      { data: userData },
      { data: roleCompData },
      { data: userCompData },
      { data: userGuides },
      { data: employeeRow },
    ] = await Promise.all([
      supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", roleId),

      supabase
        .from("user_permissions")
        .select("permission_key,allowed")
        .eq("user_id", userId),

      supabase
        .from("role_company_access")
        .select("company_id")
        .eq("role_id", roleId),

      supabase
        .from("user_company_access")
        .select("company_id,allowed")
        .eq("user_id", userId),

      supabase
        .from("user_assignable_guides")
        .select("guide_id")
        .eq("user_id", userId),

      supabase.from("employees").select("id").eq("user_id", userId).single(),
    ]);

    if (employeeRow?.id) {
      await supabase
        .from("employee_guides")
        .select("employee_id")
        .eq("guide_id", employeeRow.id);
    }

    setRolePerms(roleData?.map((x: any) => x.permission_key) || []);

    setUserExtras(
      userData
        ?.filter((x: any) => x.allowed === true)
        .map((x: any) => x.permission_key) || []
    );

    setUserDenies(
      userData
        ?.filter((x: any) => x.allowed === false)
        .map((x: any) => x.permission_key) || []
    );

    setRoleCompanies(roleCompData?.map((x: any) => x.company_id) || []);

    setCompanyExtras(
      userCompData
        ?.filter((x: any) => x.allowed === true)
        .map((x: any) => x.company_id) || []
    );

    setCompanyDenies(
      userCompData
        ?.filter((x: any) => x.allowed === false)
        .map((x: any) => x.company_id) || []
    );

    const guideIds = userGuides?.map((g: any) => g.guide_id) || [];

    if (userId !== selectedUserId) return;

    setSelectedGuides([...guideIds]);
    setLoading(false);
  }

  const finalPerms = useMemo(() => {
    const base = new Set(rolePerms);
    userExtras.forEach((k) => base.add(k));
    userDenies.forEach((k) => base.delete(k));
    return Array.from(base);
  }, [rolePerms, userExtras, userDenies]);

  const finalCompanies = useMemo(() => {
    const base = new Set(roleCompanies);
    companyExtras.forEach((c) => base.add(c));
    companyDenies.forEach((c) => base.delete(c));
    return Array.from(base);
  }, [roleCompanies, companyExtras, companyDenies]);

  useEffect(() => {
    if (!finalCompanies || finalCompanies.length === 0) {
      setGuides([]);
      return;
    }

    loadGuides(finalCompanies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalCompanies, selectedUserId]);

  function togglePermission(key: string) {
    const isInRole = rolePerms.includes(key);
    const isExtra = userExtras.includes(key);
    const isDenied = userDenies.includes(key);

    if (isInRole) {
      setUserDenies((prev) =>
        isDenied ? prev.filter((k) => k !== key) : [...prev, key]
      );
      return;
    }

    setUserExtras((prev) =>
      isExtra ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleGuide(id: number) {
    setSelectedGuides((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  function toggleCompany(id: number) {
    const isInRole = roleCompanies.includes(id);
    const isExtra = companyExtras.includes(id);
    const isDenied = companyDenies.includes(id);

    if (isInRole) {
      setCompanyDenies((prev) =>
        isDenied ? prev.filter((c) => c !== id) : [...prev, id]
      );
      return;
    }

    setCompanyExtras((prev) =>
      isExtra ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function save() {
    setLoading(true);
    setMsg(null);

    try {
      const user = users.find((u) => u.user_id === selectedUserId);
      const roleId = user?.role_id;

      if (!roleId) {
        setMsg({ type: "err", text: t.roleNotFound });
        setLoading(false);
        return;
      }

      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", selectedUserId);

      const permRows = [
        ...userExtras.map((k) => ({
          user_id: selectedUserId,
          permission_key: k,
          allowed: true,
        })),
        ...userDenies.map((k) => ({
          user_id: selectedUserId,
          permission_key: k,
          allowed: false,
        })),
      ];

      if (permRows.length > 0) {
        await supabase.from("user_permissions").insert(permRows);
      }

      await supabase
        .from("user_company_access")
        .delete()
        .eq("user_id", selectedUserId);

      const companyRows = [
        ...companyExtras.map((c) => ({
          user_id: selectedUserId,
          company_id: c,
          allowed: true,
        })),
        ...companyDenies.map((c) => ({
          user_id: selectedUserId,
          company_id: c,
          allowed: false,
        })),
      ];

      await supabase
        .from("user_assignable_guides")
        .delete()
        .eq("user_id", selectedUserId);

      if (selectedGuides.length > 0) {
        const insertPayload = selectedGuides.map((guide_id) => ({
          user_id: selectedUserId,
          guide_id,
          company_id: null,
        }));

        const { error } = await supabase
          .from("user_assignable_guides")
          .insert(insertPayload);

        if (error) throw error;
      }

      if (companyRows.length > 0) {
        await supabase.from("user_company_access").insert(companyRows);
      }

      setMsg({ type: "ok", text: t.savedSuccess });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Yadda saxlanılmadı" });
    } finally {
      setLoading(false);
    }
  }

  const filteredPermissions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return permissions;

    return permissions.filter((p) => {
      return (
        p.key.toLowerCase().includes(q) || p.label.toLowerCase().includes(q)
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

  const selectedUser = users.find((u) => u.user_id === selectedUserId);

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
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
              <UserCog size={14} />
              {t.userPermissions}
            </div>

            <h2 className="text-xl font-black text-slate-950">
              {userName(selectedUser)}
            </h2>

            <p className="mt-1 text-sm font-medium text-slate-500">
              User üçün role icazələrinə əlavə və ya istisna override tətbiq
              edin.
            </p>
          </div>

          <div className="min-w-full lg:min-w-[390px]">
            <label className="text-xs font-black uppercase tracking-wide text-slate-400">
              {t.selectUser}
            </label>

            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.ad} {u.soyad}
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
            count={finalPerms.length}
            total={permissions.length}
          >
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t.search}
            />

            <div className="mt-4 space-y-3">
              {sidebarGroups.map((group) => {
                const groupPerms = filteredPermissions.filter((p) =>
                  group.permissions.includes(p.key)
                );

                if (groupPerms.length === 0) return null;

                const isOpen = openGroup === group.title;
                const activeCount = groupPerms.filter((p) =>
                  finalPerms.includes(p.key)
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
                          const isRole = rolePerms.includes(perm.key);
                          const isExtra = userExtras.includes(perm.key);
                          const isDenied = userDenies.includes(perm.key);
                          const active = finalPerms.includes(perm.key);

                          return (
                            <OverrideItem
                              key={perm.key}
                              active={active}
                              title={perm.label}
                              subtitle={perm.key}
                              badge={
                                isDenied
                                  ? "DENY"
                                  : isExtra
                                    ? "EXTRA"
                                    : isRole
                                      ? "ROLE"
                                      : "OFF"
                              }
                              onClick={() => togglePermission(perm.key)}
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
            count={finalCompanies.length}
            total={companies.length}
          >
            <SearchInput
              value={companySearch}
              onChange={setCompanySearch}
              placeholder={t.searchCompany}
            />

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {filteredCompanies.map((company) => {
                const active = finalCompanies.includes(company.id);
                const isRole = roleCompanies.includes(company.id);
                const isExtra = companyExtras.includes(company.id);
                const isDenied = companyDenies.includes(company.id);

                return (
                  <OverrideItem
                    key={company.id}
                    active={active}
                    title={company.name}
                    subtitle={`ID: ${company.id}`}
                    badge={
                      isDenied
                        ? "DENY"
                        : isExtra
                          ? "EXTRA"
                          : isRole
                            ? "ROLE"
                            : "OFF"
                    }
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

            {finalCompanies.length === 0 ? (
              <EmptyMini text="Əvvəl şirkət icazəsi seçin." />
            ) : filteredGuides.length === 0 ? (
              <EmptyMini text={t.employeeNotFound || "İşçi tapılmadı"} />
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
                User üzrə yekun icazələr
              </p>
            </div>

            <div className="space-y-3 p-5">
              <SummaryCard
                icon={LockKeyhole}
                label={t.permissions}
                value={`${finalPerms.length} / ${permissions.length}`}
                tone="green"
              />
              <SummaryCard
                icon={PlusCircle}
                label="Extra"
                value={`${userExtras.length}`}
                tone="blue"
              />
              <SummaryCard
                icon={MinusCircle}
                label="Deny"
                value={`${userDenies.length}`}
                tone="red"
              />
              <SummaryCard
                icon={Building2}
                label={t.companyPermissions}
                value={`${finalCompanies.length} / ${companies.length}`}
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
  tone = "green",
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  tone?: "green" | "blue" | "purple";
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
          active
            ? `${iconTone} border-transparent text-white`
            : "border-slate-300 bg-white text-transparent"
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

function OverrideItem({
  active,
  title,
  subtitle,
  badge,
  tone = "green",
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  badge: "ROLE" | "EXTRA" | "DENY" | "OFF";
  tone?: "green" | "blue";
  onClick: () => void;
}) {
  const badgeClass =
    badge === "DENY"
      ? "bg-red-50 text-red-700"
      : badge === "EXTRA"
        ? "bg-blue-50 text-blue-700"
        : badge === "ROLE"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500";

  const activeTone =
    badge === "DENY"
      ? "border-red-300 bg-red-50"
      : tone === "blue"
        ? "border-blue-300 bg-blue-50"
        : "border-emerald-300 bg-emerald-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]",
        active
          ? activeTone
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      )}
    >
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

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black",
          badgeClass
        )}
      >
        {badge}
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
  tone: "green" | "blue" | "purple" | "red";
}) {
  const cls =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "purple"
        ? "bg-violet-50 text-violet-700"
        : tone === "red"
          ? "bg-red-50 text-red-700"
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