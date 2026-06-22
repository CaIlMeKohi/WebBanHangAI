import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { requestPasswordReset, resetPassword, verifyPasswordResetOtp } from "../../lib/api";

type Step = "email" | "otp" | "password";

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    setError(""); setLoading(true);
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());
      setMessage(result.dev_otp ? `Mã OTP môi trường phát triển: ${result.dev_otp}` : result.detail);
      setStep("otp");
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể gửi OTP"); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setError(""); setLoading(true);
    try {
      const result = await verifyPasswordResetOtp(email.trim().toLowerCase(), otp);
      setResetToken(result.reset_token);
      setMessage("OTP chính xác. Bạn có thể tạo mật khẩu mới.");
      setStep("password");
    } catch (err) { setError(err instanceof Error ? err.message : "OTP không hợp lệ"); }
    finally { setLoading(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step === "email") return void sendOtp();
    if (step === "otp") return void verifyOtp();
    setError("");
    if (password !== confirmPassword) { setError("Mật khẩu xác nhận không khớp"); return; }
    setLoading(true);
    try {
      await resetPassword(resetToken, password);
      navigate("/login?reset=success", { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể đổi mật khẩu"); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-lg bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold">Quên mật khẩu</h1>
        <p className="text-sm text-neutral-600">
          {step === "email" && "Nhập email để nhận mã OTP."}
          {step === "otp" && `Nhập mã OTP đã gửi đến ${email}.`}
          {step === "password" && "Tạo mật khẩu mới cho tài khoản của bạn."}
        </p>
        {message && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {step === "email" && <label className="block text-sm font-medium">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-3" /></label>}
        {step === "otp" && <label className="block text-sm font-medium">Mã OTP<input required inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 w-full rounded-lg border px-4 py-3 text-center text-xl tracking-[0.3em]" /></label>}
        {step === "password" && <>
          <label className="block text-sm font-medium">Mật khẩu mới<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-3" /></label>
          <label className="block text-sm font-medium">Xác nhận mật khẩu<input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-3" /></label>
        </>}
        <button disabled={loading || (step === "otp" && otp.length !== 6)} className="w-full rounded-lg bg-neutral-900 py-3 text-white disabled:opacity-50">
          {loading ? "Đang xử lý..." : step === "email" ? "Gửi mã OTP" : step === "otp" ? "Xác nhận OTP" : "Đổi mật khẩu"}
        </button>
        {step === "otp" && <button type="button" onClick={sendOtp} disabled={loading} className="w-full text-sm underline disabled:opacity-50">Gửi lại mã OTP</button>}
        <Link to="/login" className="block text-center text-sm underline">Quay lại đăng nhập</Link>
      </form>
    </div>
  );
}
