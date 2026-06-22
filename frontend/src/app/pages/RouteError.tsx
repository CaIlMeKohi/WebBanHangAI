import { Link, useRouteError } from "react-router";

export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-neutral-950">Không thể hiển thị trang</h1>
      <p className="mt-3 text-sm text-neutral-600">{message}</p>
      <Link className="mt-6 rounded-md bg-neutral-950 px-5 py-3 text-sm text-white" to="/">
        Về trang chủ
      </Link>
    </main>
  );
}
