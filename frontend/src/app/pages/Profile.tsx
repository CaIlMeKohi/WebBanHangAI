import { useState } from "react";
import { useSearchParams, Link } from "react-router";
import { User, Package, Heart, Settings, ChevronRight } from "lucide-react";
import { products } from "../data/products";

export function Profile() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "profile";

  const mockOrders = [
    {
      id: "ORD-2026-001",
      date: "20 tháng 3, 2026",
      status: "Đã giao",
      total: 2499000,
      items: [{ productId: "4", quantity: 1, size: "M", color: "Be" }],
    },
    {
      id: "ORD-2026-002",
      date: "15 tháng 3, 2026",
      status: "Đang giao",
      total: 598000,
      items: [{ productId: "1", quantity: 2, size: "L", color: "Trắng" }],
    },
    {
      id: "ORD-2026-003",
      date: "5 tháng 3, 2026",
      status: "Đã giao",
      total: 1199000,
      items: [{ productId: "5", quantity: 1, size: "M", color: "Trắng" }],
    },
  ];

  const wishlistItems = [
    products.find((p) => p.id === "2"),
    products.find((p) => p.id === "7"),
    products.find((p) => p.id === "8"),
    products.find((p) => p.id === "11"),
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-light tracking-wide mb-8">
          Tài Khoản Của Tôi
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <nav className="space-y-1">
              <a
                href="?tab=profile"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                  activeTab === "profile"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Hồ Sơ</span>
              </a>
              <a
                href="?tab=orders"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                  activeTab === "orders"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <Package className="w-5 h-5" />
                <span className="text-sm font-medium">Đơn Hàng</span>
              </a>
              <a
                href="?tab=wishlist"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                  activeTab === "wishlist"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <Heart className="w-5 h-5" />
                <span className="text-sm font-medium">Yêu Thích</span>
              </a>
              <a
                href="?tab=settings"
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                  activeTab === "settings"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Cài Đặt</span>
              </a>
            </nav>
          </aside>

          <main className="lg:col-span-3">
            {activeTab === "profile" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Thông Tin Cá Nhân
                </h2>
                <div className="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Họ và tên
                      </label>
                      <input
                        type="text"
                        defaultValue="Nguyễn Văn A"
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        defaultValue="nguyenvana@example.com"
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        defaultValue="0912345678"
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Ngày sinh
                      </label>
                      <input
                        type="date"
                        defaultValue="1990-01-01"
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">
                        Địa chỉ
                      </label>
                      <textarea
                        defaultValue="123 Đường ABC, Quận 1, TP. Hồ Chí Minh"
                        rows={3}
                        className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                      />
                    </div>
                  </div>
                  <button className="mt-6 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors">
                    LƯU THAY ĐỔI
                  </button>
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Đơn Hàng Của Tôi
                </h2>
                <div className="space-y-4">
                  {mockOrders.map((order) => {
                    const orderProducts = order.items.map((item) => ({
                      ...products.find((p) => p.id === item.productId)!,
                      quantity: item.quantity,
                      size: item.size,
                      color: item.color,
                    }));

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
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.status === "Đã giao"
                                ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        <div className="space-y-3 mb-4">
                          {orderProducts.map((item, idx) => (
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
                                  Size: {item.size} • Màu: {item.color} • SL:{" "}
                                  {item.quantity}
                                </div>
                              </div>
                            </div>
                          ))}
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
              </div>
            )}

            {activeTab === "wishlist" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Danh Sách Yêu Thích
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlistItems.map((product: any) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      className="group border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                    >
                      <div className="aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium mb-2">{product.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {product.price.toLocaleString("vi-VN")}₫
                          </span>
                          {product.originalPrice && (
                            <span className="text-sm text-neutral-400 line-through">
                              {product.originalPrice.toLocaleString("vi-VN")}₫
                            </span>
                          )}
                        </div>
                        <button className="w-full mt-3 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors rounded">
                          Thêm vào giỏ
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div>
                <h2 className="text-2xl font-light tracking-wide mb-6">
                  Cài Đặt Tài Khoản
                </h2>
                <div className="space-y-6">
                  <div className="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-lg">
                    <h3 className="font-medium mb-4">Đổi mật khẩu</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Mật khẩu hiện tại
                        </label>
                        <input
                          type="password"
                          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Mật khẩu mới
                        </label>
                        <input
                          type="password"
                          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Xác nhận mật khẩu mới
                        </label>
                        <input
                          type="password"
                          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                        />
                      </div>
                      <button className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors">
                        CẬP NHẬT MẬT KHẨU
                      </button>
                    </div>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-lg">
                    <h3 className="font-medium mb-4">Thông báo</h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">
                          Nhận email về sản phẩm mới
                        </span>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">
                          Nhận email về khuyến mãi
                        </span>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">
                          Nhận thông báo về đơn hàng
                        </span>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
                    <h3 className="font-medium text-red-900 dark:text-red-200 mb-2">
                      Xóa tài khoản
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      Hành động này không thể hoàn tác. Tất cả dữ liệu của bạn
                      sẽ bị xóa vĩnh viễn.
                    </p>
                    <button className="px-6 py-3 bg-red-600 text-white font-medium tracking-wide hover:bg-red-700 transition-colors">
                      XÓA TÀI KHOẢN
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
