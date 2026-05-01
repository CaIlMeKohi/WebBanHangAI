import { useState } from "react";
import { Link } from "react-router";
import { Minus, Plus, X, ShoppingBag, ArrowRight } from "lucide-react";
import { products } from "../data/products";

interface CartItem {
  id: string;
  quantity: number;
  size: string;
  color: string;
}

export function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([
    { id: "1", quantity: 2, size: "M", color: "Trắng" },
    { id: "3", quantity: 1, size: "32", color: "Đen" },
    { id: "10", quantity: 1, size: "39", color: "Trắng" },
  ]);

  const updateQuantity = (id: string, delta: number) => {
    setCartItems((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setCartItems((items) => items.filter((item) => item.id !== id));
  };

  const cartProducts = cartItems.map((item) => ({
    ...products.find((p) => p.id === item.id)!,
    cartQuantity: item.quantity,
    cartSize: item.size,
    cartColor: item.color,
  }));

  const subtotal = cartProducts.reduce(
    (sum, item) => sum + item.price * item.cartQuantity,
    0,
  );
  const shipping = subtotal > 1000000 ? 0 : 30000;
  const total = subtotal + shipping;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
            <h2 className="text-2xl font-light tracking-wide mb-2">
              Giỏ hàng của bạn đang trống
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8">
              Thêm sản phẩm để bắt đầu mua sắm
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              TIẾP TỤC MUA SẮM
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-light tracking-wide mb-8">Giỏ Hàng</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {cartProducts.map((item) => (
                <div
                  key={`${item.id}-${item.cartSize}-${item.cartColor}`}
                  className="flex gap-4 p-4 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                >
                  <Link to={`/product/${item.id}`} className="flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-32 object-cover bg-neutral-100 dark:bg-neutral-800"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-2">
                      <div>
                        <Link
                          to={`/product/${item.id}`}
                          className="font-medium hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
                        >
                          {item.name}
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          <span>Size: {item.cartSize}</span>
                          <span>•</span>
                          <span>Màu: {item.cartColor}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center border border-neutral-300 dark:border-neutral-700">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 border-x border-neutral-300 dark:border-neutral-700 min-w-[3rem] text-center">
                          {item.cartQuantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="font-medium">
                          {(item.price * item.cartQuantity).toLocaleString(
                            "vi-VN",
                          )}
                          ₫
                        </div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {item.price.toLocaleString("vi-VN")}₫ mỗi cái
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/shop"
              className="inline-flex items-center gap-2 mt-6 text-sm font-medium hover:underline"
            >
              TIẾP TỤC MUA SẮM
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div>
            <div className="bg-neutral-50 dark:bg-neutral-800 p-6 sticky top-20">
              <h2 className="text-xl font-light tracking-wide mb-6">
                Tổng Đơn Hàng
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    Tạm tính
                  </span>
                  <span className="font-medium">
                    {subtotal.toLocaleString("vi-VN")}₫
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    Vận chuyển
                  </span>
                  <span className="font-medium">
                    {shipping === 0
                      ? "Miễn phí"
                      : `${shipping.toLocaleString("vi-VN")}₫`}
                  </span>
                </div>
                {shipping === 0 && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    🎉 Bạn được miễn phí vận chuyển!
                  </div>
                )}
                {shipping > 0 && (
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    Mua thêm {(1000000 - subtotal).toLocaleString("vi-VN")}₫ để
                    được miễn phí vận chuyển
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Tổng cộng</span>
                  <span className="text-2xl font-light">
                    {total.toLocaleString("vi-VN")}₫
                  </span>
                </div>
              </div>

              <button className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors mb-3">
                THANH TOÁN
              </button>

              <div className="text-xs text-center text-neutral-600 dark:text-neutral-400">
                Thuế và phí khác sẽ được tính ở bước thanh toán
              </div>

              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Thanh toán an toàn & bảo mật</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Đổi trả miễn phí trong 30 ngày</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Giao hàng nhanh 2-5 ngày</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
