import { ProtectedRoute } from "../../components/ProtectedRoute";
import { ProductAdmin } from "../../components/admin/ProductAdmin";

export function AdminProductsRoute() {
  return (
    <ProtectedRoute>
      <ProductAdmin />
    </ProtectedRoute>
  );
}
