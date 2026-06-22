import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import {
  User,
  Package,
  Heart,
  Settings,
  ArrowRight,
  ShoppingBag,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Product } from "../../data/products";
import {
  addCartItem,
  cancelCustomerOrder,
  confirmOrderReceived,
  createReturnRequest,
  createProductReview,
  createAddress,
  deleteAddress,
  deleteWishlistItem,
  fetchAddresses,
  fetchOrders,
  fetchProductById,
  fetchProfile,
  fetchReturnRequests,
  fetchWishlist,
  requestPasswordReset,
  resetPassword,
  updateAddress,
  updateProfile,
  verifyPasswordResetOtp,
  type ApiOrder,
  type ApiReturnRequest,
} from "../../lib/api";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { Cart } from "../cart/Cart";
import { dispatchCartAddedNotice } from "../../lib/cartNotice";
import { CART_UPDATED_EVENT } from "../../lib/cartStorage";
import {
  hasStoredWishlistIds,
  readStoredWishlistIds,
  removeStoredWishlistId,
  writeStoredWishlistIds,
} from "../../lib/wishlistStorage";

type MockOrderItem = {
  order_item_id: number;
  product: Product;
  quantity: number;
  size: string;
  color: string;
  price: number;
  subtotal?: number;
};

type MockOrder = {
  id: string;
  orderId: number;
  date: string;
  status: string;
  statusRaw: string;
  total: number;
  shippingAddress?: ApiOrder["shipping_address"];
  paymentMethod?: string;
  paymentStatus?: string;
  shippingFee?: number;
  discountAmount?: number;
  shipment?: ApiOrder["shipment"];
  statusHistories: NonNullable<ApiOrder["status_histories"]>;
  items: MockOrderItem[];
};

