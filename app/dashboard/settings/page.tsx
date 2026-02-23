"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [password, setPassword] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [myPassword, setMyPassword] = useState("");

  // Bütün userləri çək
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const res = await fetch("/api/admin/list-users");
      const result = await res.json();
      setUsers(result.users || []);
    };

    fetchUsers();
  }, []);

  // Öz parolunu dəyiş
  const changeMyPassword = async () => {
    if (myPassword.length < 6) {
      alert("Parol minimum 6 simvol olmalıdır");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: myPassword,
    });

    setLoading(false);

    if (error) alert(error.message);
    else {
      alert("Parol dəyişdirildi");
      setMyPassword("");
    }
  };

  // Başqa userin parolunu dəyiş
  const changeUserPassword = async () => {
    if (!password || password.length < 6) {
      alert("Parol minimum 6 simvol olmalıdır");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/admin/update-password", {
      method: "POST",
      body: JSON.stringify({
        userId: selectedUser.id,
        password,
      }),
    });

    const data = await res.json();

    setLoading(false);

    if (data.error) {
      alert(data.error);
    } else {
      alert("Parol yeniləndi");
      setSelectedUser(null);
      setPassword("");
    }
  };

  return (
    <div className="p-6 space-y-10">

      <h1 className="text-2xl font-bold">Parametrlər</h1>

      {/* Öz Parolu */}
      <div className="bg-white shadow-md rounded-xl p-6 max-w-md space-y-4">
        <h2 className="font-semibold text-lg">Öz Parolunu Dəyiş</h2>
        <input
          type="password"
          placeholder="Yeni parol"
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#e42526]"
          value={myPassword}
          onChange={(e) => setMyPassword(e.target.value)}
        />
        <button
          onClick={changeMyPassword}
          className="bg-[#e42526] hover:bg-[#c81f20] text-white px-4 py-2 rounded-lg"
        >
          Dəyiş
        </button>
      </div>

      {/* User Table */}
      <div className="bg-white shadow-md rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-4">
          Sistem İstifadəçiləri
        </h2>

{/* Desktop Table */}
<div className="hidden md:block overflow-x-auto">
  <table className="w-full border">
    <thead>
      <tr className="bg-gray-100 text-left">
        <th className="p-3 border">Ad</th>
        <th className="p-3 border">Soyad</th>
        <th className="p-3 border">Email</th>
        <th className="p-3 border text-center">Düzəlt</th>
      </tr>
    </thead>
    <tbody>
      {users.map((user) => (
        <tr key={user.id} className="hover:bg-gray-50 transition">
          <td className="p-3 border-b">{user.ad}</td>
          <td className="p-3 border-b">{user.soyad}</td>
          <td className="p-3 border-b text-gray-600">
            {user.email}
          </td>
          <td className="p-3 border-b text-center">
            <button
              onClick={() => setSelectedUser(user)}
              className="bg-[#e42526] hover:bg-[#c81f20] text-white px-3 py-1 rounded-lg text-sm"
            >
              Düzəlt
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Mobile Cards */}
<div className="md:hidden space-y-4">
  {users.map((user) => (
    <div
      key={user.id}
      className="bg-gray-50 border rounded-xl p-4 shadow-sm space-y-3"
    >
      <div>
        <p className="text-xs text-gray-500">Ad</p>
        <p className="font-medium">{user.ad}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500">Soyad</p>
        <p className="font-medium">{user.soyad}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500">Email</p>
        <p className="text-sm text-gray-700 break-all">
          {user.email}
        </p>
      </div>

      <button
        onClick={() => setSelectedUser(user)}
        className="w-full bg-[#e42526] hover:bg-[#c81f20] text-white py-2 rounded-lg text-sm"
      >
        Düzəlt
      </button>
    </div>
  ))}
</div>
      </div>

      {/* Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 space-y-4">
            <h3 className="font-semibold">
              {selectedUser.email} üçün parol dəyiş
            </h3>

            <input
              type="password"
              placeholder="Yeni parol"
              className="w-full border rounded-lg px-4 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 border rounded-lg"
              >
                Ləğv et
              </button>

              <button
                onClick={changeUserPassword}
                className="bg-[#e42526] text-white px-4 py-2 rounded-lg"
              >
                Dəyiş
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}