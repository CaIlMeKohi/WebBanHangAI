import { Link, useLocation, useNavigate } from "react-router";
import {
  Search,
  ShoppingBag,
  User,
  Heart,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { deleteNotification, fetchCart, fetchNotifications, fetchWishlist, markNotificationRead, type ApiNotification } from "../../lib/api";
import { CART_UPDATED_EVENT, readStoredCart } from "../../lib/cartStorage";
import {
  hasStoredWishlistIds,
  readStoredWishlistIds,
  writeStoredWishlistIds,
  WISHLIST_UPDATED_EVENT,
} from "../../lib/wishlistStorage";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const { isLoggedIn, username, logout, role, userId } = useAdminAuth();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCartCount() {
      if (userId) {
        try {
          const cartItems = await fetchCart(userId);
          if (isMounted) {
            setCartCount(
              cartItems.reduce((sum, item) => sum + item.quantity, 0),
            );
          }
          return;
        } catch {
          // Fall back to local cart count if API is unavailable.
        }
      }

      if (isMounted) {
        setCartCount(
          readStoredCart().reduce((sum, item) => sum + item.quantity, 0),
        );
      }
    }

    async function loadWishlistCount() {
      const localWishlistIds = readStoredWishlistIds();
      if (hasStoredWishlistIds()) {
        if (isMounted) {
          setWishlistCount(localWishlistIds.length);
        }
        return;
      }

      if (userId) {
        try {
          const wishlistItems = await fetchWishlist(userId);
          if (isMounted) {
            setWishlistCount(wishlistItems.length);
          }
          if (wishlistItems.length > 0) {
            writeStoredWishlistIds(
              wishlistItems.map((item) => String(item.product.id)),
            );
          }
          return;
        } catch {
          // Fall back to local wishlist when API unavailable
        }
      }

      if (isMounted) {
        setWishlistCount(0);
      }
    }

    async function loadNotifications() {
      if (!userId) {
        if (isMounted) setNotifications([]);
        return;
      }
      try {
        const items = await fetchNotifications();
        if (isMounted) setNotifications(items);
      } catch {
        if (isMounted) setNotifications([]);
      }
    }

    loadCartCount();
    loadWishlistCount();
    loadNotifications();

    const handleCartUpdated = () => {
      void loadCartCount();
    };

    const handleWishlistUpdated = () => {
      void loadWishlistCount();
    };

    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdated);
    window.addEventListener("storage", handleCartUpdated);
    window.addEventListener(WISHLIST_UPDATED_EVENT, handleWishlistUpdated);
    window.addEventListener("storage", handleWishlistUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdated);
      window.removeEventListener("storage", handleCartUpdated);
      window.removeEventListener(WISHLIST_UPDATED_EVENT, handleWishlistUpdated);
      window.removeEventListener("storage", handleWishlistUpdated);
    };
  }, [userId]);

  const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;

  async function handleNotificationClick(notification: ApiNotification) {
    if (!notification.is_read) {
      setNotifications((current) =>
        current.map((item) =>
          item.notification_id === notification.notification_id
            ? { ...item, is_read: true }
            : item,
        ),
      );
      await markNotificationRead(notification.notification_id).catch(() => undefined);
    }
  }

  async function handleDeleteNotification(notificationId: number) {
    setNotifications((current) =>
      current.filter((item) => item.notification_id !== notificationId),
    );
    await deleteNotification(notificationId).catch(() => undefined);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = searchQuery.trim();
    if (!keyword) return;

    const params = new URLSearchParams();
    params.set("search", keyword);
    navigate(`/shop?${params.toString()}`);
    setSearchQuery("");
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate("/login");
  };

  const authTarget = (target: string) =>
    isLoggedIn ? target : `/login?next=${encodeURIComponent(target)}`;
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const loginTarget = `/login?next=${encodeURIComponent(currentPath || "/")}`;
  const canOpenAdmin = role === "admin";
  const canOpenStaff = role === "staff";

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            to="/"
            className="text-2xl font-light tracking-wider text-neutral-900 dark:text-white"
          >
            BKQ
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/shop?gender=women"
              className="text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              NỮ
            </Link>
            <Link
              to="/shop?gender=men"
              className="text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              NAM
            </Link>
            <Link
              to="/danh-cho-ban"
              className="text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
            >
              <span className="text-blue-600 dark:text-blue-400">*</span>
              DÀNH CHO BẠN
            </Link>
            <Link
              to="/shop?new=true"
              className="text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              HÀNG MỚI
            </Link>
            <Link
              to="/shop?sale=true"
              className="text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              GIẢM GIÁ
            </Link>
          </div>

          <form
            onSubmit={handleSearch}
            className="relative z-20 hidden w-64 flex-none items-center mx-6 md:flex"
          >
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-w-0 pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-sm text-neutral-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:bg-white dark:focus:bg-neutral-900 transition-all"
              />
            </div>
          </form>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              aria-label="Đổi giao diện sáng tối"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <Link
              to={isLoggedIn ? "/profile" : loginTarget}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
              <User className="w-5 h-5" />
            </Link>
            <Link
              to={authTarget("/wishlist")}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors relative"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-600 text-white text-[11px] rounded-full flex items-center justify-center leading-none">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>
            <Link
              to={authTarget("/cart")}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11px] rounded-full flex items-center justify-center leading-none">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationOpen((current) => !current)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors relative"
                aria-label="Thông báo"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-600 text-white text-[11px] rounded-full flex items-center justify-center leading-none">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
              </button>
              {isNotificationOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                    <div className="text-sm font-medium">Thông báo</div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationPanelOpen(true);
                        setIsNotificationOpen(false);
                      }}
                      className="text-xs font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-200"
                    >
                      Xem tất cả
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 8).map((notification) => (
                        <button
                          key={notification.notification_id}
                          type="button"
                          onClick={() => void handleNotificationClick(notification)}
                          className={`block w-full px-4 py-3 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 ${notification.is_read ? "text-neutral-500" : "bg-neutral-50 text-neutral-950 dark:bg-neutral-800/60 dark:text-white"}`}
                        >
                          <div className="font-medium">{notification.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
                            {notification.content}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-neutral-500">
                        Chưa có thông báo
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {isLoggedIn ? (
              <div className="hidden md:flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100">
                  {username}
                  {role ? ` · ${role}` : ""}
                </span>
                {canOpenAdmin && (
                  <Link
                    to="/portal-admin"
                    className="px-3 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Site admin
                  </Link>
                )}
                {canOpenStaff && (
                  <Link
                    to="/staff"
                    className="px-3 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Staff portal
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-900 text-white text-sm hover:bg-neutral-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to={loginTarget}
                  className="px-3 py-2 rounded-full text-sm border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-2 rounded-full text-sm bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                >
                  Đăng ký
                </Link>
              </div>
            )}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              aria-label="Mở menu"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {isNotificationPanelOpen && (
          <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => setIsNotificationPanelOpen(false)}>
            <aside
              className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-neutral-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Tất cả thông báo</h2>
                  <p className="text-sm text-neutral-500">{notifications.length} thông báo</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotificationPanelOpen(false)}
                  className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {notifications.length > 0 ? (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.notification_id}
                        className={`rounded-lg border p-4 ${
                          notification.is_read
                            ? "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                            : "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/60"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => void handleNotificationClick(notification)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="font-medium text-neutral-950 dark:text-white">{notification.title}</div>
                            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                              {notification.content}
                            </div>
                            <div className="mt-2 text-xs text-neutral-400">
                              {new Date(notification.created_at).toLocaleString("vi-VN")}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNotification(notification.notification_id)}
                            className="rounded-full p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                            aria-label="Xóa thông báo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-sm text-neutral-500">
                    Chưa có thông báo
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        <form onSubmit={handleSearch} className="md:hidden pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:bg-white dark:focus:bg-neutral-900 transition-all"
            />
          </div>
        </form>

        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              to="/shop?gender=women"
              className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              NỮ
            </Link>
            <Link
              to="/shop?gender=men"
              className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              NAM
            </Link>
            <Link
              to="/danh-cho-ban"
              className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="text-blue-600 dark:text-blue-400">*</span>
              DÀNH CHO BẠN
            </Link>
            <Link
              to="/shop?new=true"
              className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              HÀNG MỚI
            </Link>
            <Link
              to="/shop?sale=true"
              className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              GIẢM GIÁ
            </Link>
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
              {isLoggedIn ? (
                <>
                  <div className="px-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {username}
                    {role ? ` · ${role}` : ""}
                  </div>
                  {canOpenAdmin && (
                    <Link
                      to="/portal-admin"
                      className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Site admin
                    </Link>
                  )}
                  {canOpenStaff && (
                    <Link
                      to="/staff"
                      className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Staff portal
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-neutral-900 text-white"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to={loginTarget}
                    className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
