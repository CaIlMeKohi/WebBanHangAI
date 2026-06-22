import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
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
  confirmMockPayment,
  createOrder,
  deleteCartItem,
  applyCouponToCart,
  fetchAddresses,
  fetchCart,
  fetchProductById,
  updateCartItem,
  type ApiAddress,
  type ApiCartItem,
} from "../../lib/api";
import {
  CART_UPDATED_EVENT,
  readStoredCart,
  writeStoredCart,
} from "../../lib/cartStorage";
import { useAdminAuth } from "../../context/AdminAuthContext";

type PaymentMethod = "cod" | "bank_transfer";

export function Cart({ embedded = false }: { embedded?: boolean }) {
  const { isAuthReady, userId } = useAdminAuth();
  const navigate = useNavigate();
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
  const [paidOrder, setPaidOrder] = useState<{
    orderId: number;
    amount: number;
  } | null>(null);

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
    if (!userId || !couponCode.trim()) return;
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
        setItems((current) =>
          current.filter((item) => !ids.includes(item.cart_item_id)),
        );
        setSelectedIds([]);
        removeLocalItemsById(ids);
        window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể thanh toán đơn hàng.",
      );
    }
  }

  async function confirmBankPayment() {
    if (!paidOrder) return;
    setError("");
    try {
      await confirmMockPayment(paidOrder.orderId);
      const ids = [...selectedIds];
      setItems((current) =>
        current.filter((item) => !ids.includes(item.cart_item_id)),
      );
      setSelectedIds([]);
      setPaidOrder(null);
      setIsCheckoutOpen(false);
      removeLocalItemsById(ids);
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      navigate("/profile?tab=orders");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể xác nhận thanh toán.",
      );
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
      <div className={embedded ? "w-full" : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"}>
        {!embedded && <h1 className="mb-6 text-3xl font-light tracking-wide">Giỏ hàng</h1>}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
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
            className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
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
                className="flex gap-4 border border-neutral-200 p-4 dark:border-neutral-800"
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
                      <div className="mt-1 text-sm text-neutral-600">
                        Kích cỡ: {item.size} · Màu: {item.color}
                      </div>
                    </div>
                    <button
                      onClick={() => void removeOne(item.cart_item_id)}
                      className="rounded p-1 hover:bg-neutral-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center border border-neutral-300">
                      <button
                        onClick={() => void changeQuantity(item, -1)}
                        className="p-2 hover:bg-neutral-50"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-12 border-x border-neutral-300 px-4 py-2 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => void changeQuantity(item, 1)}
                        className="p-2 hover:bg-neutral-50"
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
                      <div className="text-sm text-neutral-500">
                        {item.product.price.toLocaleString("vi-VN")} VND / cái
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit bg-neutral-50 p-6 dark:bg-neutral-800">
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
            <div className="mb-6 border-t border-neutral-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Tổng cộng</span>
                <span className="text-2xl font-light">
                  {total.toLocaleString("vi-VN")} VND
                </span>
              </div>
            </div>
            {error && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              onClick={openCheckout}
              className="mb-3 w-full bg-neutral-900 py-4 font-medium tracking-wide text-white hover:bg-neutral-800"
            >
              Thanh toán
            </button>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
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
          onBankPaid={() => void confirmBankPayment()}
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
  setPaymentMethod,
  setReceiverName,
  setReceiverPhone,
  setCouponCode,
  onSelectAddress,
  onApplyCoupon,
  onClose,
  onSubmit,
  onReturn,
  onBankPaid,
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
  setPaymentMethod: (method: PaymentMethod) => void;
  setReceiverName: (value: string) => void;
  setReceiverPhone: (value: string) => void;
  setCouponCode: (value: string) => void;
  onSelectAddress: (addressId: number) => void;
  onApplyCoupon: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onReturn: () => void;
  onBankPaid: () => void;
}) {
  const returnTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/cart";
  const gatewayUrl = paidOrder
    ? `${window.location.origin}/payment-gateway?orderId=${paidOrder.orderId}&amount=${paidOrder.amount}&returnTo=${encodeURIComponent(returnTo)}`
    : "";
  const qrUrl = gatewayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(gatewayUrl)}`
    : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 hover:bg-neutral-100"
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
                    className={`w-full rounded-lg border p-3 text-left text-sm ${selectedAddressId === address.address_id ? "border-neutral-950 bg-neutral-50" : "border-neutral-200"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{address.full_name}</span>
                      {address.is_default && <span className="text-xs text-neutral-500">Mặc định</span>}
                    </div>
                    <div className="mt-1 text-neutral-600">{address.phone}</div>
                    <div className="mt-1 text-neutral-600">
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
                  className="w-full rounded border border-neutral-300 px-3 py-2"
                  value={receiverName}
                  onChange={(event) => setReceiverName(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Số điện thoại</span>
                <input
                  className="w-full rounded border border-neutral-300 px-3 py-2"
                  value={receiverPhone}
                  onChange={(event) => setReceiverPhone(event.target.value)}
                />
              </label>
            </div>

            <div className="mb-4">
              <div className="mb-2 text-sm font-medium">Mã giảm giá</div>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-neutral-300 px-3 py-2 text-sm uppercase"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                  placeholder="Nhập mã coupon"
                />
                <button
                  type="button"
                  onClick={onApplyCoupon}
                  className="rounded border px-3 py-2 text-sm font-medium"
                >
                  Áp dụng
                </button>
              </div>
              {couponMessage && (
                <div className="mt-2 text-sm text-neutral-600">{couponMessage}</div>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("cod")}
                className={`rounded-lg border p-4 text-left ${paymentMethod === "cod" ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200"}`}
              >
                <div className="font-medium">Tiền mặt</div>
                <div className="text-xs opacity-75">COD</div>
              </button>
              <button
                onClick={() => setPaymentMethod("bank_transfer")}
                className={`rounded-lg border p-4 text-left ${paymentMethod === "bank_transfer" ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200"}`}
              >
                <QrCode className="mb-1 h-5 w-5" />
                <div className="font-medium">Chuyển khoản</div>
              </button>
            </div>
            <div className="mb-4 flex justify-between rounded bg-neutral-50 p-3 text-sm">
              <span>Giảm giá</span>
              <strong>{discountAmount.toLocaleString("vi-VN")} VND</strong>
            </div>
            <div className="mb-4 flex justify-between rounded bg-neutral-50 p-3 text-sm">
              <span>Tổng thanh toán</span>
              <strong>{amount.toLocaleString("vi-VN")} VND</strong>
            </div>
            {error && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              onClick={onSubmit}
              className="w-full rounded bg-neutral-950 py-3 font-medium text-white"
            >
              Thanh toán
            </button>
          </>
        )}

        {paidOrder && paymentMethod === "cod" && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
            <div className="text-lg font-semibold">Đã ghi nhận đơn hàng</div>
            <p className="mt-2 text-sm text-neutral-600">
              Đơn #{paidOrder.orderId} sẽ được thanh toán tiền mặt khi nhận hàng.
            </p>
            <button
              onClick={onReturn}
              className="mt-5 w-full rounded bg-neutral-950 py-3 font-medium text-white"
            >
              Xác nhận
            </button>
          </div>
        )}

        {paidOrder && paymentMethod === "bank_transfer" && (
          <div className="text-center">
            <img
              src={qrUrl}
              alt="QR thanh toán"
              className="mx-auto h-60 w-60"
            />
            <p className="mt-2 text-sm text-neutral-600">
              Quét mã để mở trang thanh toán trên điện thoại.
            </p>
            <a
              href={gatewayUrl}
              className="mt-3 block rounded border py-2 text-sm"
            >
              Mở trang thanh toán
            </a>
            <button
              onClick={onBankPaid}
              className="mt-3 w-full rounded bg-neutral-950 py-3 font-medium text-white"
            >
              Tôi đã thanh toán
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
