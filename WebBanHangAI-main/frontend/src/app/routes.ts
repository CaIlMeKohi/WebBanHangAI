import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/home/Home";
import { ProductListing } from "./pages/catalog/ProductListing";
import { ProductDetail } from "./pages/catalog/ProductDetail";
import { Cart } from "./pages/cart/Cart";
import { Checkout } from "./pages/checkout/Checkout";
import { Profile } from "./pages/profile/Profile";
import { Recommendations } from "./pages/recommendations/Recommendations";
import { NotFound } from "./pages/NotFound";
import { AdminLayout } from "./components/layout/AdminLayout";
import { AdminLogin } from "./pages/auth/AdminLogin";
import { AdminProductsRoute } from "./pages/admin/AdminProductsRoute";
import { RedirectToLogin } from "./pages/auth/RedirectToLogin";
import { RedirectToWishlist } from "./pages/auth/RedirectToWishlist";
import { Register } from "./pages/auth/Register";
import { StaffPortal } from "./pages/staff/StaffPortal";
import { AdminOperations } from "./pages/admin/AdminOperations";
import { AdminAccounts } from "./pages/admin/AdminAccounts";
import { PaymentQr } from "./pages/payment/PaymentQr";
import { MockPaymentGateway } from "./pages/payment/MockPaymentGateway";
import { RouteError } from "./pages/RouteError";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    ErrorBoundary: RouteError,
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
        path: "checkout",
        Component: Checkout,
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
    path: "/portal-admin/login",
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
    path: "/wishlist",
    Component: RedirectToWishlist,
  },
  {
    path: "/payment-gateway",
    Component: MockPaymentGateway,
  },
  {
    path: "/portal-admin",
    Component: AdminLayout,
    ErrorBoundary: RouteError,
    children: [
      {
        path: "products",
        Component: AdminProductsRoute,
      },
      {
        path: "operations",
        Component: AdminOperations,
      },
      {
        path: "accounts",
        Component: AdminAccounts,
      },
    ],
  },
]);
