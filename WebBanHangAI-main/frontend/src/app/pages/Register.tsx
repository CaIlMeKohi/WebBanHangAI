import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { AlertCircle, UserPlus } from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";

export function Register() {
  const navigate = useNavigate();
  const { register, isLoggedIn, role } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      navigate(role === "admin" ? "/admin/products" : "/shop", {
        replace: true,
      });
    }
  }, [isLoggedIn, navigate, role]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const result = register(username, password);
      if (result.success) {
        navigate("/shop", { replace: true });
      } else {
        setError(result.error ?? "Đăng ký thất bại");
      }
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="bg-neutral-900 text-white px-6 py-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <UserPlus className="w-6 h-6" />
              <h1 className="text-2xl font-bold">Đăng ký</h1>
            </div>
            <p className="text-neutral-300 text-sm">
              Tạo tài khoản mới để mua sắm trên website
            </p>
          </div>

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
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
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
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Xác nhận mật khẩu
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password || !confirmPassword}
              className="w-full py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Đang đăng ký..." : "Đăng ký"}
            </button>
          </form>

          <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200 text-center text-sm text-neutral-600 space-y-2">
            <p>
              Đã có tài khoản?{" "}
              <Link
                to="/login"
                className="font-medium text-neutral-900 underline"
              >
                Đăng nhập
              </Link>
            </p>
            <p className="font-mono text-neutral-900">User: user / 123</p>
            <p className="font-mono text-neutral-900">Admin: admin / 123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
