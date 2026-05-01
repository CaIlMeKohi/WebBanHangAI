import { Navigate } from "react-router";
import { useAdminAuth } from "../context/AdminAuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoggedIn, role } = useAdminAuth();

  if (!isLoggedIn || role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
