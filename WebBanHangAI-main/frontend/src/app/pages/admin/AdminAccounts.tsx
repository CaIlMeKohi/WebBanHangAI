import { useEffect, useMemo, useState } from "react";
import { Edit2, Trash2 } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

type RoleFilter = "all" | "customer" | "staff" | "admin";

type AdminUser = {
  user_id: number;
  email: string;
  phone?: string;
  role: RoleFilter;
  account_status: string;
  must_change_password?: boolean;
  created_at?: string;
};

function authHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("siteAuth") ?? localStorage.getItem("adminAuth");
    const access = raw ? (JSON.parse(raw) as { access?: string }).access : "";
    return access ? { Authorization: `Bearer ${access}` } : {};
  } catch {
    return {};
  }
}

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `API ${response.status}`);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

function unwrapUsers(value: AdminUser[] | { results?: AdminUser[] }) {
  return Array.isArray(value) ? value : value.results ?? [];
}

export function AdminAccounts() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [role, setRole] = useState<RoleFilter>("all");
  const [message, setMessage] = useState("");

  const filteredUsers = useMemo(
    () => users.filter((user) => role === "all" || user.role === role),
    [role, users],
  );

  async function loadUsers() {
    const data = await api<AdminUser[] | { results?: AdminUser[] }>("/admin/users/");
    setUsers(unwrapUsers(data));
  }

  useEffect(() => {
    loadUsers().catch((error) => setMessage(error.message));
  }, []);

  async function toggleUser(user: AdminUser) {
    const locked = user.account_status === "locked";
    await api(`/admin/users/${user.user_id}/${locked ? "unlock" : "lock"}`, {
      method: "PUT",
      body: "{}",
    });
    setMessage(locked ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
    await loadUsers();
  }

  async function editUser(user: AdminUser) {
    const email = prompt("Email", user.email);
    const phone = prompt("Số điện thoại", user.phone ?? "");
    const role = prompt("Role: customer, staff hoặc admin", user.role);
    const accountStatus = prompt("Trạng thái: active, locked, inactive hoặc pending_verification", user.account_status);
    if (!email || !role || !accountStatus) return;
    await api(`/admin/users/${user.user_id}`, {
      method: "PUT",
      body: JSON.stringify({ email, phone, role, account_status: accountStatus }),
    });
    setMessage("Đã sửa tài khoản");
    await loadUsers();
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Xóa tài khoản ${user.email}? Tài khoản sẽ bị vô hiệu hóa để giữ lịch sử dữ liệu.`)) return;
    await api(`/admin/users/${user.user_id}`, { method: "DELETE" });
    setMessage("Đã xóa tài khoản");
    await loadUsers();
  }

  async function createStaff() {
    const email = prompt("Email nhân viên/admin");
    const password = prompt("Mật khẩu tạm thời tối thiểu 12 ký tự");
    const nextRole = prompt("Role: staff hoặc admin", "staff") ?? "staff";
    if (!email || !password) return;
    await api("/admin/staffs", {
      method: "POST",
      body: JSON.stringify({ email, password, role: nextRole, full_name: email }),
    });
    setMessage("Đã tạo tài khoản");
    await loadUsers();
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">Quản lý tài khoản</h1>
            <p className="text-sm text-neutral-500">Lọc customer, nhân viên và admin; khóa/mở khóa tài khoản theo nghiệp vụ.</p>
          </div>
          <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={createStaff}>
            Tạo nhân viên/admin
          </button>
        </header>

        {message && <div className="rounded-md border bg-white p-3 text-sm">{message}</div>}

        <section className="rounded-lg border bg-white p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {(["all", "customer", "staff", "admin"] as RoleFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setRole(item)}
                className={`rounded-md border px-3 py-2 text-sm ${role === item ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200"}`}
              >
                {item === "all" ? "Tất cả" : item}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-neutral-500">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">SĐT</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Đổi mật khẩu</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} className="border-b">
                    <td className="px-3 py-2">{user.user_id}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.phone || ""}</td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2">{user.account_status}</td>
                    <td className="px-3 py-2">{user.must_change_password ? "Có" : "Không"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {user.account_status !== "inactive" && (
                          <button className="rounded border px-3 py-1" onClick={() => toggleUser(user)}>
                            {user.account_status === "locked" ? "Mở khóa" : "Khóa"}
                          </button>
                        )}
                        <button className="rounded border p-2 text-blue-600" onClick={() => editUser(user)} title="Sửa tài khoản">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.account_status !== "inactive" && (
                          <button className="rounded border p-2 text-red-600" onClick={() => deleteUser(user)} title="Xóa tài khoản">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredUsers.length && (
                  <tr>
                    <td className="px-3 py-6 text-neutral-500" colSpan={7}>Không có tài khoản phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
