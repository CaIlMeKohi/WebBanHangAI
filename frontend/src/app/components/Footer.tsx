import { Facebook, Instagram, Twitter, Mail } from "lucide-react";
import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-white text-xl font-light tracking-wider mb-4">
              BKQ
            </h3>
            <p className="text-sm">
              Thời trang vượt thời gian cho người tối giản hiện đại. Những sản
              phẩm chất lượng bền bỉ.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-white text-sm font-medium tracking-wide mb-4">
              MUA SẮM
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/shop?category=women"
                  className="text-sm hover:text-white transition-colors"
                >
                  Thời Trang Nữ
                </Link>
              </li>
              <li>
                <Link
                  to="/shop?category=men"
                  className="text-sm hover:text-white transition-colors"
                >
                  Thời Trang Nam
                </Link>
              </li>
              <li>
                <Link
                  to="/shop?new=true"
                  className="text-sm hover:text-white transition-colors"
                >
                  Hàng Mới Về
                </Link>
              </li>
              <li>
                <Link
                  to="/shop?sale=true"
                  className="text-sm hover:text-white transition-colors"
                >
                  Giảm Giá
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="text-white text-sm font-medium tracking-wide mb-4">
              DỊCH VỤ KHÁCH HÀNG
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-sm hover:text-white transition-colors"
                >
                  Liên Hệ
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm hover:text-white transition-colors"
                >
                  Vận Chuyển & Đổi Trả
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm hover:text-white transition-colors"
                >
                  Hướng Dẫn Chọn Size
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm hover:text-white transition-colors"
                >
                  Câu Hỏi Thường Gặp
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-white text-sm font-medium tracking-wide mb-4">
              KẾT NỐI
            </h4>
            <div className="flex space-x-4 mb-4">
              <a href="#" className="hover:text-white transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
            <p className="text-sm mb-2">Nhận tin mới</p>
            <div className="flex">
              <input
                type="email"
                placeholder="Địa chỉ email"
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button className="px-4 py-2 bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200 transition-colors">
                Đăng ký
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm">
            <p>&copy; 2026 BKQ. Bản quyền thuộc về chúng tôi.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">
                Chính Sách Bảo Mật
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Điều Khoản Dịch Vụ
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
