import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertCircle, Lock } from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";

export function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoggedIn, role, userId } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      const next = searchParams.get("next");
      const needsCustomer =
        next?.startsWith("/cart") || next?.startsWith("/profile");
      const roleTarget =
        role === "admin"
          ? "/portal-admin/products"
          : role === "staff"
            ? "/staff"
            : "/shop";
      const target = needsCustomer && !userId ? "/shop" : (next ?? roleTarget);
      navigate(target, {
        replace: true,
      });
    }
  }, [isLoggedIn, navigate, role, searchParams, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        // Redirect is centralized in the auth effect after API role is loaded.
      } else {
        setError("Tên đăng nhập hoặc mật khẩu không chính xác");
        setPassword("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4 text-neutral-950 dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800 dark:text-white">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800">
          {/* Header */}
          <div className="border-b border-neutral-200 bg-white px-6 py-8 text-center text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Lock className="w-6 h-6" />
              <h1 className="text-2xl font-bold">Đăng nhập</h1>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Dùng chung cho admin và người dùng
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-950 shadow-sm transition-all placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-950 shadow-sm transition-all placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Đang đăng nhập..." : "Đăng Nhập"}
            </button>
          </form>

          {/* Footer */}
          <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200 text-center text-sm text-neutral-600 space-y-2">
            <p>
              Chưa có tài khoản?{" "}
              <Link
                to="/register"
                className="font-medium text-neutral-900 underline"
              >
                Đăng ký
              </Link>
            </p>
            <p>Demo credentials:</p>
            <p className="font-mono text-neutral-900">Admin: admin / 123</p>
            <p className="font-mono text-neutral-900">User: user / 123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
