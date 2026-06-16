import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  User,
  Package,
  Heart,
  Settings,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import type { Product } from "../../data/products";
import {
  addCartItem,
  fetchAddresses,
  fetchOrders,
  fetchCart,
  fetchProductById,
  fetchProfile,
  fetchWishlist,
  updateProfile,
} from "../../lib/api";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { dispatchCartAddedNotice } from "../../lib/cartNotice";
import {
  addStoredCartItem,
  CART_UPDATED_EVENT,
  readStoredCart,
} from "../../lib/cartStorage";
import {
  hasStoredWishlistIds,
  readStoredWishlistIds,
  removeStoredWishlistId,
  writeStoredWishlistIds,
} from "../../lib/wishlistStorage";

type MockOrderItem = {
  product: Product;
  quantity: number;
  size: string;
  color: string;
};

type MockOrder = {
  id: string;
  date: string;
  status: string;
  total: number;
  items: MockOrderItem[];
};

type OrderProduct = Product & {
  quantity: number;
  size: string;
  color: string;
};

type CartProduct = Product & {
  quantity: number;
  size: string;
  color: string;
};

type UserAddress = {
  address_id: number;
  full_name: string;
  phone: string;
  address_line: string;
  ward: string;
  district: string;
  province: string;
  is_default: boolean;
  created_at: string;
};

