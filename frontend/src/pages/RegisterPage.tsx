import React, { useState } from "react";
import { RegisterRequest } from "../types/auth";
import { registerApi } from "../services/api";
import { useTranslation } from "../utils/i18n";

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onRegisterSuccess: (email: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onSwitchToLogin,
  onRegisterSuccess,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<RegisterRequest>({
    name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dynamic Password Strength Calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: t("auth.pwd_strength_label", "Độ mạnh mật khẩu"), color: "text-slate-400 dark:text-slate-500" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd) && pwd.length >= 10) score++;

    if (score <= 1) {
      return { score: 1, label: t("auth.pwd_strength_weak", "Mật khẩu yếu"), color: "text-red-500" };
    } else if (score === 2) {
      return { score: 2, label: t("auth.pwd_strength_medium", "Mật khẩu vừa phải"), color: "text-amber-500" };
    } else {
      return { score: 3, label: t("auth.pwd_strength_safe", "Mật khẩu an toàn"), color: "text-emerald-500" };
    }
  };

  const strength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!agreed) {
      setError("Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await registerApi(formData);
      setSuccess("Đăng ký tài khoản thành công! Đang chuyển hướng sang đăng nhập...");
      setTimeout(() => {
        onRegisterSuccess(formData.email);
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng ký thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full items-center justify-center py-6 px-4">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-slate-900/10">
          <span className="material-symbols-outlined text-[20px]">
            account_balance_wallet
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-900 dark:text-white font-bold tracking-tight text-base font-display">
            FinTrack
          </span>
          <span className="text-slate-300 dark:text-slate-600 font-light">/</span>
          <span className="text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400 font-semibold">
            {t("action.register", "Đăng ký")}
          </span>
        </div>
      </div>

      {/* Main Focused Card */}
      <div className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 sm:p-10 transition-all">
        {/* Header */}
        <div className="mb-7 text-left">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t("auth.register_title", "Tạo tài khoản cá nhân")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            {t("auth.register_desc", "Bắt đầu thiết lập ngân sách và theo dõi dòng tiền thông minh mỗi ngày.")}
          </p>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        {/* Google SSO Button */}
        <button
          type="button"
          onClick={() => setError(t("auth.google_notice", "Vui lòng cấu hình Google Client ID trên môi trường thực tế."))}
          className="w-full h-11 flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-xs active:scale-[0.99] cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
              fill="#4285F4"
            />
            <path
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.35 24 12 24z"
              fill="#34A853"
            />
            <path
              d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.25C.45 8.19 0 9.99 0 12s.45 3.81 1.25 5.41l4.03-3.13z"
              fill="#FBBC05"
            />
            <path
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.93 6.72-4.93z"
              fill="#EA4335"
            />
          </svg>
          <span>{t("auth.google_login", "Đăng ký với Google")}</span>
        </button>

        {/* Divider */}
        <div className="relative my-7 flex items-center justify-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
          <span className="absolute bg-white dark:bg-slate-900 px-3 text-[10px] tracking-wider uppercase font-semibold text-slate-400 dark:text-slate-500">
            {t("auth.or_with_email", "HOẶC TIẾP TỤC VỚI EMAIL")}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Họ và tên */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold mb-1.5" htmlFor="name">
              {t("auth.name_label", "Họ và tên")}
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t("auth.name_placeholder", "Nguyễn Văn A")}
              className="w-full h-11 px-3.5 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold mb-1.5" htmlFor="email">
              {t("auth.email_label", "Địa chỉ Email")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={t("auth.email_placeholder", "name@example.com")}
              className="w-full h-11 px-3.5 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold mb-1.5" htmlFor="password">
              {t("auth.password_label", "Mật khẩu")}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={t("auth.password_placeholder", "Tối thiểu 8 ký tự")}
                className="w-full h-11 pl-3.5 pr-10 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[19px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {/* Dynamic Password Strength Indicator */}
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="grid grid-cols-3 gap-1.5 h-1 w-full rounded-full overflow-hidden">
                <div
                  className={`h-full transition-colors duration-200 ${
                    strength.score >= 1
                      ? strength.score === 1
                        ? "bg-rose-500"
                        : strength.score === 2
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                ></div>
                <div
                  className={`h-full transition-colors duration-200 ${
                    strength.score >= 2
                      ? strength.score === 2
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                ></div>
                <div
                  className={`h-full transition-colors duration-200 ${
                    strength.score >= 3 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                ></div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${strength.color}`}>
                  {strength.label}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("auth.pwd_strength_rule", "Chữ hoa, số & ký tự đặc biệt")}
                </span>
              </div>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold mb-1.5" htmlFor="confirm_password">
              {t("auth.confirm_password_label", "Xác nhận mật khẩu")}
            </label>
            <div className="relative">
              <input
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                placeholder={t("auth.confirm_password_placeholder", "Nhập lại mật khẩu")}
                className="w-full h-11 pl-3.5 pr-10 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label="Toggle password visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[19px]">
                  {showConfirmPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Terms checkbox */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-emerald-500 focus:ring-0 focus:outline-none cursor-pointer accent-slate-900 dark:accent-emerald-500"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 leading-tight select-none">
                {t("auth.terms_agree_prefix", "Tôi đồng ý với")}{" "}
                <a href="#" className="text-slate-900 dark:text-slate-200 font-semibold underline decoration-slate-300 dark:decoration-slate-600 underline-offset-2 hover:decoration-slate-900 dark:hover:decoration-white transition-all">
                  {t("auth.terms_of_service", "Điều khoản dịch vụ")}
                </a>{" "}
                {t("auth.and", "và")}{" "}
                <a href="#" className="text-slate-900 dark:text-slate-200 font-semibold underline decoration-slate-300 dark:decoration-slate-600 underline-offset-2 hover:decoration-slate-900 dark:hover:decoration-white transition-all">
                  {t("auth.privacy_policy", "Chính sách bảo mật")}
                </a>{" "}
                {t("auth.terms_agree_suffix", "của FinTrack.")}
              </span>
            </label>
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-slate-900 dark:bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-emerald-500 active:scale-[0.98] transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? t("auth.signing_up", "Đang xử lý...") : t("auth.sign_up_btn", "Tạo tài khoản miễn phí")}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </form>

        {/* Security reassurance */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">lock</span>
          <span className="text-[11px] tracking-normal">
            {t("auth.security_reassurance", "Mã hóa một chiều mật khẩu & Bảo vệ dữ liệu cá nhân")}
          </span>
        </div>
      </div>

      {/* Switcher to Login */}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("auth.has_account", "Đã có tài khoản FinTrack?")}{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-slate-900 dark:text-white hover:underline underline-offset-4 ml-1 transition-colors cursor-pointer"
          >
            {t("auth.sign_in_now", "Đăng nhập")}
          </button>
        </p>
      </div>
    </div>
  );
};
