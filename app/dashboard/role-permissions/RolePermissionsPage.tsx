"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown } from "lucide-react";

type Role = { id: string; name: string };
type Perm = { key: string; label: string };

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Perm[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // 🔥 NEW → whole permission section toggle
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(true);

  /* ================= SIDEBAR ORDER ================= */

  const sidebarGroups = [
    {
  title: "Dashboard",
  permissions: [
    "admin_dashboard.view",
    "rehber_dashboard.view",
    "boss_dashboard.view",
    "employee_dashboard.view",
  ],
},
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
    async function load() {
      const { data: rolesData } = await supabase
        .from("roles")
        .select("id,name")
        .order("name");

      const { data: permData } = await supabase
        .from("permissions")
        .select("key,label");

      setRoles(rolesData || []);
      setPermissions(permData || []);

      if (rolesData?.length) {
        setSelectedRole(rolesData[0].id);
      }
    }

    load();
  }, []);

  /* ================= LOAD ROLE PERMISSIONS ================= */

  useEffect(() => {
    if (!selectedRole) return;

    async function loadRolePerms() {
      const { data } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", selectedRole);

      setSelectedPerms(
        (data || []).map((p: any) => p.permission_key)
      );
    }

    loadRolePerms();
  }, [selectedRole]);

  /* ================= TOGGLE ================= */

  function toggle(key: string) {
    setSelectedPerms((prev) =>
      prev.includes(key)
        ? prev.filter((p) => p !== key)
        : [...prev, key]
    );
  }

  /* ================= SAVE ================= */

  async function save() {
    if (!selectedRole) return;

    setLoading(true);

    await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", selectedRole);

    if (selectedPerms.length > 0) {
      await supabase.from("role_permissions").insert(
        selectedPerms.map((key) => ({
          role_id: selectedRole,
          permission_key: key,
        }))
      );
    }

    setLoading(false);
    alert("Yadda saxlanıldı ✅");
  }

  /* ================= SEARCH ================= */

  const filtered = useMemo(() => {
    if (!search) return permissions;
    return permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(search.toLowerCase()) ||
        p.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [permissions, search]);

  /* ================= UI ================= */

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ROLE SELECT */}
      <div style={card}>
        <b>Rol seç</b>

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

      {/* PERMISSIONS CARD */}
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
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              Seçilən: <b>{selectedPerms.length}</b> / {permissions.length}
            </span>

            <input
              placeholder="🔍 Axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ marginTop: 20 }}>
              {sidebarGroups.map((group) => {
                const groupPerms = filtered.filter((p) =>
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
                          const active =
                            selectedPerms.includes(perm.key);

                          return (
                            <div
                              key={perm.key}
                              onClick={() => toggle(perm.key)}
                              style={{
                                padding: "10px 14px",
                                borderRadius: 10,
                                cursor: "pointer",
                                background: active
                                  ? "#dcfce7"
                                  : "#ffffff",
                                border: active
                                  ? "1px solid #16a34a"
                                  : "1px solid #e5e7eb",
                                marginBottom: 8,
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