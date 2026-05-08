import { ProtectedRoute } from "../components/ProtectedRoute";
import { ProductAdmin } from "../components/ProductAdmin";

export function AdminProductsRoute() {
  return (
    <ProtectedRoute>
      <ProductAdmin />
    </ProtectedRoute>
  );
}
