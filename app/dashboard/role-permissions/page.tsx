"use client";

import { useState } from "react";
import RolePermissionsPage from "./RolePermissionsPage";
import UserPermissionsPage from "./UserPermissionsPage";

import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

export default function RolePermissionHub() {
  const [mode, setMode] = useState<"role" | "user">("role");

  const { lang } = useLang();
  const t = translations[lang];

  return (
    <div style={{ padding: 28, maxWidth: 1400, margin: "0 auto" }}>
      
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>
        🔐 {t.permissionManagement}
      </h1>

      <p style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
        {t.permissionManagementDesc}
      </p>

      {/* Toggle */}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button
          onClick={() => setMode("role")}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            fontWeight: 900,
            cursor: "pointer",
            background: mode === "role" ? "#16a34a" : "#e5e7eb",
            color: mode === "role" ? "#fff" : "#111827",
          }}
        >
          {t.rolePermissions}
        </button>

        <button
          onClick={() => setMode("user")}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            fontWeight: 900,
            cursor: "pointer",
            background: mode === "user" ? "#16a34a" : "#e5e7eb",
            color: mode === "user" ? "#fff" : "#111827",
          }}
        >
          {t.userPermissions}
        </button>
      </div>

      <div style={{ marginTop: 28 }}>
        {mode === "role" ? <RolePermissionsPage /> : <UserPermissionsPage />}
      </div>
    </div>
  );
}