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
  deleteCartItem,
  fetchCart,
  fetchProductById,
  updateCartItem,
  type ApiCartItem,
} from "../../lib/api";
import {
  CART_UPDATED_EVENT,
  readStoredCart,
  writeStoredCart,
} from "../../lib/cartStorage";
import { useAdminAuth } from "../../context/AdminAuthContext";

type PaymentMethod = "cod" | "bank_transfer";

export function Cart() {
  const { isAuthReady, userId } = useAdminAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ApiCartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
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
        if (!isMounted) return;
        setItems(cart);
        setSelectedIds(cart.map((item) => item.cart_item_id));
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
  const total = subtotal + shipping;

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
    setPaymentMethod("cod");
    setPaidOrder(null);
    setIsCheckoutOpen(true);
  }

  async function submitCheckout() {
    setError("");
    try {
      const orderId = Date.now();
      setPaidOrder({ orderId, amount: total });
      if (paymentMethod === "cod") {
        const ids = [...selectedIds];
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
    const ids = [...selectedIds];
    setItems((current) =>
      current.filter((item) => !ids.includes(item.cart_item_id)),
    );
    setSelectedIds([]);
    setPaidOrder(null);
    setIsCheckoutOpen(false);
    removeLocalItemsById(ids);
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    navigate("/cart?payment=success");
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white py-16 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 text-center">
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
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-3xl font-light tracking-wide">Giỏ hàng</h1>

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
          setPaymentMethod={setPaymentMethod}
          onClose={() => setIsCheckoutOpen(false)}
          onSubmit={() => void submitCheckout()}
          onReturn={() => {
            setIsCheckoutOpen(false);
            setPaidOrder(null);
            navigate("/cart");
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
  setPaymentMethod,
  onClose,
  onSubmit,
  onReturn,
  onBankPaid,
}: {
  amount: number;
  error: string;
  paidOrder: { orderId: number; amount: number } | null;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  onClose: () => void;
  onSubmit: () => void;
  onReturn: () => void;
  onBankPaid: () => void;
}) {
  const gatewayUrl = paidOrder
    ? `${window.location.origin}/payment-gateway?orderId=${paidOrder.orderId}&amount=${paidOrder.amount}&returnTo=${encodeURIComponent("/cart")}`
    : "";
  const qrUrl = gatewayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(gatewayUrl)}`
    : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 hover:bg-neutral-100"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="mb-4 text-xl font-semibold">Thanh toán</h2>

        {!paidOrder && (
          <>
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
            <div className="text-lg font-semibold">Đã thanh toán</div>
            <p className="mt-2 text-sm text-neutral-600">
              Đơn #{paidOrder.orderId} đã được ghi nhận thanh toán tiền mặt.
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
              target="_blank"
              rel="noreferrer"
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
