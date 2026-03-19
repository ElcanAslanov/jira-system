"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

type Role = { id: string; name: string };
type Perm = { key: string; label: string };
type Company = { id: number; name: string };

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
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(true);
  const [isCompaniesOpen, setIsCompaniesOpen] = useState(true);
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
  /* ================= SIDEBAR ORDER ================= */

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
      permissions: [
        "tasks.view",
        "tasks.create",
        "tasks.log.view", // 👈 əlavə
      ],
    },
    {
      title: t.taskButtons,
      permissions: [
        // LIST / BOARD BUTTONS
        "tasks.edit.list",
        "tasks.delete.list",
        "tasks.export.list",
        "tasks.print.list",

        // DRAWER BUTTONS
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

  

  /* ================= LOAD INITIAL ================= */

  useEffect(() => {
    if (!ready) return;

    async function load() {
      const { data: rolesData } = await supabase
        .from("roles")
        .select("id,name")
        .order("name");

      const { data: permData } = await supabase
        .from("permissions")
        .select("key,label");

      const { data: companyData } = await supabase
        .from("companies")
        .select("id,name")
        .order("name");

      setRoles(rolesData || []);
      setPermissions(permData || []);
      setCompanies(companyData || []);

      if (rolesData?.length) {
        setSelectedRole(rolesData[0].id);
      }
    }

    load();
  }, [ready]);

  /* ================= LOAD ROLE DATA ================= */

  useEffect(() => {
    if (!selectedRole) return;

   async function loadRoleData() {
  const { data: perms } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", selectedRole);

  const { data: comps } = await supabase
    .from("role_company_access")
    .select("company_id")
    .eq("role_id", selectedRole);

  const { data: roleGuides } = await supabase
    .from("role_assignable_guides")
    .select("guide_id")
    .eq("role_id", selectedRole);

  setSelectedPerms(
    (perms || []).map((p: any) => p.permission_key)
  );

  setSelectedCompanies(
    (comps || []).map((c: any) => c.company_id)
  );

  setSelectedGuides(
    (roleGuides || []).map((g: any) => g.guide_id)
  );
}

    loadRoleData();
  }, [selectedRole]);

  useEffect(() => {
  if (!selectedCompanies.length) {
    setGuides([]);
    return;
  }

  loadGuides();
}, [selectedCompanies]);

  /* ================= TOGGLE ================= */

  function toggle(key: string) {
    setSelectedPerms((prev) =>
      prev.includes(key)
        ? prev.filter((p) => p !== key)
        : [...prev, key]
    );
  }

  function toggleGuide(id: string) {
  setSelectedGuides(prev =>
    prev.includes(id)
      ? prev.filter(g => g !== id)
      : [...prev, id]
  );
}

  function toggleCompany(id: number) {
    setSelectedCompanies((prev) =>
      prev.includes(id)
        ? prev.filter((c) => c !== id)
        : [...prev, id]
    );
  }

async function loadGuides() {

  const { data } = await supabase
    .from("employees")
    .select(`
      id,
      ad,
      soyad,
      company_id,
      roles!inner(name)
    `)
    .in("company_id", selectedCompanies)
    .eq("roles.name", "REHBER");

  setGuides(data || []);
}

  /* ================= SAVE ================= */

  async function save() {
    if (!selectedRole) return;

    setLoading(true);

    // 1️⃣ permissions delete
    await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", selectedRole);

    // 2️⃣ permissions insert
    if (selectedPerms.length > 0) {
      await supabase.from("role_permissions").insert(
        selectedPerms.map((key) => ({
          role_id: selectedRole,
          permission_key: key,
        }))
      );
    }

    // 3️⃣ companies delete
    await supabase
      .from("role_company_access")
      .delete()
      .eq("role_id", selectedRole);

    // 4️⃣ companies insert
    if (selectedCompanies.length > 0) {
      await supabase.from("role_company_access").insert(
        selectedCompanies.map((company_id) => ({
          role_id: selectedRole,
          company_id,
        }))
      );
    }

    // 5️⃣ rehberləri sil
await supabase
  .from("role_assignable_guides")
  .delete()
  .eq("role_id", selectedRole);

// 6️⃣ rehberləri insert

if (selectedGuides.length > 0) {
 await supabase.from("role_assignable_guides").insert(
  selectedGuides.map((guide_id) => ({
    role_id: selectedRole,
    guide_id,
    company_id: guides.find(g => g.id === guide_id)?.company_id
  }))
);
}

    setLoading(false);
   alert(t.savedSuccess + " ✅");
  }

  /* ================= SEARCH ================= */

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

  /* ================= UI ================= */

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ROLE SELECT */}
      <div style={card}>
        <b>{t.selectRole}</b>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          style={{ ...input, marginTop: 12 }}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* ================= PERMISSIONS ================= */}
      <div style={{ ...card, marginTop: 24 }}>
        <div
          onClick={() => setIsPermissionsOpen(!isPermissionsOpen)}
          style={headerStyle}
        >
          <b>📌 {t.permissions}</b>
          <ChevronDown
            size={18}
            style={{
              transition: "0.2s",
              transform: isPermissionsOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </div>

        {isPermissionsOpen && (
          <>
            <span style={counterText}>
              {t.selected}: <b>{selectedPerms.length}</b> / {permissions.length}
            </span>

            <input
              placeholder={`🔍 ${t.search}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ marginTop: 20 }}>
              {sidebarGroups.map((group) => {
                let groupPerms: Perm[] = [];

                if (group.permissions) {
                  groupPerms = filtered.filter(
                    (p) => p.key && group.permissions!.includes(p.key)
                  );
                }
                if (!group.permissions) return null;
                if (groupPerms.length === 0) return null;

                const isOpen = openGroup === group.title;

                return (
                  <div key={group.title} style={{ marginBottom: 16 }}>
                    <div
                      onClick={() =>
                        setOpenGroup(isOpen ? null : group.title)
                      }
                      style={groupHeader}
                    >
                      {group.title}
                      <ChevronDown
                        size={16}
                        style={{
                          transition: "0.2s",
                          transform: isOpen
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                    </div>

                    {isOpen && (
                      <div style={{ marginTop: 8 }}>
                        {groupPerms.map((perm) => {
                          const active =
                            selectedPerms.includes(perm.key);

                          return (
                            <div
                              key={perm.key}
                              onClick={() => toggle(perm.key)}
                              style={{
                                ...itemBox,
                                background: active
                                  ? "#dcfce7"
                                  : "#ffffff",
                                border: active
                                  ? "1px solid #16a34a"
                                  : "1px solid #e5e7eb",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                readOnly
                              />
                              <div style={{ flex: 1 }}>
                                {perm.label}
                                <div style={keyText}>
                                  {perm.key}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ================= COMPANY ACCESS ================= */}

      <div style={{ ...card, marginTop: 24 }}>
        <div
          onClick={() => setIsCompaniesOpen(!isCompaniesOpen)}
          style={headerStyle}
        >
          <b>🏢 {t.companyPermissions}</b>
          <ChevronDown
            size={18}
            style={{
              transition: "0.2s",
              transform: isCompaniesOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </div>

        {isCompaniesOpen && (
          <>
            <span style={counterText}>
              {t.selected}: <b>{selectedCompanies.length}</b> / {companies.length}
            </span>

            <input
              placeholder={`🔍 ${t.searchCompany}`}
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ marginTop: 16 }}>
              {filteredCompanies.map((company) => {
                const active =
                  selectedCompanies.includes(company.id);

                return (
                  <div
                    key={company.id}
                    onClick={() => toggleCompany(company.id)}
                    style={{
                      ...itemBox,
                      background: active ? "#dbeafe" : "#ffffff",
                      border: active
                        ? "1px solid #2563eb"
                        : "1px solid #e5e7eb",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      readOnly
                    />
                    <div style={{ flex: 1 }}>
                      {company.name}
                      {/* <div style={keyText}>
                        company_id: {company.id}
                      </div> */}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ================= REHBER YETKILERI ================= */}

<div style={{ ...card, marginTop: 24 }}>
<b>👨‍💼 {t.guidePermissions}</b>

  <div style={{ marginTop: 16 }}>
    {guides.map((g) => {

      const active = selectedGuides.includes(g.id);

      return (
        <div
          key={g.id}
          onClick={() => toggleGuide(g.id)}
          style={{
            ...itemBox,
            background: active ? "#ede9fe" : "#ffffff",
            border: active
              ? "1px solid #7c3aed"
              : "1px solid #e5e7eb",
          }}
        >
          <input
            type="checkbox"
            checked={active}
            readOnly
          />

          <div>
            {g.ad} {g.soyad}
          </div>
        </div>
      );
    })}
  </div>
</div>

      <button
        onClick={save}
        disabled={loading}
        style={{ ...button, marginTop: 24 }}
      >
        {loading ? t.saving : `💾 ${t.save}`}
      </button>
    </div>
  );
}

/* ================= STYLES ================= */

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};

const groupHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  padding: "8px 0",
};

const itemBox: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  marginBottom: 8,
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 700,
  fontSize: 13,
};

const keyText: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  fontWeight: 400,
};

const counterText: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 14,
};

const button: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

//burdan sora