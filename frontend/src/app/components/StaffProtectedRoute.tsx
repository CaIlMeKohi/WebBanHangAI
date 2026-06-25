import { Navigate } from "react-router";

import { useAdminAuth } from "../context/AdminAuthContext";

export function StaffProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthReady, isLoggedIn, role } = useAdminAuth();

  if (!isAuthReady) return <div className="p-8 text-sm text-neutral-500">Đang kiểm tra đăng nhập...</div>;
  if (!isLoggedIn) return <Navigate to="/login?next=%2Fstaff" replace />;
  if (role !== "staff" && role !== "admin") return <Navigate to="/shop" replace />;
  return <>{children}</>;
}
