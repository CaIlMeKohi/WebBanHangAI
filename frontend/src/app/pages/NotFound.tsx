import { Link } from "react-router";

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm uppercase tracking-[0.24em] text-neutral-500">404</p>
      <h1 className="mt-3 text-3xl font-light text-neutral-950">Không tìm thấy trang</h1>
      <p className="mt-3 text-neutral-600">
        Đường dẫn này không tồn tại hoặc đã được thay đổi.
      </p>
      <Link
        to="/shop"
        className="mt-6 rounded-md bg-neutral-950 px-5 py-3 text-sm font-medium text-white"
      >
        Quay lại mua sắm
      </Link>
    </main>
  );
}
