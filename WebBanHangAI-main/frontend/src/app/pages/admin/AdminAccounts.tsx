import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Edit2, Eye, EyeOff, History, Lock, Trash2, Unlock } from "lucide-react";

import { AdminAuditHistoryModal } from "../../components/admin/AdminAuditHistoryModal";
import { fetchAdminAuditLogs, type AdminProductHistoryItem } from "../../lib/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

type RoleFilter = "all" | "customer" | "staff" | "admin";
type AccountStatus = "active" | "locked" | "inactive" | "pending_verification";

type AdminUser = {
  user_id: number;
  email: string;
  phone?: string;
  role: RoleFilter;
  account_status: AccountStatus;
  must_change_password?: boolean;
  created_at?: string;
};

type AccountForm = {
  email: string;
  phone: string;
  role: "customer" | "staff" | "admin";
  account_status: AccountStatus;
  password: string;
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
    const validationMessage = Object.entries(data)
      .filter(([key]) => key !== "detail")
      .flatMap(([field, messages]) =>
        (Array.isArray(messages) ? messages : [messages]).map(
          (message) => `${field}: ${String(message)}`,
        ),
      )
      .join(" ");
    throw new Error(data.detail || validationMessage || `API ${response.status}`);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

function unwrapUsers(value: AdminUser[] | { results?: AdminUser[] }) {
  return Array.isArray(value) ? value : value.results ?? [];
}

const emptyForm: AccountForm = {
  email: "",
  phone: "",
  role: "staff",
  account_status: "active",
  password: "",
};

export function AdminAccounts() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [role, setRole] = useState<RoleFilter>("all");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "lock" | "unlock";
    user: AdminUser;
  } | null>(null);
  const [historyItems, setHistoryItems] = useState<AdminProductHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);

  const filteredUsers = useMemo(
    () => users.filter((user) => role === "all" || user.role === role),
    [role, users],
  );

  async function loadUsers() {
    const data = await api<AdminUser[] | { results?: AdminUser[] }>("/admin/users/");
    setUsers(unwrapUsers(data));
  }

  useEffect(() => {
    loadUsers().catch((err) => setError(err instanceof Error ? err.message : "Không tải được tài khoản"));
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setShowTemporaryPassword(false);
    setSelectedUser(null);
    setFormMode("create");
    setModalError("");
  }

  function openEdit(user: AdminUser) {
    setSelectedUser(user);
    setForm({
      email: user.email,
      phone: user.phone ?? "",
      role: user.role === "all" ? "customer" : user.role,
      account_status: user.account_status,
      password: "",
    });
    setFormMode("edit");
    setModalError("");
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    if (
      formMode === "create" &&
      (form.password.length < 12 ||
        !/[A-Z]/.test(form.password) ||
        !/[a-z]/.test(form.password) ||
        !/\d/.test(form.password) ||
        !/[^A-Za-z0-9]/.test(form.password))
    ) {
      setModalError("Mật khẩu phải có ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.");
      return;
    }
    try {
      if (formMode === "create") {
        await api("/admin/staffs", {
          method: "POST",
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            role: form.role === "admin" ? "admin" : "staff",
            full_name: form.email,
          }),
        });
      } else if (formMode === "edit" && selectedUser) {
        await api(`/admin/users/${selectedUser.user_id}`, {
          method: "PUT",
          body: JSON.stringify({
            email: form.email,
            phone: form.phone,
            role: form.role,
            account_status: form.account_status,
          }),
        });
      }
      setFormMode(null);
      await loadUsers();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Không lưu được tài khoản");
    }
  }

  async function runConfirmAction() {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === "delete") {
        await api(`/admin/users/${confirmAction.user.user_id}`, { method: "DELETE" });
      } else {
        const locked = confirmAction.type === "unlock";
        await api(`/admin/users/${confirmAction.user.user_id}/${locked ? "unlock" : "lock"}`, {
          method: "PUT",
          body: "{}",
        });
      }
      setConfirmAction(null);
      await loadUsers();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
    }
  }

  async function openHistory() {
    setIsHistoryOpen(true);
    setHistoryItems([]);
    setIsHistoryLoading(true);
    try {
      setHistoryItems(await fetchAdminAuditLogs({ entity_type: "user" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch sử chỉnh sửa");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">Quản lý tài khoản</h1>
            <p className="text-sm text-neutral-500">Lọc khách hàng, nhân viên và admin; khóa/mở khóa tài khoản theo nghiệp vụ.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-md border px-4 py-2" onClick={openHistory}>
              <History className="h-4 w-4" />
              Xem lịch sử chỉnh sửa
            </button>
            <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={openCreate}>
              Tạo nhân viên/admin
            </button>
          </div>
        </header>

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

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
                          <button
                            className="rounded border p-2"
                            onClick={() => setConfirmAction({ type: user.account_status === "locked" ? "unlock" : "lock", user })}
                            title={user.account_status === "locked" ? "Mở khóa" : "Khóa"}
                          >
                            {user.account_status === "locked" ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                        )}
                        <button className="rounded border p-2 text-blue-600" onClick={() => openEdit(user)} title="Sửa tài khoản">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.account_status !== "inactive" && (
                          <button className="rounded border p-2 text-red-600" onClick={() => setConfirmAction({ type: "delete", user })} title="Xóa tài khoản">
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

      {formMode && (
        <Modal title={formMode === "create" ? "Tạo nhân viên/admin" : `Sửa tài khoản #${selectedUser?.user_id}`} onClose={() => setFormMode(null)}>
          <form className="space-y-4" onSubmit={submitForm}>
            {modalError && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</div>}
            <label className="block space-y-1 text-sm">
              <span>Email</span>
              <input className="w-full rounded border px-3 py-2" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            </label>
            {formMode === "edit" && (
              <label className="block space-y-1 text-sm">
                <span>Số điện thoại</span>
                <input className="w-full rounded border px-3 py-2" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
            )}
            <label className="block space-y-1 text-sm">
              <span>Role</span>
              <select className="w-full rounded border px-3 py-2" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AccountForm["role"] })}>
                {formMode === "edit" && <option value="customer">customer</option>}
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </label>
            {formMode === "edit" ? (
              <label className="block space-y-1 text-sm">
                <span>Trạng thái</span>
                <select className="w-full rounded border px-3 py-2" value={form.account_status} onChange={(event) => setForm({ ...form, account_status: event.target.value as AccountStatus })}>
                  <option value="active">active</option>
                  <option value="locked">locked</option>
                  <option value="inactive">inactive</option>
                  <option value="pending_verification">pending_verification</option>
                </select>
              </label>
            ) : (
              <label className="block space-y-1 text-sm">
                <span>Mật khẩu tạm thời</span>
                <div className="relative">
                  <input
                    className="w-full rounded border px-3 py-2 pr-11"
                    type={showTemporaryPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required
                    minLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTemporaryPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-500 hover:text-neutral-950"
                    aria-label={showTemporaryPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    title={showTemporaryPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showTemporaryPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <small className="block text-neutral-500">Tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded border px-4 py-2" onClick={() => setFormMode(null)}>Hủy</button>
              <button type="submit" className="rounded bg-neutral-950 px-4 py-2 text-white">Lưu</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmAction && (
        <Modal title="Xác nhận thao tác" onClose={() => setConfirmAction(null)}>
          <div className="space-y-4">
            {modalError && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</div>}
            <p className="text-sm text-neutral-700">
              {confirmAction.type === "delete"
                ? `Xóa tài khoản "${confirmAction.user.email}" hay không? Tài khoản sẽ bị vô hiệu hóa để giữ lịch sử dữ liệu.`
                : `${confirmAction.type === "lock" ? "Khóa" : "Mở khóa"} tài khoản "${confirmAction.user.email}" hay không?`}
            </p>
            <div className="flex justify-end gap-2">
              <button className="rounded border px-4 py-2" onClick={() => setConfirmAction(null)}>Hủy</button>
              <button className="rounded bg-neutral-950 px-4 py-2 text-white" onClick={runConfirmAction}>Xác nhận</button>
            </div>
          </div>
        </Modal>
      )}
      {isHistoryOpen && (
        <AdminAuditHistoryModal
          title="Lịch sử chỉnh sửa tài khoản"
          items={historyItems}
          isLoading={isHistoryLoading}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </main>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100" onClick={onClose}>Đóng</button>
        </div>
        {children}
      </div>
    </div>
  );
}
