import { Link, useNavigate } from "react-router";
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
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { fetchCart, fetchWishlist } from "../../lib/api";
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
  const { theme, setTheme } = useTheme();
  const { isLoggedIn, username, logout, role, userId } = useAdminAuth();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

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

    loadCartCount();
    loadWishlistCount();

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate("/login");
  };

  const authTarget = (target: string) =>
    isLoggedIn ? target : `/login?next=${encodeURIComponent(target)}`;

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
              to="/shop?category=women"
              className="text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              NỮ
            </Link>
            <Link
              to="/shop?category=men"
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
            className="hidden md:flex items-center flex-1 max-w-md mx-8"
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:bg-white dark:focus:bg-neutral-900 transition-all"
              />
            </div>
          </form>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              aria-label="Đổi giao diện sáng tối"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <Link
              to={isLoggedIn ? "/profile" : "/login"}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
              <User className="w-5 h-5" />
            </Link>
            <Link
              to={authTarget("/profile?tab=wishlist")}
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
            {isLoggedIn ? (
              <div className="hidden md:flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100">
                  {username}
                  {role ? ` · ${role}` : ""}
                </span>
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
                  to="/login"
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

        <form onSubmit={handleSearch} className="md:hidden pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
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
              to="/shop?category=women"
              className="block py-2 text-sm tracking-wide hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              NỮ
            </Link>
            <Link
              to="/shop?category=men"
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
                    to="/login"
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
