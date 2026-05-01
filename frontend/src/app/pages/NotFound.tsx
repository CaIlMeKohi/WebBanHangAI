import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
      <div className="text-center">
        <h1 className="text-6xl font-light tracking-wider mb-4">404</h1>
        <h2 className="text-2xl font-light tracking-wide mb-2">Không Tìm Thấy Trang</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          Trang bạn đang tìm kiếm không tồn tại.
        </p>
        <Link
          to="/"
          className="inline-block px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
        >
          VỀ TRANG CHỦ
        </Link>
      </div>
    </div>
  );
}
