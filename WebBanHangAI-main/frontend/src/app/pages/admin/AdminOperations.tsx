import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

function authHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("siteAuth") ?? localStorage.getItem("adminAuth");
    const access = raw ? (JSON.parse(raw) as { access?: string }).access : "";
    return access ? { Authorization: `Bearer ${access}` } : {};
  } catch {
    return {};
  }
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `API ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function AdminOperations() {
  const [users, setUsers] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [bestProducts, setBestProducts] = useState<any[]>([]);
  const [bestBrands, setBestBrands] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const [nextUsers, nextRevenue, nextProducts, nextBrands, nextReco] = await Promise.all([
      api("/admin/users/"),
      api("/admin/reports/revenue"),
      api("/admin/reports/best-products"),
      api("/admin/reports/best-brands"),
      api("/admin/reports/recommendations"),
    ]);
    setUsers(nextUsers);
    setRevenue(nextRevenue);
    setBestProducts(nextProducts);
    setBestBrands(nextBrands);
    setRecommendations(nextReco);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function createStaff() {
    const email = prompt("Email nhan vien/admin");
    const password = prompt("Mat khau tam thoi toi thieu 12 ky tu");
    const role = prompt("Role: staff hoac admin", "staff") ?? "staff";
    if (!email || !password) return;
    await api("/admin/staffs", { method: "POST", body: JSON.stringify({ email, password, role, full_name: email }) });
    setMessage("Da tao tai khoan");
    await load();
  }

  async function toggleUser(userId: number, locked: boolean) {
    await api(`/admin/users/${userId}/${locked ? "unlock" : "lock"}`, { method: "PUT", body: "{}" });
    setMessage(locked ? "Da mo khoa tai khoan" : "Da khoa tai khoan");
    await load();
  }

  async function runRecommendations() {
    const result = await api("/admin/recommendations/run", { method: "POST", body: "{}" });
    setMessage(`Da tao ${result.generated} goi y`);
    await load();
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-neutral-950">Admin Operations</h1>
          <div className="space-x-2">
            <button className="rounded-md border px-4 py-2" onClick={createStaff}>Tao nhan vien</button>
            <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={runRecommendations}>Chay goi y AI</button>
          </div>
        </header>
        {message && <div className="rounded-md border bg-white p-3 text-sm text-neutral-700">{message}</div>}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4"><div className="text-sm text-neutral-500">Impressions</div><div className="text-2xl font-semibold">{recommendations?.impressions ?? 0}</div></div>
          <div className="rounded-lg border bg-white p-4"><div className="text-sm text-neutral-500">Clicks</div><div className="text-2xl font-semibold">{recommendations?.clicks ?? 0}</div></div>
          <div className="rounded-lg border bg-white p-4"><div className="text-sm text-neutral-500">CTR</div><div className="text-2xl font-semibold">{Math.round((recommendations?.ctr ?? 0) * 100)}%</div></div>
          <div className="rounded-lg border bg-white p-4"><div className="text-sm text-neutral-500">Conversions</div><div className="text-2xl font-semibold">{recommendations?.conversions ?? 0}</div></div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Tai khoan</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className="border-t">
                    <td>{user.user_id}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.account_status}</td>
                    <td className="py-2">
                      <button className="rounded border px-2 py-1" onClick={() => toggleUser(user.user_id, user.account_status === "locked")}>
                        {user.account_status === "locked" ? "Mo khoa" : "Khoa"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ReportBlock title="Doanh thu" rows={revenue} />
          <ReportBlock title="San pham ban chay" rows={bestProducts} />
          <ReportBlock title="Brand ban chay" rows={bestBrands} />
        </section>
      </div>
    </main>
  );
}

function ReportBlock({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-2 text-sm">
        {rows.map((row, index) => (
          <div key={index} className="rounded border p-2">
            {Object.entries(row).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <span className="text-neutral-500">{key}</span>
                <span className="font-medium">{String(value ?? "")}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