type OrderProduct = Product & {
  quantity: number;
  size: string;
  color: string;
  orderPrice: number;
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
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [selectedWishlistIds, setSelectedWishlistIds] = useState<string[]>([]);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressMessage, setAddressMessage] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState({
    full_name: "",
    phone: "",
    address_line: "",
    ward: "",
    district: "",
    province: "",
    is_default: false,
  });
  const [selectedOrder, setSelectedOrder] = useState<MockOrder | null>(null);
  const [orderMessage, setOrderMessage] = useState("");
  const [cancelOrderTarget, setCancelOrderTarget] = useState<MockOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOrderError, setCancelOrderError] = useState("");
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [repurchaseNotice, setRepurchaseNotice] = useState("");
  const [repurchasingOrderId, setRepurchasingOrderId] = useState<number | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ order: MockOrder; item: MockOrderItem } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewedOrderItems, setReviewedOrderItems] = useState<number[]>([]);
  const [returnRequests, setReturnRequests] = useState<ApiReturnRequest[]>([]);
  const [returnTarget, setReturnTarget] = useState<{ order: MockOrder; item: MockOrderItem } | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnSolution, setReturnSolution] = useState("refund");
  const [returnEvidenceUrl, setReturnEvidenceUrl] = useState("");
  const [returnMessage, setReturnMessage] = useState("");
  const [settingsModal, setSettingsModal] = useState<"profile" | "password" | null>(null);
  const [editProfile, setEditProfile] = useState({ full_name: "", phone: "" });
  const [passwordStep, setPasswordStep] = useState<"send" | "otp" | "password">("send");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordResetToken, setPasswordResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  function closeSettingsModal() {
    setSettingsModal(null);
    setPasswordStep("send");
    setPasswordOtp("");
    setPasswordResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
    setSettingsMessage("");
    setSettingsError("");
  }

  async function saveProfileSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setSettingsLoading(true); setSettingsError("");
    try {
      const updated = await updateProfile(userId, editProfile);
      setProfile((current) => ({ ...current, full_name: updated.full_name, phone: updated.phone || "" }));
      closeSettingsModal();
    } catch (error) { setSettingsError(error instanceof Error ? error.message : "Không thể cập nhật hồ sơ"); }
    finally { setSettingsLoading(false); }
  }

  async function sendProfilePasswordOtp() {
    setSettingsLoading(true); setSettingsError("");
    try {
      const result = await requestPasswordReset(profile.email);
      setSettingsMessage(result.detail);
      setPasswordStep("otp");
    } catch (error) { setSettingsError(error instanceof Error ? error.message : "Không thể gửi OTP"); }
    finally { setSettingsLoading(false); }
  }

  async function verifyProfilePasswordOtp() {
    setSettingsLoading(true); setSettingsError("");
    try {
      const result = await verifyPasswordResetOtp(profile.email, passwordOtp);
      setPasswordResetToken(result.reset_token);
      setSettingsMessage("Xác nhận OTP thành công.");
      setPasswordStep("password");
    } catch (error) { setSettingsError(error instanceof Error ? error.message : "OTP không hợp lệ"); }
    finally { setSettingsLoading(false); }
  }

  async function saveNewPassword(event: React.FormEvent) {
    event.preventDefault(); setSettingsError("");
    if (newPassword !== confirmNewPassword) { setSettingsError("Mật khẩu xác nhận không khớp"); return; }
    setSettingsLoading(true);
    try {
      await resetPassword(passwordResetToken, newPassword);
      closeSettingsModal();
      localStorage.removeItem("siteAuth");
      localStorage.removeItem("adminAuth");
      window.location.href = "/login?reset=success";
    } catch (error) { setSettingsError(error instanceof Error ? error.message : "Không thể đổi mật khẩu"); }
    finally { setSettingsLoading(false); }
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
      const [profileResult, ordersResult, wishlistResult, addressResult, returnsResult] =
        await Promise.allSettled([
          fetchProfile(activeUserId),
          fetchOrders(activeUserId),
          fetchWishlist(activeUserId),
          fetchAddresses(activeUserId),
          fetchReturnRequests(),
        ]);

      if (profileResult.status === "fulfilled") setProfile(profileResult.value);
      if (ordersResult.status === "fulfilled") {
        setMockOrders(ordersResult.value.map(toMockOrder));
      } else {
        setMockOrders([]);
        setOrderMessage("Không tải được lịch sử đơn hàng. Vui lòng thử lại.");
      }
      if (addressResult.status === "fulfilled") {
        setAddresses(addressResult.value);
      } else {
        setAddresses([]);
        setAddressMessage("Không tải được địa chỉ giao hàng.");
      }
      if (wishlistResult.status === "fulfilled") {
        if (wishlistResult.value.length > 0) {
          await seedWishlistFromApi(wishlistResult.value);
        } else {
          setWishlistItems([]);
          setSelectedWishlistIds([]);
          writeStoredWishlistIds([]);
        }
      } else {
        await loadLocalWishlistItems();
      }
      setReturnRequests(returnsResult.status === "fulfilled" ? returnsResult.value : []);
    }

    loadProfileData();
  }, [activeTab, isAuthReady, navigate, userId]);

  useEffect(() => {
    if (editingAddressId) return;
    setAddressForm((current) => ({
      ...current,
      full_name: current.full_name || profile.full_name,
      phone: current.phone || profile.phone,
      is_default: current.is_default || addresses.length === 0,
    }));
  }, [addresses.length, editingAddressId, profile.full_name, profile.phone]);

  const handleWishlistAddToCart = async (
    event: React.MouseEvent<HTMLButtonElement>,
    product: any,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const size = product?.sizes?.[0] ?? "STD";
    const color = product?.colors?.[0] ?? "Mặc định";
    const variant = product?.variants?.find(
      (item: { available_stock?: number }) => Number(item.available_stock ?? 0) > 0,
    );

    if (!userId) return;
    setWishlistMessage("");
    try {
      await addCartItem({
        user_id: userId,
        product_id: product.id,
        variant_id: variant?.variant_id,
        quantity: 1,
        size: variant?.size ?? size,
        color: variant?.color ?? color,
      });
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      dispatchCartAddedNotice();
    } catch (error) {
      setWishlistMessage(
        error instanceof Error ? error.message : "Không thể thêm sản phẩm vào giỏ hàng.",
      );
    }
  };

  const removeWishlistItem = async (productId: string) => {
    if (!userId) return;
    setWishlistMessage("");
    try {
      await deleteWishlistItem(userId, productId);
      removeStoredWishlistId(productId);
      setWishlistItems((current) =>
        current.filter((item) => String(item.id) !== productId),
      );
      setSelectedWishlistIds((current) =>
        current.filter((id) => id !== productId),
      );
    } catch (error) {
      setWishlistMessage(
        error instanceof Error ? error.message : "Không thể xóa sản phẩm yêu thích.",
      );
    }
  };

  const removeSelectedWishlistItems = async () => {
    if (!userId || selectedWishlistIds.length === 0) return;
    setWishlistMessage("");
    const results = await Promise.allSettled(
      selectedWishlistIds.map((productId) => deleteWishlistItem(userId, productId)),
    );
    const deletedIds = selectedWishlistIds.filter(
      (_productId, index) => results[index].status === "fulfilled",
    );
    deletedIds.forEach(removeStoredWishlistId);
    setWishlistItems((current) =>
      current.filter((item) => !deletedIds.includes(String(item.id))),
    );
    setSelectedWishlistIds((current) =>
      current.filter((id) => !deletedIds.includes(id)),
    );
    if (deletedIds.length !== results.length) {
      setWishlistMessage("Một số sản phẩm chưa xóa được. Vui lòng thử lại.");
    }
  };

  async function reloadAddresses() {
    if (!userId) return;
    setAddresses(await fetchAddresses(userId));
  }

  async function repurchaseOrder(order: MockOrder) {
    if (!userId || repurchasingOrderId !== null) return;
    setRepurchasingOrderId(order.orderId);
    setOrderMessage("");
    try {
      await Promise.all(
        order.items.map((item) =>
          addCartItem({
            user_id: userId,
            product_id: item.product.id,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
          }),
        ),
      );
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      setRepurchaseNotice("Đã thêm lại sản phẩm vào giỏ hàng!");
      window.setTimeout(() => setRepurchaseNotice(""), 2500);
    } catch (error) {
      setOrderMessage(error instanceof Error ? error.message : "Không thể thêm lại sản phẩm vào giỏ hàng.");
    } finally {
      setRepurchasingOrderId(null);
    }
  }

  function editAddress(address: UserAddress) {
    setEditingAddressId(address.address_id);
    setAddressForm({
      full_name: address.full_name,
      phone: address.phone,
      address_line: address.address_line,
      ward: address.ward,
      district: address.district,
      province: address.province,
      is_default: address.is_default,
    });
    setAddressMessage("");
  }

  function resetAddressForm() {
    setEditingAddressId(null);
    setAddressForm({
      full_name: profile.full_name,
      phone: profile.phone,
      address_line: "",
      ward: "",
      district: "",
      province: "",
      is_default: addresses.length === 0,
    });
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setAddressMessage("");
    try {
      if (editingAddressId) {
        await updateAddress(userId, editingAddressId, addressForm);
        setAddressMessage("Đã cập nhật địa chỉ.");
      } else {
        await createAddress(userId, addressForm);
        setAddressMessage("Đã thêm địa chỉ.");
      }
      await reloadAddresses();
      resetAddressForm();
    } catch (error) {
      setAddressMessage(error instanceof Error ? error.message : "Không lưu được địa chỉ.");
    }
  }

  async function removeAddress(addressId: number) {
    if (!userId || !confirm("Xóa địa chỉ này?")) return;
    try {
      await deleteAddress(userId, addressId);
      setAddressMessage("Đã xóa địa chỉ.");
      await reloadAddresses();
    } catch (error) {
      setAddressMessage(error instanceof Error ? error.message : "Không xóa được địa chỉ.");
    }
  }

  async function confirmReceived(order: MockOrder) {
    const accepted = confirm("Xác nhận bạn đã nhận được đơn hàng này?");
    if (!accepted) return;
    setOrderMessage("");
    try {
      const updatedOrder = await confirmOrderReceived(order.orderId);
      setMockOrders((current) =>
        current.map((item) =>
          item.orderId === order.orderId
            ? {
                ...item,
                status: getOrderStatusLabel(updatedOrder.status),
                statusRaw: updatedOrder.status,
              }
            : item,
        ),
      );
      setSelectedOrder((current) =>
        current?.orderId === order.orderId
          ? {
              ...current,
              status: getOrderStatusLabel(updatedOrder.status),
              statusRaw: updatedOrder.status,
            }
          : current,
      );
      setOrderMessage("Đã xác nhận nhận hàng. Đơn hàng đã hoàn thành, bạn có thể gửi đánh giá sản phẩm.");
    } catch (error) {
      setOrderMessage(error instanceof Error ? error.message : "Không thể xác nhận nhận hàng.");
    }
  }

  async function submitOrderCancellation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelOrderTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelOrderError("Vui lòng nhập lý do hủy đơn.");
      return;
    }

    setIsCancellingOrder(true);
    setCancelOrderError("");
    try {
      const updatedOrder = await cancelCustomerOrder(cancelOrderTarget.orderId, reason);
      setMockOrders((current) =>
        current.map((item) =>
          item.orderId === cancelOrderTarget.orderId
            ? { ...item, status: getOrderStatusLabel(updatedOrder.status), statusRaw: updatedOrder.status }
            : item,
        ),
      );
      setSelectedOrder((current) =>
        current?.orderId === cancelOrderTarget.orderId
          ? { ...current, status: getOrderStatusLabel(updatedOrder.status), statusRaw: updatedOrder.status }
          : current,
      );
      setCancelOrderTarget(null);
      setCancelReason("");
      setOrderMessage("Đã hủy đơn hàng thành công.");
    } catch (error) {
      setCancelOrderError(error instanceof Error ? error.message : "Không thể hủy đơn hàng.");
    } finally {
      setIsCancellingOrder(false);
    }
  }

  async function submitReturnRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!returnTarget) return;
    if (!returnReason.trim() || !returnEvidenceUrl.trim()) {
      setReturnMessage("Vui lòng nhập lý do và đường dẫn ảnh minh chứng.");
      return;
    }
    setReturnMessage("");
    try {
      const created = await createReturnRequest({
        order_id: returnTarget.order.orderId,
        order_item_id: returnTarget.item.order_item_id,
        reason: returnReason.trim(),
        desired_solution: returnSolution,
        images: [returnEvidenceUrl.trim()],
      });
      setReturnRequests((current) => [created, ...current]);
      setReturnTarget(null);
      setReturnReason("");
      setReturnEvidenceUrl("");
      setReturnMessage("Đã gửi yêu cầu đổi trả. Nhân viên sẽ kiểm tra và phản hồi.");
    } catch (error) {
      setReturnMessage(error instanceof Error ? error.message : "Không gửi được yêu cầu đổi trả.");
    }
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewTarget) return;
    setReviewMessage("");
    try {
      await createProductReview({
        product_id: reviewTarget.item.product.id,
        order_item_id: reviewTarget.item.order_item_id,
        rating: reviewRating,
        comment: reviewComment.trim(),
        images: reviewImages,
      });
      setReviewedOrderItems((current) => [...current, reviewTarget.item.order_item_id]);
      setReviewMessage("Đã gửi đánh giá. Đánh giá sẽ hiển thị sau khi nhân viên duyệt.");
      setReviewTarget(null);
      setReviewComment("");
      setReviewImages([]);
      setReviewRating(5);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Không gửi được đánh giá.");
    }
  }

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
                to="?tab=profile"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "profile" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Hồ sơ</span>
              </Link>
              <Link
                to="?tab=orders"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "orders" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <Package className="w-5 h-5" />
                <span className="text-sm font-medium">Đơn hàng</span>
              </Link>
              <Link
                to="?tab=addresses"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "addresses" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <MapPin className="w-5 h-5" />
                <span className="text-sm font-medium">Địa chỉ</span>
              </Link>
              <Link
                to="/cart"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "cart" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="text-sm font-medium">Giỏ hàng</span>
              </Link>
              <Link
                to="/wishlist"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${activeTab === "wishlist" ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <Heart className="w-5 h-5" />
                <span className="text-sm font-medium">Yêu thích</span>
              </Link>
              <Link
                to="?tab=settings"
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
                        readOnly
                        className="w-full rounded border border-neutral-200 bg-neutral-100 px-4 py-2 dark:border-neutral-700 dark:bg-neutral-900"
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
                        readOnly
                        className="w-full rounded border border-neutral-200 bg-neutral-100 px-4 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                      />
                    </div>
                  </div>

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

            {activeTab === "addresses" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Địa chỉ giao hàng
                </h2>
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-4">
                    {addresses.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
                        Chưa có địa chỉ nào được lưu.
                      </div>
                    ) : (
                      addresses.map((address) => (
                        <div
                          key={address.address_id}
                          className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{address.full_name}</div>
                              <div className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                                <div>{address.phone}</div>
                                <div>{address.address_line}</div>
                                <div>
                                  {address.ward}, {address.district}, {address.province}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {address.is_default && (
                                <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-white dark:bg-white dark:text-neutral-900">
                                  Mặc định
                                </span>
                              )}
                              <button
                                onClick={() => editAddress(address)}
                                className="rounded border px-2 py-2 text-sm hover:bg-neutral-50"
                                aria-label="Sửa địa chỉ"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => void removeAddress(address.address_id)}
                                className="rounded border border-red-200 px-2 py-2 text-sm text-red-700 hover:bg-red-50"
                                aria-label="Xóa địa chỉ"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={(event) => void saveAddress(event)}
                    className="h-fit rounded-lg border bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800"
                  >
                    <h3 className="mb-4 font-medium">
                      {editingAddressId ? "Sửa địa chỉ" : "Thêm địa chỉ"}
                    </h3>
                    {addressMessage && (
                      <div className="mb-3 rounded border bg-white p-2 text-sm text-neutral-700 dark:bg-neutral-900">
                        {addressMessage}
                      </div>
                    )}
                    <div className="space-y-3">
                      {[
                        ["full_name", "Tên người nhận"],
                        ["phone", "Số điện thoại"],
                        ["address_line", "Địa chỉ chi tiết"],
                        ["ward", "Phường/xã"],
                        ["district", "Quận/huyện"],
                        ["province", "Tỉnh/thành phố"],
                      ].map(([key, label]) => (
                        <label key={key} className="block text-sm">
                          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
                            {label}
                          </span>
                          <input
                            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                            value={addressForm[key as keyof typeof addressForm] as string}
                            onChange={(event) =>
                              setAddressForm((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={addressForm.is_default}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              is_default: event.target.checked,
                            }))
                          }
                        />
                        Đặt làm địa chỉ mặc định
                      </label>
                      <div className="flex gap-2">
                        <button className="rounded bg-neutral-950 px-4 py-2 text-white dark:bg-white dark:text-neutral-950">
                          Lưu địa chỉ
                        </button>
                        <button
                          type="button"
                          onClick={resetAddressForm}
                          className="rounded border px-4 py-2"
                        >
                          Làm mới
                        </button>
                      </div>
                    </div>
                  </form>
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
                    {orderMessage && (
                      <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                        {orderMessage}
                      </div>
                    )}
                    {reviewMessage && (
                      <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                        {reviewMessage}
                      </div>
                    )}
                    {returnMessage && (
                      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                        {returnMessage}
                      </div>
                    )}
                    {mockOrders.map((order: MockOrder) => {
                      const orderProducts: OrderProduct[] = order.items.map(
                        (item: MockOrderItem) => ({
                          ...item.product,
                          quantity: item.quantity,
                          size: item.size,
                          color: item.color,
                          orderPrice: item.price,
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
                                    <Link
                                      to={`/product/${item.id}`}
                                      className="font-medium text-sm hover:underline"
                                    >
                                      {item.name}
                                    </Link>
                                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                                      Kích cỡ: {item.size} · Màu: {item.color} ·
                                      SL: {item.quantity}
                                    </div>
                                    <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-300">
                                      Đơn giá: {item.orderPrice.toLocaleString("vi-VN")} VND · Thành tiền: {(item.orderPrice * item.quantity).toLocaleString("vi-VN")} VND
                                    </div>
                                    {order.statusRaw === "completed" && !reviewedOrderItems.includes(order.items[idx]?.order_item_id) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewTarget({ order, item: order.items[idx] });
                                          setReviewMessage("");
                                        }}
                                        className="mt-3 rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                                      >
                                        Gửi đánh giá
                                      </button>
                                    )}
                                    {["delivered", "completed"].includes(order.statusRaw) &&
                                      !returnRequests.some(
                                        (request) => request.order_item === order.items[idx]?.order_item_id,
                                      ) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReturnTarget({ order, item: order.items[idx] });
                                            setReturnMessage("");
                                          }}
                                          className="ml-2 mt-3 rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                                        >
                                          Yêu cầu đổi trả
                                        </button>
                                      )}
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
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="flex-1 py-2 border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors rounded"
                            >
                              Xem chi tiết
                            </button>
                            {order.statusRaw === "delivered" && (
                              <button
                                type="button"
                                onClick={() => void confirmReceived(order)}
                                className="flex-1 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors rounded"
                              >
                                Xác nhận đã nhận hàng
                              </button>
                            )}
                            {["pending", "confirmed", "processing"].includes(order.statusRaw) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelOrderTarget(order);
                                  setCancelReason("");
                                  setCancelOrderError("");
                                }}
                                className="flex-1 rounded border border-red-300 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                              >
                                Hủy đơn
                              </button>
                            )}
                            {order.statusRaw === "completed" && (
                              <button
                                type="button"
                                onClick={() => void repurchaseOrder(order)}
                                disabled={repurchasingOrderId !== null}
                                className="flex-1 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors rounded disabled:opacity-50"
                              >
                                {repurchasingOrderId === order.orderId ? "Đang thêm..." : "Mua lại"}
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
                <h2 className="mb-6 text-2xl font-light tracking-wide">Giỏ hàng của tôi</h2>
                <Cart embedded />
              </div>
            )}

            {activeTab === "wishlist" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Danh sách yêu thích
                </h2>
                {wishlistMessage && (
                  <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {wishlistMessage}
                  </div>
                )}
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
                        onClick={() => void removeSelectedWishlistItems()}
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
                                onClick={() => void removeWishlistItem(productId)}
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
                <h2 className="mb-6 text-2xl font-light tracking-wide">Cài đặt tài khoản</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => { setEditProfile({ full_name: profile.full_name, phone: profile.phone }); setSettingsModal("profile"); }} className="rounded-lg border p-5 text-left hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                    <div className="font-medium">Chỉnh sửa hồ sơ</div><div className="mt-1 text-sm text-neutral-500">Cập nhật họ tên và số điện thoại.</div>
                  </button>
                  <button type="button" onClick={() => setSettingsModal("password")} className="rounded-lg border p-5 text-left hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                    <div className="font-medium">Đổi mật khẩu</div><div className="mt-1 text-sm text-neutral-500">Xác nhận OTP gửi tới email trước khi đổi.</div>
                  </button>
                </div>
              </div>
            )}

            {settingsModal === "profile" && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <form onSubmit={saveProfileSettings} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
                  <h3 className="text-xl font-medium">Chỉnh sửa hồ sơ</h3>
                  {settingsError && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{settingsError}</div>}
                  <label className="block text-sm font-medium">Họ và tên<input required value={editProfile.full_name} onChange={(e) => setEditProfile({ ...editProfile, full_name: e.target.value })} className="mt-2 w-full rounded border px-3 py-2 dark:bg-neutral-950" /></label>
                  <label className="block text-sm font-medium">Số điện thoại<input value={editProfile.phone} onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })} className="mt-2 w-full rounded border px-3 py-2 dark:bg-neutral-950" /></label>
                  <div className="flex gap-3"><button type="button" onClick={closeSettingsModal} className="flex-1 rounded border py-2">Hủy</button><button disabled={settingsLoading} className="flex-1 rounded bg-neutral-900 py-2 text-white dark:bg-white dark:text-neutral-900">Lưu</button></div>
                </form>
              </div>
            )}

            {settingsModal === "password" && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <form onSubmit={passwordStep === "password" ? saveNewPassword : (e) => { e.preventDefault(); void (passwordStep === "send" ? sendProfilePasswordOtp() : verifyProfilePasswordOtp()); }} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
                  <h3 className="text-xl font-medium">Đổi mật khẩu</h3>
                  {passwordStep === "send" && <p className="text-sm text-neutral-600">Mã OTP sẽ được gửi tới <strong>{profile.email}</strong>.</p>}
                  {passwordStep === "otp" && <label className="block text-sm font-medium">Mã OTP<input required inputMode="numeric" value={passwordOtp} onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 w-full rounded border px-3 py-2 text-center text-xl tracking-[0.3em] dark:bg-neutral-950" /></label>}
                  {passwordStep === "password" && <><label className="block text-sm font-medium">Mật khẩu mới<input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 w-full rounded border px-3 py-2 dark:bg-neutral-950" /></label><label className="block text-sm font-medium">Xác nhận mật khẩu<input required type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="mt-2 w-full rounded border px-3 py-2 dark:bg-neutral-950" /></label></>}
                  {settingsMessage && <div className="rounded bg-green-50 p-3 text-sm text-green-700">{settingsMessage}</div>}
                  {settingsError && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{settingsError}</div>}
                  <div className="flex gap-3"><button type="button" onClick={closeSettingsModal} className="flex-1 rounded border py-2">Hủy</button><button disabled={settingsLoading || (passwordStep === "otp" && passwordOtp.length !== 6)} className="flex-1 rounded bg-neutral-900 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">{settingsLoading ? "Đang xử lý..." : passwordStep === "send" ? "Gửi OTP" : passwordStep === "otp" ? "Xác nhận OTP" : "Đổi mật khẩu"}</button></div>
                </form>
              </div>
            )}

            {selectedOrder && (
              <OrderDetailModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
              />
            )}

            {cancelOrderTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <form
                  onSubmit={submitOrderCancellation}
                  className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
                >
                  <h3 className="text-xl font-medium">Hủy đơn hàng #{cancelOrderTarget.id}</h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Vui lòng cho chúng tôi biết lý do bạn muốn hủy đơn hàng này.
                  </p>
                  <label className="mt-5 block text-sm font-medium">
                    Lý do hủy đơn
                    <textarea
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      rows={4}
                      maxLength={500}
                      required
                      autoFocus
                      placeholder="Nhập lý do hủy đơn..."
                      className="mt-2 w-full resize-none rounded border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white"
                    />
                  </label>
                  {cancelOrderError && (
                    <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                      {cancelOrderError}
                    </div>
                  )}
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={isCancellingOrder}
                      onClick={() => setCancelOrderTarget(null)}
                      className="rounded border px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Không hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isCancellingOrder || !cancelReason.trim()}
                      className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isCancellingOrder ? "Đang hủy..." : "Xác nhận hủy đơn"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {reviewTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <form
                  onSubmit={submitReview}
                  className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
                >
                  <h3 className="text-lg font-medium">Đánh giá sản phẩm</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {reviewTarget.item.product.name}
                  </p>
                  <div className="mt-4 flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="rounded p-1"
                      >
                        <span className={`text-2xl ${star <= reviewRating ? "text-yellow-500" : "text-neutral-300"}`}>
                          ★
                        </span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    rows={4}
                    placeholder="Chia sẻ cảm nhận của bạn..."
                    className="mt-4 w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <label className="mt-4 block text-sm">
                    <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
                      Ảnh đánh giá (tối đa 5 ảnh)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        setReviewImages(Array.from(event.target.files ?? []).slice(0, 5))
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                    />
                  </label>
                  {reviewImages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {reviewImages.map((image) => (
                        <img
                          key={`${image.name}-${image.lastModified}`}
                          src={URL.createObjectURL(image)}
                          alt={image.name}
                          className="h-16 w-16 rounded object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button className="flex-1 rounded bg-neutral-950 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-950">
                      Gửi đánh giá
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewTarget(null);
                        setReviewImages([]);
                      }}
                      className="flex-1 rounded border py-2 text-sm font-medium"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            )}

            {returnTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <form onSubmit={submitReturnRequest} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
                  <div>
                    <h3 className="text-lg font-medium">Yêu cầu đổi trả</h3>
                    <p className="mt-1 text-sm text-neutral-500">{returnTarget.item.product.name}</p>
                  </div>
                  <label className="block text-sm font-medium">
                    Lý do
                    <textarea required rows={4} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} className="mt-2 w-full rounded border px-3 py-2 dark:bg-neutral-950" />
                  </label>
                  <label className="block text-sm font-medium">
                    Mong muốn xử lý
                    <select value={returnSolution} onChange={(event) => setReturnSolution(event.target.value)} className="mt-2 w-full rounded border px-3 py-2 dark:bg-neutral-950">
                      <option value="refund">Hoàn tiền</option>
                      <option value="exchange">Đổi sản phẩm</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Đường dẫn ảnh minh chứng
                    <input required type="url" value={returnEvidenceUrl} onChange={(event) => setReturnEvidenceUrl(event.target.value)} placeholder="https://..." className="mt-2 w-full rounded border px-3 py-2 dark:bg-neutral-950" />
                  </label>
                  <p className="text-xs text-neutral-500">Yêu cầu được tiếp nhận trong vòng 7 ngày kể từ khi giao hàng.</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setReturnTarget(null)} className="flex-1 rounded border py-2">Hủy</button>
                    <button type="submit" className="flex-1 rounded bg-neutral-900 py-2 text-white dark:bg-white dark:text-neutral-900">Gửi yêu cầu</button>
                  </div>
                </form>
              </div>
            )}
          </main>
        </div>
        {repurchaseNotice && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
            <div className="rounded-lg bg-neutral-900 px-6 py-4 font-medium text-white shadow-xl dark:bg-white dark:text-neutral-900">
              {repurchaseNotice}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function getOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Chờ xử lý",
    confirmed: "Xác nhận",
    processing: "Đang xử lý",
    waiting_pickup: "Chờ lấy hàng",
    shipped: "Đang giao",
    delivered: "Đã giao hàng",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  return labels[status] ?? status;
}