export function Profile() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "profile";
  const { isAuthReady, userId } = useAdminAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    full_name: "Nguyễn Văn A",
    email: "nguyenvana@example.com",
    phone: "0912345678",
  });
  const [mockOrders, setMockOrders] = useState<MockOrder[]>([]);
  const [cartItems, setCartItems] = useState<CartProduct[]>([]);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [selectedWishlistIds, setSelectedWishlistIds] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);

  async function loadLocalCartItems() {
    const storedItems = readStoredCart();
    const hydratedItems = await Promise.all(
      storedItems.map(async (item) => {
        try {
          const product = await fetchProductById(item.id);
          return {
            ...product,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
          };
        } catch {
          return null;
        }
      }),
    );
    setCartItems(hydratedItems.filter(Boolean) as CartProduct[]);
  }

  async function loadLocalWishlistItems() {
    const storedIds = readStoredWishlistIds();
    const hydratedItems = await Promise.all(
      storedIds.map(async (productId) => {
        try {
          return await fetchProductById(productId);
        } catch {
          return null;
        }
      }),
    );
    setWishlistItems(hydratedItems.filter(Boolean));
    setSelectedWishlistIds([]);
  }

  async function seedWishlistFromApi(apiWishlist: Array<{ product: Product }>) {
    const nextIds = apiWishlist.map((item) => String(item.product.id));
    writeStoredWishlistIds(nextIds);
    setWishlistItems(apiWishlist.map((item) => item.product));
    setSelectedWishlistIds([]);
  }

  useEffect(() => {
    if (!isAuthReady) return;
    if (!userId) {
      navigate(
        `/login?next=${encodeURIComponent(`/profile?tab=${activeTab}`)}`,
        {
          replace: true,
        },
      );
      return;
    }
    const activeUserId = userId;

    async function loadProfileData() {
      try {
        const [apiProfile, apiOrders, apiWishlist, apiCart] = await Promise.all(
          [
            fetchProfile(activeUserId),
            fetchOrders(activeUserId),
            fetchWishlist(activeUserId),
            fetchCart(activeUserId),
          ],
        );
        setProfile(apiProfile);
        try {
          setAddresses(await fetchAddresses(activeUserId));
        } catch {
          setAddresses([]);
        }
        setMockOrders(
          apiOrders.map((order) => ({
            id: `ORD-${order.order_id}`,
            date: new Date(order.created_at).toLocaleDateString("vi-VN"),
            status:
              order.status === "delivered"
                ? "Đã giao"
                : order.status === "shipped"
                  ? "Đang giao"
                  : order.status,
            total: order.final_amount,
            items: order.items.map((item) => ({
              product: item.product,
              quantity: item.quantity,
              size: item.product.sizes[0] ?? "STD",
              color: item.product.colors[0] ?? "Mặc định",
            })),
          })),
        );
        setCartItems(
          apiCart.map((item) => ({
            ...item.product,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
          })),
        );
        const localWishlistIds = readStoredWishlistIds();
        if (hasStoredWishlistIds()) {
          await loadLocalWishlistItems();
        } else if (apiWishlist.length > 0) {
          await seedWishlistFromApi(apiWishlist);
        } else {
          setWishlistItems([]);
          setSelectedWishlistIds([]);
        }
      } catch {
        setMockOrders([]);
        setAddresses([]);
        await loadLocalCartItems();
        await loadLocalWishlistItems();
      }
    }

    loadProfileData();
  }, [activeTab, isAuthReady, navigate, userId]);

  const handleWishlistAddToCart = async (
    event: React.MouseEvent<HTMLButtonElement>,
    product: any,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const size = product?.sizes?.[0] ?? "STD";
    const color = product?.colors?.[0] ?? "Mặc định";

    if (userId) {
      try {
        await addCartItem({
          user_id: userId,
          product_id: product.id,
          quantity: 1,
          size,
          color,
        });
        window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      } catch {
        addStoredCartItem({ id: String(product.id), quantity: 1, size, color });
      }
    } else {
      addStoredCartItem({ id: String(product.id), quantity: 1, size, color });
    }

    dispatchCartAddedNotice();
  };

  const removeWishlistItem = (productId: string) => {
    removeStoredWishlistId(productId);
    setWishlistItems((current) =>
      current.filter((item) => String(item.id) !== productId),
    );
    setSelectedWishlistIds((current) =>
      current.filter((id) => id !== productId),
    );
  };

  const removeSelectedWishlistItems = () => {
    selectedWishlistIds.forEach((productId) =>
      removeStoredWishlistId(productId),
    );
    setWishlistItems((current) =>
      current.filter((item) => !selectedWishlistIds.includes(String(item.id))),
    );
    setSelectedWishlistIds([]);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-light tracking-wide mb-8">
          Tài khoản của tôi
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <nav className="space-y-1">
              <Link
                to="/profile?tab=profile"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "profile" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Hồ sơ</span>
              </Link>
              <Link
                to="/profile?tab=orders"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "orders" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <Package className="w-5 h-5" />
                <span className="text-sm font-medium">Đơn hàng</span>
              </Link>
              <Link
                to="/profile?tab=cart"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "cart" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="text-sm font-medium">Giỏ hàng</span>
              </Link>
              <Link
                to="/profile?tab=wishlist"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "wishlist" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <Heart className="w-5 h-5" />
                <span className="text-sm font-medium">Yêu thích</span>
              </Link>
              <Link
                to="/profile?tab=settings"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "settings" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Cài đặt</span>
              </Link>
            </nav>
          </aside>

          <main className="lg:col-span-3">
            {activeTab === "profile" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Thông tin cá nhân
                </h2>
                <div className="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Họ và tên
                      </label>
                      <input
                        type="text"
                        value={profile.full_name}
                        onChange={(event) =>
                          setProfile((currentValue) => ({
                            ...currentValue,
                            full_name: event.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        readOnly
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(event) =>
                          setProfile((currentValue) => ({
                            ...currentValue,
                            phone: event.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (userId) {
                        void updateProfile(userId, {
                          full_name: profile.full_name,
                          phone: profile.phone,
                        });
                      }
                    }}
                    className="mt-6 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                  >
                    LƯU THAY ĐỔI
                  </button>

                  <div className="mt-8">
                    <h3 className="mb-4 text-lg font-medium">
                      Địa chỉ của bạn
                    </h3>
                    {addresses.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
                        Chưa có địa chỉ nào được lưu.
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {addresses.map((address) => (
                          <div
                            key={address.address_id}
                            className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium">
                                {address.full_name}
                              </div>
                              {address.is_default && (
                                <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-white dark:bg-white dark:text-neutral-900">
                                  Mặc định
                                </span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                              <div>{address.phone}</div>
                              <div>{address.address_line}</div>
                              <div>
                                {address.ward}, {address.district},{" "}
                                {address.province}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Đơn hàng của tôi
                </h2>
                {mockOrders.length === 0 ? (
                  <div className="text-center py-16">
                    <Package className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                      Đơn hàng đang trống!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mockOrders.map((order: MockOrder) => {
                      const orderProducts: OrderProduct[] = order.items.map(
                        (item: MockOrderItem) => ({
                          ...item.product,
                          quantity: item.quantity,
                          size: item.size,
                          color: item.color,
                        }),
                      );

                      return (
                        <div
                          key={order.id}
                          className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="font-medium mb-1">
                                Đơn hàng #{order.id}
                              </div>
                              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                {order.date}
                              </div>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === "Đã giao" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"}`}
                            >
                              {order.status}
                            </span>
                          </div>

                          <div className="space-y-3 mb-4">
                            {orderProducts.map(
                              (item: OrderProduct, idx: number) => (
                                <div key={idx} className="flex gap-4">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-16 h-20 object-cover bg-neutral-100 dark:bg-neutral-800 rounded"
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                                      Kích cỡ: {item.size} · Màu: {item.color} ·
                                      SL: {item.quantity}
                                    </div>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-4 border-t border-neutral-200 dark:border-neutral-800">
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">
                              Tổng cộng
                            </span>
                            <span className="font-medium">
                              {order.total.toLocaleString("vi-VN")}₫
                            </span>
                          </div>

                          <div className="flex gap-3 mt-4">
                            <button className="flex-1 py-2 border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors rounded">
                              Xem chi tiết
                            </button>
                            {order.status === "Đã giao" && (
                              <button className="flex-1 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors rounded">
                                Mua lại
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "cart" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Giỏ hàng của tôi
                </h2>
                {cartItems.length === 0 ? (
                  <div className="text-center py-16">
                    <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 dark:text-neutral-400 text-lg mb-8">
                      Chưa có sản phẩm nào trong giỏ hàng
                    </p>
                    <Link
                      to="/shop"
                      className="inline-flex items-center gap-2 px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                    >
                      TIẾP TỤC MUA SẮM
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cartItems.map((product: CartProduct, index: number) => (
                      <div
                        key={`${product.id}-${index}`}
                        className="flex gap-4 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4"
                      >
                        <Link
                          to={`/product/${product.id}`}
                          className="flex-shrink-0"
                        >
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-20 h-24 object-cover rounded bg-neutral-100 dark:bg-neutral-800"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <Link
                                to={`/product/${product.id}`}
                                className="font-medium hover:underline"
                              >
                                {product.name}
                              </Link>
                              <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                                Kích cỡ: {product.size} · Màu: {product.color} ·
                                SL: {product.quantity}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {(
                                  product.price * product.quantity
                                ).toLocaleString("vi-VN")}
                                ₫
                              </div>
                              <div className="text-sm text-neutral-500">
                                {product.price.toLocaleString("vi-VN")}₫ / cái
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <Link
                        to="/cart"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors rounded"
                      >
                        XEM TOÀN BỘ GIỎ HÀNG
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "wishlist" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Danh sách yêu thích
                </h2>
                {wishlistItems.length === 0 ? (
                  <div className="text-center py-16">
                    <Heart className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 dark:text-neutral-400 text-lg mb-8">
                      Chưa có sản phẩm yêu thích
                    </p>
                    <Link
                      to="/shop"
                      className="inline-flex items-center gap-2 px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                    >
                      TIẾP TỤC MUA SẮM
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={
                            selectedWishlistIds.length ===
                              wishlistItems.length && wishlistItems.length > 0
                          }
                          onChange={(event) =>
                            setSelectedWishlistIds(
                              event.target.checked
                                ? wishlistItems.map((item: any) =>
                                    String(item.id),
                                  )
                                : [],
                            )
                          }
                        />
                        Chọn tất cả
                      </label>
                      <button
                        onClick={removeSelectedWishlistItems}
                        disabled={selectedWishlistIds.length === 0}
                        className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                      >
                        <Heart className="h-4 w-4" />
                        Xóa sản phẩm đã chọn
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {wishlistItems.map((product: any) => {
                        const productId = String(product.id);
                        const isSelected =
                          selectedWishlistIds.includes(productId);

                        return (
                          <div
                            key={product.id}
                            className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                          >
                            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(event) =>
                                    setSelectedWishlistIds((current) =>
                                      event.target.checked
                                        ? [...current, productId]
                                        : current.filter(
                                            (id) => id !== productId,
                                          ),
                                    )
                                  }
                                />
                                Chọn
                              </label>
                              <button
                                onClick={() => removeWishlistItem(productId)}
                                className="rounded-full bg-white/95 p-2 text-red-500 transition-colors hover:bg-red-50"
                                aria-label="Bỏ khỏi yêu thích"
                              >
                                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                              </button>
                            </div>
                            <Link
                              to={`/product/${product.id}`}
                              className="group block"
                            >
                              <div className="relative aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-4">
                                <h3 className="font-medium mb-2">
                                  {product.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {product.price.toLocaleString("vi-VN")}₫
                                  </span>
                                  {product.originalPrice && (
                                    <span className="text-sm text-neutral-400 line-through">
                                      {product.originalPrice.toLocaleString(
                                        "vi-VN",
                                      )}
                                      ₫
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={(event) =>
                                    void handleWishlistAddToCart(event, product)
                                  }
                                  className="w-full mt-3 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors rounded"
                                >
                                  THÊM VÀO GIỎ
                                </button>
                              </div>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Cài đặt tài khoản
                </h2>
                <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
                  Mục cài đặt đang để trống để bạn bổ sung chức năng sau.
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
