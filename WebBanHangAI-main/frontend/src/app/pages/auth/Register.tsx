import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, Eye, EyeOff, UserPlus } from "lucide-react";

import { useAdminAuth } from "../../context/AdminAuthContext";

export function Register() {
  const navigate = useNavigate();
  const { register, isLoggedIn, role } = useAdminAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("unknown");
  const [birthday, setBirthday] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      navigate(role === "admin" ? "/admin/products" : "/shop", {
        replace: true,
      });
    }
  }, [isLoggedIn, navigate, role]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Vui lòng nhập họ tên");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (!addressLine.trim() || !ward.trim() || !district.trim() || !province.trim()) {
      setError("Vui lòng nhập đầy đủ địa chỉ giao hàng");
      return;
    }

    setIsLoading(true);
    try {
      const result = await register({
        username,
        password,
        full_name: fullName,
        phone,
        gender,
        birthday: birthday || undefined,
        address_line: addressLine,
        ward,
        district,
        province,
      });
      if (result.success) {
        navigate("/shop", { replace: true });
      } else {
        setError(result.error ?? "Đăng ký thất bại");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800 p-4">
      <div className="w-full max-w-2xl">
        <div className="overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="bg-neutral-900 px-6 py-8 text-center text-white">
            <div className="mb-2 flex items-center justify-center gap-3">
              <UserPlus className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Đăng ký</h1>
            </div>
            <p className="text-sm text-neutral-300">
              Tạo tài khoản và hồ sơ khách hàng theo DB FashionShopDB
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            {error && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <span className="text-sm text-red-800">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Họ tên" className="md:col-span-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nguyen Van A"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="email@example.com"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Số điện thoại">
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0912345678"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Giới tính">
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                >
                  <option value="unknown">Không tiết lộ</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </Field>

              <Field label="Ngày sinh">
                <input
                  type="date"
                  value={birthday}
                  onChange={(event) => setBirthday(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Địa chỉ chi tiết" className="md:col-span-2">
                <input
                  type="text"
                  value={addressLine}
                  onChange={(event) => setAddressLine(event.target.value)}
                  placeholder="Số nhà, tên đường"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Phường/Xã">
                <input
                  type="text"
                  value={ward}
                  onChange={(event) => setWard(event.target.value)}
                  placeholder="Phường/Xã"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Quận/Huyện">
                <input
                  type="text"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  placeholder="Quận/Huyện"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Tỉnh/Thành phố" className="md:col-span-2">
                <input
                  type="text"
                  value={province}
                  onChange={(event) => setProvince(event.target.value)}
                  placeholder="Tỉnh/Thành phố"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  disabled={isLoading}
                />
              </Field>

              <Field label="Mật khẩu">
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  disabled={isLoading}
                  placeholder="Nhập mật khẩu"
                />
              </Field>

              <Field label="Xác nhận mật khẩu">
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((current) => !current)}
                  disabled={isLoading}
                  placeholder="Nhập lại mật khẩu"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={
                isLoading ||
                !fullName ||
                !username ||
                !password ||
                !confirmPassword ||
                !addressLine ||
                !ward ||
                !district ||
                !province
              }
              className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Đang đăng ký..." : "Đăng ký"}
            </button>
          </form>

          <div className="space-y-2 border-t border-neutral-200 bg-neutral-50 px-6 py-4 text-center text-sm text-neutral-600">
            <p>
              Đã có tài khoản?{" "}
              <Link to="/login" className="font-medium text-neutral-900 underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  visible,
  onToggle,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 px-4 py-2 pr-11 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-neutral-900">
        {label}
      </label>
      {children}
    </div>
  );
}