function toMockOrder(order: ApiOrder): MockOrder {
  return {
    id: `ORD-${order.order_id}`,
    orderId: order.order_id,
    date: new Date(order.created_at).toLocaleDateString("vi-VN"),
    status: getOrderStatusLabel(order.status),
    statusRaw: order.status,
    total: Number(order.final_amount),
    shippingAddress: order.shipping_address,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    shippingFee: Number(order.shipping_fee),
    discountAmount: Number(order.discount_amount),
    shipment: order.shipment,
    statusHistories: order.status_histories ?? [],
    items: order.items.map((item) => ({
      order_item_id: item.order_item_id,
      product: item.product,
      quantity: item.quantity,
      size: item.size_snapshot || item.product.sizes[0] || "STD",
      color: item.color_snapshot || item.product.colors[0] || "Mặc định",
      price: Number(item.price),
      subtotal: item.subtotal == null ? undefined : Number(item.subtotal),
    })),
  };
}

function OrderDetailModal({ order, onClose }: { order: MockOrder; onClose: () => void }) {
  const address = order.shippingAddress;
  const fullAddress = [address?.address_line, address?.ward, address?.district, address?.province]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-medium">Chi tiết đơn hàng #{order.id}</h3>
            <p className="mt-1 text-sm text-neutral-500">{order.date} · {order.status}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm">
            Đóng
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <InfoBlock label="Người nhận" value={address?.receiver_name} />
          <InfoBlock label="Số điện thoại" value={address?.receiver_phone} />
          <InfoBlock label="Địa chỉ giao hàng" value={fullAddress || undefined} />
          <InfoBlock label="Phương thức thanh toán" value={order.paymentMethod} />
          <InfoBlock label="Trạng thái thanh toán" value={order.paymentStatus} />
          <InfoBlock label="Đơn vị vận chuyển" value={order.shipment?.carrier_name} />
          <InfoBlock label="Mã vận đơn" value={order.shipment?.tracking_code} />
        </div>

        <div className="mt-6">
          <h4 className="mb-3 font-medium">Lịch sử trạng thái</h4>
          <div className="space-y-3 border-l-2 border-neutral-200 pl-4 dark:border-neutral-700">
            {order.statusHistories.length ? (
              order.statusHistories.map((history) => (
                <div key={history.history_id}>
                  <div className="text-sm font-medium">{getOrderStatusLabel(history.to_status)}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(history.created_at).toLocaleString("vi-VN")}
                    {history.note ? ` - ${history.note}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-neutral-500">Đơn hàng đang ở trạng thái {order.status}.</div>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {order.items.map((item) => (
            <div key={item.order_item_id} className="flex gap-3 rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <img src={item.product.image} alt={item.product.name} className="h-20 w-16 rounded object-cover" />
              <div className="flex-1 text-sm">
                <Link to={`/product/${item.product.id}`} className="font-medium hover:underline">
                  {item.product.name}
                </Link>
                <div className="mt-1 text-neutral-500">
                  Size: {item.size} · Màu: {item.color} · SL: {item.quantity}
                </div>
                <div className="mt-1">
                  {(item.subtotal ?? item.price * item.quantity).toLocaleString("vi-VN")}₫
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2 rounded bg-neutral-50 p-4 text-sm dark:bg-neutral-950">
          <SummaryLine label="Tạm tính" value={order.total - (order.shippingFee ?? 0) + (order.discountAmount ?? 0)} />
          <SummaryLine label="Phí vận chuyển" value={order.shippingFee ?? 0} />
          <SummaryLine label="Giảm giá" value={order.discountAmount ?? 0} />
          <SummaryLine label="Tổng cộng" value={order.total} strong />
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <div className="text-neutral-500">{label}</div>
      <div className="mt-1 font-medium">{value || "-"}</div>
    </div>
  );
}

function SummaryLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{Number(value || 0).toLocaleString("vi-VN")}₫</span>
    </div>
  );
}
