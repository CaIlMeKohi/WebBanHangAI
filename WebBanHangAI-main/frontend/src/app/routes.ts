import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/home/Home";
import { ProductListing } from "./pages/catalog/ProductListing";
import { ProductDetail } from "./pages/catalog/ProductDetail";
import { Cart } from "./pages/cart/Cart";
import { Profile } from "./pages/profile/Profile";
import { Recommendations } from "./pages/recommendations/Recommendations";
import { NotFound } from "./pages/NotFound";
import { AdminLayout } from "./components/layout/AdminLayout";
import { AdminLogin } from "./pages/auth/AdminLogin";
import { AdminProductsRoute } from "./pages/admin/AdminProductsRoute";
import { RedirectToLogin } from "./pages/auth/RedirectToLogin";
import { Register } from "./pages/auth/Register";
import { StaffPortal } from "./pages/staff/StaffPortal";
import { AdminOperations } from "./pages/admin/AdminOperations";
import { PaymentQr } from "./pages/payment/PaymentQr";
import { MockPaymentGateway } from "./pages/payment/MockPaymentGateway";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      {
        index: true,
        Component: Home,
      },
      {
        path: "shop",
        Component: ProductListing,
      },
      {
        path: "product/:id",
        Component: ProductDetail,
      },
      {
        path: "cart",
        Component: Cart,
      },
      {
        path: "profile",
        Component: Profile,
      },
      {
        path: "danh-cho-ban",
        Component: Recommendations,
      },
      {
        path: "staff",
        Component: StaffPortal,
      },
      {
        path: "payment/qr",
        Component: PaymentQr,
      },
      {
        path: "*",
        Component: NotFound,
      },
    ],
  },
  {
    path: "/admin/login",
    Component: RedirectToLogin,
  },
  {
    path: "/login",
    Component: AdminLogin,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/payment-gateway",
    Component: MockPaymentGateway,
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      {
        path: "products",
        Component: AdminProductsRoute,
      },
      {
        path: "operations",
        Component: AdminOperations,
      },
    ],
  },
]);
