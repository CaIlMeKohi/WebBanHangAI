import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertCircle, Lock } from "lucide-react";

import { useAdminAuth } from "../../context/AdminAuthContext";

function extractLoginLockSeconds(message: string) {
  const match = message.match(/(?:sau|thoi|tam)\s+(\d+)\s+giay/i);
  return match ? Number(match[1]) : 0;
}

export function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoggedIn, role, userId } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginLockSeconds, setLoginLockSeconds] = useState(0);

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
            : "/";
      const target =
        role === "admin" || role === "staff"
          ? roleTarget
          : needsCustomer && !userId
            ? "/shop"
            : (next ?? roleTarget);
      navigate(target, { replace: true });
    }
  }, [isLoggedIn, navigate, role, searchParams, userId]);

  useEffect(() => {
    if (loginLockSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setLoginLockSeconds((seconds) => {
        const nextSeconds = Math.max(0, seconds - 1);
        if (nextSeconds === 0) {
          setError("");
        }
        return nextSeconds;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [loginLockSeconds]);

  useEffect(() => {
    if (loginLockSeconds > 0) {
      setError(`Đăng nhập sai nhiều lần, bị khóa tạm "${loginLockSeconds}" giây.`);
    }
  }, [loginLockSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLockSeconds > 0) return;
    setError("");
    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (!result.success) {
        const lockSeconds = extractLoginLockSeconds(result.error ?? "");
        if (lockSeconds > 0) {
          setLoginLockSeconds(lockSeconds);
          setError(`Đăng nhập sai nhiều lần, bị khóa tạm "${lockSeconds}" giây.`);
        } else {
          setError("Đăng nhập không thành công!");
        }
        setPassword("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800 p-4">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="bg-neutral-900 px-6 py-8 text-center text-white">
            <div className="mb-2 flex items-center justify-center gap-3">
              <Lock className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Đăng nhập</h1>
            </div>
            <p className="text-sm text-neutral-300">
              Dùng chung cho admin và người dùng
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            {error && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <span className="text-sm text-red-800">{error}</span>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-900">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-900">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || loginLockSeconds > 0 || !username || !password}
              className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Đang đăng nhập..." : loginLockSeconds > 0 ? `Khóa đăng nhập ${loginLockSeconds}s` : "Đăng nhập"}
            </button>
          </form>

          <div className="space-y-2 border-t border-neutral-200 bg-neutral-50 px-6 py-4 text-center text-sm text-neutral-600">
            <p>
              Chưa có tài khoản?{" "}
              <Link
                to="/register"
                className="font-medium text-neutral-900 underline"
              >
                Đăng ký
              </Link>
            </p>
            <p>
              <Link
                to="/forgot-password"
                className="font-medium text-neutral-900 underline"
              >
                Quên mật khẩu?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
