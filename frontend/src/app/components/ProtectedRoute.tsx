import { Navigate, useLocation } from "react-router";

import { useAdminAuth } from "../context/AdminAuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthReady, isLoggedIn, role } = useAdminAuth();

  if (!isAuthReady) {
    return <div className="p-8 text-sm text-neutral-500">Đang kiểm tra đăng nhập...</div>;
  }

  if (!isLoggedIn) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (role !== "admin") {
    return <Navigate to="/shop" replace />;
  }

  return <>{children}</>;
}
