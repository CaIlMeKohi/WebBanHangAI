import { Link, Outlet, useNavigate } from "react-router";
import { LogOut, Package, Settings } from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";

export function AdminLayout() {
  const navigate = useNavigate();
  const { logout, username, role } = useAdminAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900 dark:bg-neutral-950 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-neutral-400 text-sm mt-2">
            Đăng nhập: {username} {role ? `(${role})` : ""}
          </p>
        </div>

        <nav className="space-y-2 px-4">
          <Link
            to="/admin/products"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Package className="w-5 h-5" />
            <span>Products</span>
          </Link>

          <Link
            to="/admin/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors text-red-400"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
