import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, AlertCircle, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

import {
  deleteCartItem,
  fetchCart,
  fetchProductById,
  updateCartItem,
  type ApiCartItem,
} from "../../lib/api";
import { CART_UPDATED_EVENT, readStoredCart, writeStoredCart } from "../../lib/cartStorage";
import { useAdminAuth } from "../../context/AdminAuthContext";

function itemPrice(item: ApiCartItem) {
  return item.unit_price ?? item.product.price;
}

function itemLineTotal(item: ApiCartItem) {
  return item.line_total ?? itemPrice(item) * item.quantity;
}

export function Cart() {
  const { isAuthReady, userId } = useAdminAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ApiCartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  async function loadLocalCartItems() {
    const storedItems = readStoredCart();
    const hydratedItems = await Promise.all(
      storedItems.map(async (item, index) => {
        try {
          const product = await fetchProductById(item.id);
          const quantity = Math.max(1, item.quantity);
          return {
            cart_item_id: index + 1,
            product_id: Number(item.id),
            product,
            variant_id: null,
            quantity,
            size: item.size,
            color: item.color,
            unit_price: product.price,
            line_total: product.price * quantity,
            available_stock: product.stockQuantity ?? quantity,
            is_available: (product.stockQuantity ?? quantity) >= quantity,
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

  async function loadCart() {
    if (!userId) return;
    setIsLoading(true);
    setError("");
    try {
      const cart = await fetchCart(userId);
      setItems(cart);
      setSelectedIds(cart.map((item) => item.cart_item_id));
    } catch (err) {
      await loadLocalCartItems();
      setError(err instanceof Error ? err.message : "Không tải được giỏ hàng từ backend.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthReady) return;
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent("/cart")}`, { replace: true });
      return;
    }
    void loadCart();
  }, [isAuthReady, navigate, userId]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.cart_item_id)),
    [items, selectedIds],
  );
  const subtotal = selectedItems.reduce((sum, item) => sum + itemLineTotal(item), 0);
  const shipping = subtotal > 1_000_000 || subtotal === 0 ? 0 : 30_000;
  const total = subtotal + shipping;
  const hasInvalidSelection = selectedItems.some((item) => !item.is_available);

  async function changeQuantity(item: ApiCartItem, delta: number) {
    if (!userId || busyItemId !== null) return;
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1) return;
    if (typeof item.available_stock === "number" && nextQuantity > item.available_stock) {
      setError(`Sản phẩm ${item.product.name} chỉ còn ${item.available_stock} sản phẩm.`);
      return;
    }

    setBusyItemId(item.cart_item_id);
    setError("");
    const previousItems = items;
    setItems((current) =>
      current.map((candidate) =>
        candidate.cart_item_id === item.cart_item_id
          ? {
              ...candidate,
              quantity: nextQuantity,
              line_total: itemPrice(candidate) * nextQuantity,
              is_available: !candidate.available_stock || candidate.available_stock >= nextQuantity,
            }
          : candidate,
      ),
    );

    try {
      const updated = await updateCartItem(userId, item.cart_item_id, nextQuantity);
      setItems((current) =>
        current.map((candidate) => (candidate.cart_item_id === updated.cart_item_id ? updated : candidate)),
      );
    } catch (err) {
      setItems(previousItems);
      writeLocalQuantity(item, nextQuantity);
      setError(err instanceof Error ? err.message : "Không cập nhật được số lượng.");
    } finally {
      setBusyItemId(null);
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    }
  }

  async function removeOne(itemId: number) {
    if (!userId || busyItemId !== null) return;
    const previousItems = items;
    setBusyItemId(itemId);
    setError("");
    setItems((current) => current.filter((item) => item.cart_item_id !== itemId));
    setSelectedIds((current) => current.filter((id) => id !== itemId));
    try {
      await deleteCartItem(userId, itemId);
    } catch (err) {
      setItems(previousItems);
      removeLocalItemsById([itemId]);
      setError(err instanceof Error ? err.message : "Không xoá được sản phẩm.");
    } finally {
      setBusyItemId(null);
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    }
  }

  async function removeSelected() {
    if (!userId || selectedIds.length === 0 || busyItemId !== null) return;
    const ids = [...selectedIds];
    const previousItems = items;
    setError("");
    setItems((current) => current.filter((item) => !ids.includes(item.cart_item_id)));
    setSelectedIds([]);
    try {
      await Promise.all(ids.map((id) => deleteCartItem(userId, id)));
    } catch (err) {
      setItems(previousItems);
      removeLocalItemsById(ids);
      setError(err instanceof Error ? err.message : "Không xoá được sản phẩm đã chọn.");
    } finally {
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    }
  }

  function goToCheckout() {
    setError("");
    if (selectedIds.length === 0) {
      setError("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán.");
      return;
    }
    if (hasInvalidSelection) {
      setError("Giỏ hàng có sản phẩm hết hàng hoặc không hợp lệ. Vui lòng cập nhật trước khi thanh toán.");
      return;
    }
    navigate(`/checkout?items=${selectedIds.join(",")}`);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-16 text-center dark:bg-neutral-900">
        <div className="text-sm text-neutral-500">Đang tải giỏ hàng...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white py-16 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-neutral-300" />
          <h2 className="mb-2 text-2xl font-light">Giỏ hàng của bạn đang trống</h2>
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

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.length === items.length}
              onChange={(event) =>
                setSelectedIds(event.target.checked ? items.map((item) => item.cart_item_id) : [])
              }
            />
            Chọn tất cả
          </label>
          <button
            onClick={() => void removeSelected()}
            disabled={selectedIds.length === 0 || busyItemId !== null}
            className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Xoá sản phẩm đã chọn
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {items.map((item) => (
              <div
                key={item.cart_item_id}
                className={`flex gap-4 border p-4 ${
                  item.is_available ? "border-neutral-200" : "border-red-200 bg-red-50"
                } dark:border-neutral-800`}
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
                <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                  <img src={item.product.image} alt={item.product.name} className="h-32 w-24 object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex justify-between gap-3">
                    <div>
                      <Link to={`/product/${item.product_id}`} className="font-medium hover:underline">
                        {item.product.name}
                      </Link>
                      <div className="mt-1 text-sm text-neutral-600">
                        Kích cỡ: {item.size} - Màu: {item.color}
                      </div>
                      {!item.is_available && (
                        <div className="mt-2 text-sm text-red-700">
                          Không đủ tồn kho. Còn lại: {item.available_stock}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => void removeOne(item.cart_item_id)}
                      disabled={busyItemId !== null}
                      className="rounded p-1 hover:bg-neutral-100 disabled:opacity-50"
                      title="Xoá sản phẩm"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center border border-neutral-300">
                      <button
                        onClick={() => void changeQuantity(item, -1)}
                        disabled={busyItemId !== null || item.quantity <= 1}
                        className="p-2 hover:bg-neutral-50 disabled:opacity-40"
                        title="Giảm số lượng"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-12 border-x border-neutral-300 px-4 py-2 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => void changeQuantity(item, 1)}
                        disabled={busyItemId !== null}
                        className="p-2 hover:bg-neutral-50 disabled:opacity-40"
                        title="Tăng số lượng"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{itemLineTotal(item).toLocaleString("vi-VN")} VND</div>
                      <div className="text-sm text-neutral-500">
                        {itemPrice(item).toLocaleString("vi-VN")} VND / cái
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
                <span>Vận chuyển dự kiến</span>
                <strong>{shipping === 0 ? "Miễn phí" : `${shipping.toLocaleString("vi-VN")} VND`}</strong>
              </div>
            </div>
            <div className="mb-6 border-t border-neutral-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Tổng cộng</span>
                <span className="text-2xl font-light">{total.toLocaleString("vi-VN")} VND</span>
              </div>
            </div>
            <button
              onClick={goToCheckout}
              className="mb-3 w-full bg-neutral-900 py-4 font-medium tracking-wide text-white hover:bg-neutral-800"
            >
              Thanh toán
            </button>
            <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
              Tiếp tục mua sắm
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
