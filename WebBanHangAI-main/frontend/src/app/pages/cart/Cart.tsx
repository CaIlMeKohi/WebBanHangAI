import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";

import {
  createPayOSPayment,
  createOrder,
  deleteCartItem,
  applyCouponToCart,
  fetchAvailableCouponsForCart,
  fetchAddresses,
  fetchCart,
  fetchProductById,
  updateCartItem,
  type ApiAddress,
  type ApiCartItem,
  type ApiCartCouponOption,
} from "../../lib/api";
import {
  CART_UPDATED_EVENT,
  readStoredCart,
  writeStoredCart,
} from "../../lib/cartStorage";
import { useAdminAuth } from "../../context/AdminAuthContext";

type PaymentMethod = "cod" | "payos";

export function Cart({ embedded = false }: { embedded?: boolean }) {
  const { isAuthReady, userId } = useAdminAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ApiCartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState<ApiCartCouponOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paidOrder, setPaidOrder] = useState<{
    orderId: number;
    amount: number;
  } | null>(null);
  const [paymentNotice, setPaymentNotice] = useState("");

  useEffect(() => {
    if (searchParams.get("payment") !== "success") return;
    setPaymentNotice("Thanh toán thành công");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("payment");
    nextParams.delete("orderId");
    setSearchParams(nextParams, { replace: true });
    const timer = window.setTimeout(() => setPaymentNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  async function loadLocalCartItems() {
    const storedItems = readStoredCart();
    const hydratedItems = await Promise.all(
      storedItems.map(async (item, index) => {
        try {
          const product = await fetchProductById(item.id);
          return {
            cart_item_id: index + 1,
            product_id: Number(item.id),
            product,
            variant_id: null,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
          } as ApiCartItem;
        } catch {
          return null;
        }
      }),
    );
    const nextItems = hydratedItems.filter(Boolean) as ApiCartItem[];
    setItems(nextItems);
    setSelectedIds(nextItems.map((item) => item.cart_item_id));
  }

  function writeLocalQuantity(item: ApiCartItem, quantity: number) {
    const nextItems = readStoredCart().map((storedItem) =>
      storedItem.id === String(item.product_id) &&
      storedItem.size === item.size &&
      storedItem.color === item.color
        ? { ...storedItem, quantity }
        : storedItem,
    );
    writeStoredCart(nextItems);
  }

  function removeLocalItemsById(ids: number[]) {
    const targetItems = items.filter((item) => ids.includes(item.cart_item_id));
    const nextItems = readStoredCart().filter(
      (storedItem) =>
        !targetItems.some(
          (targetItem) =>
            storedItem.id === String(targetItem.product_id) &&
            storedItem.size === targetItem.size &&
            storedItem.color === targetItem.color,
        ),
    );
    writeStoredCart(nextItems);
  }

  useEffect(() => {
    if (!isAuthReady) return;
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent("/cart")}`, { replace: true });
      return;
    }

    let isMounted = true;
    const activeUserId = userId;
    async function loadCart() {
      try {
        const cart = await fetchCart(activeUserId);
        const nextAddresses = await fetchAddresses(activeUserId).catch(() => []);
        if (!isMounted) return;
        setItems(cart);
        setSelectedIds(cart.map((item) => item.cart_item_id));
        setAddresses(nextAddresses);
        const defaultAddress = nextAddresses.find((address) => address.is_default) ?? nextAddresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.address_id);
          setReceiverName(defaultAddress.full_name);
          setReceiverPhone(defaultAddress.phone);
        }
      } catch {
        if (isMounted) {
          await loadLocalCartItems();
        }
      }
    }
    void loadCart();
    return () => {
      isMounted = false;
    };
  }, [isAuthReady, navigate, userId]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.cart_item_id)),
    [items, selectedIds],
  );
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const shipping = subtotal > 1_000_000 || subtotal === 0 ? 0 : 30_000;
  const total = Math.max(0, subtotal + shipping - discountAmount);

  async function changeQuantity(item: ApiCartItem, delta: number) {
    if (!userId) return;
    const nextQuantity = Math.max(1, item.quantity + delta);
    setItems((current) =>
      current.map((candidate) =>
        candidate.cart_item_id === item.cart_item_id
          ? { ...candidate, quantity: nextQuantity }
          : candidate,
      ),
    );
    try {
      await updateCartItem(userId, item.cart_item_id, nextQuantity);
    } catch {
      writeLocalQuantity(item, nextQuantity);
    }
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }

  async function removeOne(itemId: number) {
    if (!userId) return;
    setItems((current) =>
      current.filter((item) => item.cart_item_id !== itemId),
    );
    setSelectedIds((current) => current.filter((id) => id !== itemId));
    try {
      await deleteCartItem(userId, itemId);
    } catch {
      removeLocalItemsById([itemId]);
    }
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }

  async function removeSelected() {
    if (!userId || selectedIds.length === 0) return;
    const ids = [...selectedIds];
    setItems((current) =>
      current.filter((item) => !ids.includes(item.cart_item_id)),
    );
    setSelectedIds([]);
    try {
      await Promise.all(ids.map((id) => deleteCartItem(userId, id)));
    } catch {
      removeLocalItemsById(ids);
    }
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }

  function openCheckout() {
    setError("");
    if (selectedIds.length === 0) {
      setError("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán.");
      return;
    }
    if (addresses.length === 0) {
      setError("Vui lòng thêm địa chỉ giao hàng trong hồ sơ trước khi thanh toán.");
      return;
    }
    const selectedAddress =
      addresses.find((address) => address.address_id === selectedAddressId) ??
      addresses.find((address) => address.is_default) ??
      addresses[0];
    setSelectedAddressId(selectedAddress.address_id);
    setReceiverName((current) => current || selectedAddress.full_name);
    setReceiverPhone((current) => current || selectedAddress.phone);
    setPaymentMethod("cod");
    setPaidOrder(null);
    setCouponCode("");
    setDiscountAmount(0);
    setCouponMessage("");
    setIsCheckoutOpen(true);
  }

  function selectAddress(addressId: number) {
    const address = addresses.find((candidate) => candidate.address_id === addressId);
    setSelectedAddressId(addressId);
    if (address) {
      setReceiverName(address.full_name);
      setReceiverPhone(address.phone);
    }
  }

  async function applyCoupon() {
    setCouponMessage("");
    setDiscountAmount(0);
    if (!userId) return;
    if (!couponCode.trim()) {
      setCouponMessage("Không sử dụng coupon.");
      return;
    }
    try {
      const result = await applyCouponToCart({
        user_id: userId,
        code: couponCode,
        cart_item_ids: selectedIds,
      });
      setDiscountAmount(result.discount_amount);
      setCouponMessage(`Đã áp dụng ${result.coupon.code}: giảm ${result.discount_amount.toLocaleString("vi-VN")} VND.`);
    } catch (err) {
      setCouponMessage(err instanceof Error ? err.message : "Coupon không hợp lệ.");
    }
  }

  useEffect(() => {
    if (!isCheckoutOpen || !userId || selectedIds.length === 0) return;

    let isMounted = true;
    const activeUserId = userId;
    async function loadAvailableCoupons() {
      try {
        const results = await fetchAvailableCouponsForCart(activeUserId, selectedIds);
        if (isMounted) {
          setAvailableCoupons(results);
        }
      } catch {
        if (isMounted) {
          setAvailableCoupons([]);
        }
      }
    }

    void loadAvailableCoupons();
    return () => {
      isMounted = false;
    };
  }, [isCheckoutOpen, selectedIds, userId]);

  async function submitCheckout() {
    setError("");
    if (!userId) return;
    if (!selectedAddressId) {
      setError("Vui lòng chọn địa chỉ giao hàng.");
      return;
    }
    if (!receiverName.trim() || !receiverPhone.trim()) {
      setError("Vui lòng nhập tên và số điện thoại người nhận.");
      return;
    }
    setIsSubmitting(true);
    try {
      const ids = [...selectedIds];
      const order = await createOrder(userId, paymentMethod, ids, {
        address_id: selectedAddressId,
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        coupon_code: couponCode.trim() || undefined,
      });
      setPaidOrder({ orderId: order.order_id, amount: order.final_amount });
      if (paymentMethod === "cod") {
        removeCheckedOutItems(ids);
      } else {
        await openPayOSCheckout(order.order_id, ids);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể thanh toán đơn hàng.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function removeCheckedOutItems(ids: number[]) {
    setItems((current) =>
      current.filter((item) => !ids.includes(item.cart_item_id)),
    );
    setSelectedIds([]);
    removeLocalItemsById(ids);
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }

  async function openPayOSCheckout(orderId: number, ids: number[]) {
    const payment = await createPayOSPayment(orderId);
    removeCheckedOutItems(ids);
    window.location.assign(payment.checkout_url);
  }

  async function continuePayOSPayment() {
    if (!paidOrder) return;
    setError("");
    setIsSubmitting(true);
    try {
      const ids = [...selectedIds];
      await openPayOSCheckout(paidOrder.orderId, ids);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể mở payOS.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className={`${embedded ? "py-10" : "min-h-screen py-16"} bg-white dark:bg-neutral-900`}>
        <div className={`${embedded ? "w-full" : "mx-auto max-w-7xl px-4"} text-center`}>
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-neutral-300" />
          <h2 className="mb-2 text-2xl font-light">
            Giỏ hàng của bạn đang trống
          </h2>
          <p className="mb-8 text-neutral-600 dark:text-neutral-400">
            Thêm sản phẩm để bắt đầu mua sắm.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-neutral-900 px-8 py-3 font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Tiếp tục mua sắm
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-white dark:bg-neutral-900`}>
      {paymentNotice && (
        <div className="fixed left-1/2 top-24 z-[70] -translate-x-1/2 rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white shadow-lg">
          {paymentNotice}
        </div>
      )}
      <div className={embedded ? "w-full" : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"}>
        {!embedded && <h1 className="mb-6 text-3xl font-light tracking-wide">Giỏ hàng</h1>}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-neutral-900 dark:text-neutral-100">
            <input
              type="checkbox"
              checked={selectedIds.length === items.length}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked
                    ? items.map((item) => item.cart_item_id)
                    : [],
                )
              }
            />
            Chọn tất cả
          </label>
          <button
            onClick={() => void removeSelected()}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Xóa sản phẩm đã chọn
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {items.map((item) => (
              <div
                key={item.cart_item_id}
                className="flex gap-4 border border-neutral-200 bg-white p-4 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              >
                <input
                  type="checkbox"
                  className="mt-2 h-5 w-5"
                  checked={selectedIds.includes(item.cart_item_id)}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...current, item.cart_item_id]
                        : current.filter((id) => id !== item.cart_item_id),
                    )
                  }
                />
                <Link
                  to={`/product/${item.product_id}`}
                  className="flex-shrink-0"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="h-32 w-24 object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex justify-between gap-3">
                    <div>
                      <Link
                        to={`/product/${item.product_id}`}
                        className="font-medium hover:underline"
                      >
                        {item.product.name}
                      </Link>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        Kích cỡ: {item.size} · Màu: {item.color}
                      </div>
                    </div>
                    <button
                      onClick={() => void removeOne(item.cart_item_id)}
                      className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center border border-neutral-300 dark:border-neutral-700">
                      <button
                        onClick={() => void changeQuantity(item, -1)}
                        className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-12 border-x border-neutral-300 px-4 py-2 text-center dark:border-neutral-700">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => void changeQuantity(item, 1)}
                        className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {(item.product.price * item.quantity).toLocaleString(
                          "vi-VN",
                        )}{" "}
                        VND
                      </div>
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {item.product.price.toLocaleString("vi-VN")} VND / cái
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit border border-neutral-200 bg-neutral-50 p-6 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-800 dark:text-white">
            <h2 className="mb-6 text-xl font-light">Tổng đơn hàng</h2>
            <div className="mb-6 space-y-4 text-sm">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <strong>{subtotal.toLocaleString("vi-VN")} VND</strong>
              </div>
              <div className="flex justify-between">
                <span>Vận chuyển</span>
                <strong>
                  {shipping === 0
                    ? "Miễn phí"
                    : `${shipping.toLocaleString("vi-VN")} VND`}
                </strong>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Giảm giá</span>
                  <strong>-{discountAmount.toLocaleString("vi-VN")} VND</strong>
                </div>
              )}
            </div>
            <div className="mb-6 border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Tổng cộng</span>
                <span className="text-2xl font-light">
                  {total.toLocaleString("vi-VN")} VND
                </span>
              </div>
            </div>
            {error && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}
            <button
              onClick={openCheckout}
              className="mb-3 w-full rounded-xl bg-neutral-900 py-4 font-medium tracking-wide text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Thanh toán
            </button>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline dark:text-neutral-100"
            >
              Tiếp tục mua sắm
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </div>

      {isCheckoutOpen && (
        <CheckoutModal
          amount={total}
          error={error}
          paidOrder={paidOrder}
          paymentMethod={paymentMethod}
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          receiverName={receiverName}
          receiverPhone={receiverPhone}
          couponCode={couponCode}
          discountAmount={discountAmount}
          couponMessage={couponMessage}
          availableCoupons={availableCoupons}
          isSubmitting={isSubmitting}
          setPaymentMethod={setPaymentMethod}
          setReceiverName={setReceiverName}
          setReceiverPhone={setReceiverPhone}
          setCouponCode={setCouponCode}
          onSelectAddress={selectAddress}
          onApplyCoupon={() => void applyCoupon()}
          onClose={() => setIsCheckoutOpen(false)}
          onSubmit={() => void submitCheckout()}
          onReturn={() => {
            setIsCheckoutOpen(false);
            setPaidOrder(null);
            navigate("/profile?tab=orders");
          }}
          onPayOSContinue={() => void continuePayOSPayment()}
        />
      )}
    </div>
  );
}

