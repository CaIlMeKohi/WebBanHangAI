import { Link } from "react-router";

export function ComingSoon() {
  return (
    <main className="min-h-[60vh] bg-white px-4 py-20 text-neutral-950">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold">Trang đang được hoàn thiện</h1>
        <p className="mt-4 text-neutral-600">Trang đang được hoàn thiện, vui lòng quay lại sau.</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-md bg-neutral-950 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Quay về trang chủ
        </Link>
      </div>
    </main>
  );
}
