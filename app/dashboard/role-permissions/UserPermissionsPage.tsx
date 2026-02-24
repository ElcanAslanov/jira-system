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

export default function UserPermissionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [userExtras, setUserExtras] = useState<string[]>([]);
  const [userDenies, setUserDenies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // 🔥 NEW: whole permission section toggle
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(true);

  /* ================= SIDEBAR ORDER ================= */

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

    setUsers(usersData || []);
    setPermissions(permsData || []);

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

    const { data: roleData } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_id", roleId);

    const { data: userData } = await supabase
      .from("user_permissions")
      .select("permission_key,allowed")
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

    setLoading(false);
  }

  /* ================= FINAL PERMISSIONS ================= */

  const finalPerms = useMemo(() => {
    const base = new Set(rolePerms);
    userExtras.forEach((k) => base.add(k));
    userDenies.forEach((k) => base.delete(k));
    return Array.from(base);
  }, [rolePerms, userExtras, userDenies]);

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

  /* ================= SAVE ================= */

  async function save() {
    setLoading(true);

    await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", selectedUserId);

    const rows = [
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

    if (rows.length > 0) {
      await supabase.from("user_permissions").insert(rows);
    }

    alert("User permissions saved ✅");
    setLoading(false);
  }

  /* ================= SEARCH ================= */

  const filteredPerms = useMemo(() => {
    if (!search) return permissions;
    return permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(search.toLowerCase()) ||
        p.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [permissions, search]);

  function getStatus(key: string) {
    if (userDenies.includes(key)) return "DENY";
    if (userExtras.includes(key)) return "EXTRA";
    if (rolePerms.includes(key)) return "ROLE";
    return "";
  }

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

      {/* PERMISSIONS */}
      <div style={{ ...card, marginTop: 24 }}>

        {/* 🔥 CLICKABLE HEADER */}
        <div
          onClick={() => setIsPermissionsOpen(!isPermissionsOpen)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <b>📌 Yetkilər</b>

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

        {/* 🔥 COLLAPSIBLE CONTENT */}
        {isPermissionsOpen && (
          <>
            <input
              placeholder="🔍 Axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ marginTop: 20 }}>
              {sidebarGroups.map((group) => {
                const groupPerms = filteredPerms.filter((p) =>
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
                          const status = getStatus(perm.key);
                          const active =
                            finalPerms.includes(perm.key);

                          let bg = "#fff";
                          let border = "1px solid #e5e7eb";
                          let color = "#111";

                          if (status === "ROLE") {
                            bg = "#e0f2fe";
                            border = "1px solid #0284c7";
                          }
                          if (status === "EXTRA") {
                            bg = "#dcfce7";
                            border = "1px solid #16a34a";
                          }
                          if (status === "DENY") {
                            bg = "#fee2e2";
                            border = "1px solid #dc2626";
                            color = "#991b1b";
                          }

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
                                background: bg,
                                border,
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                fontWeight: 700,
                                fontSize: 13,
                                color,
                                textDecoration:
                                  status === "DENY"
                                    ? "line-through"
                                    : "none",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                readOnly
                              />

                              <div style={{ flex: 1 }}>
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

                              {status && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 900,
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    background:
                                      status === "ROLE"
                                        ? "#bae6fd"
                                        : status === "EXTRA"
                                        ? "#bbf7d0"
                                        : "#fecaca",
                                  }}
                                >
                                  {status}
                                </span>
                              )}
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