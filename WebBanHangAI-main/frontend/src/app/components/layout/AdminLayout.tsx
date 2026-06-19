import { Link, Outlet, useNavigate } from "react-router";
import {
  BarChart3,
  Home,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  TicketPercent,
  Users,
} from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { ProtectedRoute } from "../ProtectedRoute";

export function AdminLayout() {
  const navigate = useNavigate();
  const { logout, username, role } = useAdminAuth();

  const handleLogout = () => {
    logout();
    navigate("/portal-admin/login");
  };

  return (
    <ProtectedRoute>
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
              to="/portal-admin"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Trang chủ</span>
            </Link>

            <Link
              to="/portal-admin/products"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Package className="w-5 h-5" />
              <span>Sản phẩm</span>
            </Link>

            <Link
              to="/portal-admin/accounts"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Users className="w-5 h-5" />
              <span>Tài khoản</span>
            </Link>

            <Link
              to="/portal-admin/orders"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <ReceiptText className="w-5 h-5" />
              <span>Đơn hàng</span>
            </Link>

            <Link
              to="/portal-admin/coupons"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <TicketPercent className="w-5 h-5" />
              <span>Coupon</span>
            </Link>

            <Link
              to="/portal-admin/operations"
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
    </ProtectedRoute>
  );
}