function CheckoutModal({
  amount,
  error,
  paidOrder,
  paymentMethod,
  addresses,
  selectedAddressId,
  receiverName,
  receiverPhone,
  couponCode,
  discountAmount,
  couponMessage,
  availableCoupons,
  isSubmitting,
  setPaymentMethod,
  setReceiverName,
  setReceiverPhone,
  setCouponCode,
  onSelectAddress,
  onApplyCoupon,
  onClose,
  onSubmit,
  onReturn,
  onPayOSContinue,
}: {
  amount: number;
  error: string;
  paidOrder: { orderId: number; amount: number } | null;
  paymentMethod: PaymentMethod;
  addresses: ApiAddress[];
  selectedAddressId: number | null;
  receiverName: string;
  receiverPhone: string;
  couponCode: string;
  discountAmount: number;
  couponMessage: string;
  availableCoupons: ApiCartCouponOption[];
  isSubmitting: boolean;
  setPaymentMethod: (method: PaymentMethod) => void;
  setReceiverName: (value: string) => void;
  setReceiverPhone: (value: string) => void;
  setCouponCode: (value: string) => void;
  onSelectAddress: (addressId: number) => void;
  onApplyCoupon: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onReturn: () => void;
  onPayOSContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-950 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="mb-4 text-xl font-semibold">Thanh toán</h2>

        {!paidOrder && (
          <>
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium">Địa chỉ giao hàng</div>
              <div className="space-y-2">
                {addresses.map((address) => (
                  <button
                    key={address.address_id}
                    type="button"
                    onClick={() => onSelectAddress(address.address_id)}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${selectedAddressId === address.address_id ? "border-neutral-950 bg-neutral-50 text-neutral-950 dark:border-white dark:bg-neutral-900 dark:text-white" : "border-neutral-200 bg-white text-neutral-950 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-100 dark:hover:border-neutral-700"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{address.full_name}</span>
                      {address.is_default && <span className="text-xs text-neutral-500 dark:text-neutral-400">Mặc định</span>}
                    </div>
                    <div className="mt-1 text-neutral-600 dark:text-neutral-300">{address.phone}</div>
                    <div className="mt-1 text-neutral-600 dark:text-neutral-300">
                      {address.address_line}, {address.ward}, {address.district}, {address.province}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Tên người nhận</span>
                <input
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white"
                  value={receiverName}
                  onChange={(event) => setReceiverName(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Số điện thoại</span>
                <input
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white"
                  value={receiverPhone}
                  onChange={(event) => setReceiverPhone(event.target.value)}
                />
              </label>
            </div>

            <div className="mb-4">
              <div className="mb-2 text-sm font-medium">Mã giảm giá</div>
              <div className="space-y-2">
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition-colors focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                >
                  <option value="">Không dùng coupon</option>
                  {availableCoupons.map((item) => (
                    <option key={item.coupon.coupon_id} value={item.coupon.code}>
                      {item.coupon.code}
                      {item.coupon.name ? ` - ${item.coupon.name}` : ""}
                      {` - giảm ${item.discount_amount.toLocaleString("vi-VN")} VND`}
                    </option>
                  ))}
                </select>
                <input
                  list="available-cart-coupons"
                  className="min-w-0 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm uppercase text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder="Nhập hoặc chọn mã coupon"
                />
                <datalist id="available-cart-coupons">
                  {availableCoupons.map((item) => (
                    <option key={item.coupon.coupon_id} value={item.coupon.code}>
                      {item.coupon.name || item.coupon.code}
                    </option>
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={onApplyCoupon}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900"
                >
                  Áp dụng
                </button>
              </div>
              {couponMessage && (
                <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{couponMessage}</div>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("cod")}
                className={`rounded-xl border p-4 text-left transition-colors ${paymentMethod === "cod" ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-neutral-200 bg-white text-neutral-950 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:hover:border-neutral-700"}`}
              >
                <div className="font-medium">Tiền mặt</div>
                <div className="text-xs opacity-75">COD</div>
              </button>
              <button
                onClick={() => setPaymentMethod("payos")}
                className={`rounded-xl border p-4 text-left transition-colors ${paymentMethod === "payos" ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-neutral-200 bg-white text-neutral-950 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:hover:border-neutral-700"}`}
              >
                <QrCode className="mb-1 h-5 w-5" />
                <div className="font-medium">payOS / VietQR</div>
              </button>
            </div>
            <div className="mb-4 flex justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
              <span>Giảm giá</span>
              <strong>{discountAmount.toLocaleString("vi-VN")} VND</strong>
            </div>
            <div className="mb-4 flex justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
              <span>Tổng thanh toán</span>
              <strong>{amount.toLocaleString("vi-VN")} VND</strong>
            </div>
            {error && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="w-full rounded-xl bg-neutral-950 py-3 font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              {isSubmitting ? "Đang xử lý..." : "Thanh toán"}
            </button>
          </>
        )}

        {paidOrder && paymentMethod === "cod" && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
            <div className="text-lg font-semibold">Đã ghi nhận đơn hàng</div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              Đơn #{paidOrder.orderId} sẽ được thanh toán tiền mặt khi nhận hàng.
            </p>
            <button
              onClick={onReturn}
              className="mt-5 w-full rounded-xl bg-neutral-950 py-3 font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Xác nhận
            </button>
          </div>
        )}

        {paidOrder && paymentMethod === "payos" && (
          <div className="text-center">
            <QrCode className="mx-auto mb-3 h-12 w-12 text-sky-600" />
            <div className="text-lg font-semibold">Đơn hàng đã được tạo</div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              Tiếp tục đến cổng payOS để thanh toán đơn #{paidOrder.orderId}.
            </p>
            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}
            <button
              onClick={onPayOSContinue}
              disabled={isSubmitting}
              className="mt-5 w-full rounded-xl bg-neutral-950 py-3 font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              {isSubmitting ? "Đang mở payOS..." : "Tiếp tục thanh toán với payOS"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
