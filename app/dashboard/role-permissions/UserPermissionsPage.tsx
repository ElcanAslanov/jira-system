"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown } from "lucide-react";

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

export default function UserPermissionsPage() {
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
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(true);
  const [isCompaniesOpen, setIsCompaniesOpen] = useState(true);

  /* ================= SIDEBAR GROUPS ================= */

  const sidebarGroups = [
    {
      title: "İşçilər",
      permissions: ["employees.view", "employees.create"],
    },
    {
      title: "Struktur",
      permissions: [
        "companies.view",
        "departments.view",
        "positions.view",
        "roles.view",
      ],
    },
    {
      title: "Tapşırıqlar",
      permissions: ["tasks.view", "tasks.create"],
    },
    {
      title: "Dövrlü Tapşırıqlar",
      permissions: ["recurring.view", "recurring.create"],
    },
    {
      title: "Yetkilər",
      permissions: ["role_permissions.view"],
    },
    {
      title: "Parametrlər",
      permissions: ["settings.view"],
    },
  ];

  /* ================= LOAD INITIAL ================= */

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    const { data: usersData } = await supabase
      .from("employees")
      .select("user_id,ad,soyad,email,role_id")
      .not("user_id", "is", null)
      .order("ad");

    const { data: permsData } = await supabase
      .from("permissions")
      .select("key,label");

    const { data: companyData } = await supabase
      .from("companies")
      .select("id,name")
      .order("name");

    setUsers(usersData || []);
    setPermissions(permsData || []);
    setCompanies(companyData || []);

    if (usersData?.length) {
      setSelectedUserId(usersData[0].user_id);
    }
  }

  /* ================= LOAD ROLE + USER PERMS ================= */

  useEffect(() => {
    if (!selectedUserId) return;

    const user = users.find((u) => u.user_id === selectedUserId);
    if (!user) return;

    loadPermissions(user.role_id);
  }, [selectedUserId, users]);

  async function loadPermissions(roleId: string) {
    setLoading(true);

    // ROLE PERMS
    const { data: roleData } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_id", roleId);

    // USER PERMS
    const { data: userData } = await supabase
      .from("user_permissions")
      .select("permission_key,allowed")
      .eq("user_id", selectedUserId);

    // ROLE COMPANIES
    const { data: roleCompData } = await supabase
      .from("role_company_access")
      .select("company_id")
      .eq("role_id", roleId);

    // USER COMPANIES
    const { data: userCompData } = await supabase
      .from("user_company_access")
      .select("company_id,allowed")
      .eq("user_id", selectedUserId);

    setRolePerms(roleData?.map((x: any) => x.permission_key) || []);

    setUserExtras(
      userData?.filter((x: any) => x.allowed === true)
        .map((x: any) => x.permission_key) || []
    );

    setUserDenies(
      userData?.filter((x: any) => x.allowed === false)
        .map((x: any) => x.permission_key) || []
    );

    setRoleCompanies(
      roleCompData?.map((x: any) => x.company_id) || []
    );

    setCompanyExtras(
      userCompData?.filter((x: any) => x.allowed === true)
        .map((x: any) => x.company_id) || []
    );

    setCompanyDenies(
      userCompData?.filter((x: any) => x.allowed === false)
        .map((x: any) => x.company_id) || []
    );

    setLoading(false);
  }

  /* ================= FINAL PERMISSIONS ================= */

  const finalPerms = useMemo(() => {
    const base = new Set(rolePerms);
    userExtras.forEach((k) => base.add(k));
    userDenies.forEach((k) => base.delete(k));
    return Array.from(base);
  }, [rolePerms, userExtras, userDenies]);

  /* ================= FINAL COMPANIES ================= */

  const finalCompanies = useMemo(() => {
    const base = new Set(roleCompanies);
    companyExtras.forEach((c) => base.add(c));
    companyDenies.forEach((c) => base.delete(c));
    return Array.from(base);
  }, [roleCompanies, companyExtras, companyDenies]);

  /* ================= TOGGLE ================= */

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

  /* ================= SAVE ================= */

  async function save() {
    setLoading(true);

    // PERMISSIONS
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

    // COMPANIES
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

    if (companyRows.length > 0) {
      await supabase.from("user_company_access").insert(companyRows);
    }

    alert("User permissions + company access saved ✅");
    setLoading(false);
  }

  /* ================= SEARCH ================= */

  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companies;
    return companies.filter((c) =>
      c.name.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [companies, companySearch]);

  /* ================= UI ================= */

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      {/* USER SELECT */}
      <div style={{ ...card, marginTop: 20 }}>
        <b>User seç</b>

        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{ ...input, marginTop: 12 }}
        >
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.ad} {u.soyad}
            </option>
          ))}
        </select>
      </div>

      {/* ================= PERMISSIONS ================= */}

<div style={{ ...card, marginTop: 24 }}>
  <div
    onClick={() => setIsPermissionsOpen(!isPermissionsOpen)}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer",
    }}
  >
    <b>📌 Əsas Yetkilər</b>
    <ChevronDown
      size={18}
      style={{
        transition: "0.2s",
        transform: isPermissionsOpen
          ? "rotate(180deg)"
          : "rotate(0deg)",
      }}
    />
  </div>

  {isPermissionsOpen && (
    <>
      <div style={{ marginTop: 16 }}>
        {sidebarGroups.map((group) => {
          const groupPerms = permissions.filter((p) =>
            group.permissions.includes(p.key)
          );

          if (groupPerms.length === 0) return null;

          const isOpen = openGroup === group.title;

          return (
            <div key={group.title} style={{ marginBottom: 16 }}>
              <div
                onClick={() =>
                  setOpenGroup(isOpen ? null : group.title)
                }
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 14,
                  padding: "8px 0",
                }}
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
                    const active = finalPerms.includes(
                      perm.key
                    );

                    return (
                      <div
                        key={perm.key}
                        onClick={() =>
                          togglePermission(perm.key)
                        }
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          marginBottom: 8,
                          cursor: "pointer",
                          background: active
                            ? "#dcfce7"
                            : "#fff",
                          border: active
                            ? "1px solid #16a34a"
                            : "1px solid #e5e7eb",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          readOnly
                        />
                        <div>
                          {perm.label}
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.6,
                              fontWeight: 400,
                            }}
                          >
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
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <b>🏢 Şirkət Yetkiləri</b>
          <ChevronDown
            size={18}
            style={{
              transition: "0.2s",
              transform: isCompaniesOpen
                ? "rotate(180deg)"
                : "rotate(0deg)",
            }}
          />
        </div>

        {isCompaniesOpen && (
          <>
            <input
              placeholder="🔍 Şirkət axtar..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ marginTop: 16 }}>
              {filteredCompanies.map((company) => {
                const active = finalCompanies.includes(company.id);

                return (
                  <div
                    key={company.id}
                    onClick={() => toggleCompany(company.id)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      marginBottom: 8,
                      cursor: "pointer",
                      background: active ? "#dbeafe" : "#fff",
                      border: active
                        ? "1px solid #2563eb"
                        : "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      readOnly
                    />
                    {company.name}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <button
        onClick={save}
        disabled={loading}
        style={{ ...button, marginTop: 24 }}
      >
        {loading ? "Saving..." : "💾 Save"}
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