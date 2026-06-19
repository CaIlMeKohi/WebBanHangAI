import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Home } from "./pages/home/Home";
import { ProductListing } from "./pages/catalog/ProductListing";
import { ProductDetail } from "./pages/catalog/ProductDetail";
import { Profile } from "./pages/profile/Profile";
import { Recommendations } from "./pages/recommendations/Recommendations";
import { NotFound } from "./pages/NotFound";
import { AdminLayout } from "./components/layout/AdminLayout";
import { AdminLogin } from "./pages/auth/AdminLogin";
import { AdminProductsRoute } from "./pages/admin/AdminProductsRoute";
import { RedirectToLogin } from "./pages/auth/RedirectToLogin";
import { RedirectToWishlist } from "./pages/auth/RedirectToWishlist";
import { RedirectToCart } from "./pages/auth/RedirectToCart";
import { Register } from "./pages/auth/Register";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { StaffPortal } from "./pages/staff/StaffPortal";
import { AdminOperations } from "./pages/admin/AdminOperations";
import { AdminAccounts } from "./pages/admin/AdminAccounts";
import { AdminCoupons } from "./pages/admin/AdminCoupons";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminOrders } from "./pages/admin/AdminOrders";
import { PaymentQr } from "./pages/payment/PaymentQr";
import { MockPaymentGateway } from "./pages/payment/MockPaymentGateway";
import { RouteError } from "./pages/RouteError";
import { ComingSoon } from "./pages/ComingSoon";

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
        Component: RedirectToCart,
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
        path: "payment/qr",
        Component: PaymentQr,
      },
      {
        path: "dang-hoan-thien",
        Component: ComingSoon,
      },
      {
        path: "*",
        Component: NotFound,
      },
    ],
  },
  {
    path: "/staff",
    Component: StaffPortal,
    ErrorBoundary: RouteError,
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
    path: "/forgot-password",
    Component: ForgotPassword,
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
        index: true,
        Component: AdminDashboard,
      },
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
      {
        path: "orders",
        Component: AdminOrders,
      },
      {
        path: "coupons",
        Component: AdminCoupons,
      },
    ],
  },
]);
