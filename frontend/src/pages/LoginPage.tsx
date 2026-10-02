import React, { useState } from "react";
import { LoginRequest, User } from "../types/auth";
import { loginApi } from "../services/api";
import { setToken, setUser } from "../utils/storage";
import { useTranslation } from "../utils/i18n";

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onLoginSuccess: (user: User) => void;
  onSwitchToForgotPassword?: () => void;
  initialEmail?: string;
  alertMessage?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSwitchToRegister,
  onLoginSuccess,
  onSwitchToForgotPassword,
  initialEmail = "",
  alertMessage = null,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LoginRequest>({
    email: initialEmail,
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await loginApi(formData);
      setToken(response.access_token, rememberMe);
      setUser(response.user, rememberMe);
      onLoginSuccess(response.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full items-center justify-center py-6 px-4">
      {/* Brand & Breadcrumb Header */}
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
            {t("action.login", "Đăng Nhập")}
          </span>
        </div>
      </div>

      {/* Primary Authentication Card */}
      <div className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 sm:p-10 flex flex-col relative transition-all">
        {/* Header Typography */}
        <div className="flex flex-col mb-6">
          <h1 className="font-display text-2xl text-slate-900 dark:text-white font-bold tracking-tight">
            {t("auth.login_title", "Đăng nhập tài khoản")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            {t("auth.login_desc", "Chào mừng bạn quay trở lại với FinTrack. Quản lý chi tiêu và dòng tiền thông minh.")}
          </p>
        </div>

        {/* Feedback Alert */}
        {(error || alertMessage) && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:rose-300 text-xs flex items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-lg shrink-0">
                {alertMessage && !error ? "lock" : "error"}
              </span>
              <span className="font-medium">{error || alertMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md transition-colors text-rose-600 dark:text-rose-400 cursor-pointer"
              title="Đóng thông báo"
            >
              <span className="material-symbols-outlined text-base leading-none">close</span>
            </button>
          </div>
        )}

        {/* Google SSO Action */}
        <button
          type="button"
          onClick={() => {
            setError(t("auth.google_notice", "Vui lòng cấu hình Google Client ID trên môi trường thực tế."));
            setTimeout(() => setError(null), 4000);
          }}
          className="w-full h-11 flex items-center justify-center gap-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors duration-150 shadow-sm cursor-pointer group"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span className="text-sm text-slate-700 dark:text-slate-200 font-medium group-hover:text-primary transition-colors">
            {t("auth.google_login", "Đăng nhập với Google")}
          </span>
        </button>

        {/* Structural Divider */}
        <div className="relative flex items-center justify-center my-6">
          <div className="w-full h-px bg-slate-200 dark:bg-slate-800"></div>
          <span className="absolute bg-white dark:bg-slate-900 px-2.5 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
            {t("auth.or_with_email", "Hoặc tiếp tục với email")}
          </span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold" htmlFor="login-email">
              {t("auth.email_label", "Địa chỉ email")}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={(e) => {
                setError(null);
                setFormData({ ...formData, email: e.target.value });
              }}
              placeholder={t("auth.email_placeholder", "name@example.com")}
              className="w-full h-11 px-3.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold" htmlFor="login-password">
                {t("auth.password_label", "Mật khẩu")}
              </label>
              <button
                type="button"
                onClick={onSwitchToForgotPassword}
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:underline transition-all cursor-pointer"
              >
                {t("auth.forgot_password", "Quên mật khẩu?")}
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={(e) => {
                  setError(null);
                  setFormData({ ...formData, password: e.target.value });
                }}
                placeholder={t("auth.password_placeholder", "••••••••")}
                className="w-full h-11 pl-3.5 pr-11 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Hiện/ẩn mật khẩu"
                className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Remember Device Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 dark:text-emerald-500 accent-slate-900 dark:accent-emerald-500 cursor-pointer transition-all"
            />
            <label htmlFor="rememberMe" className="text-xs text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              {t("auth.remember_me", "Ghi nhớ đăng nhập trên thiết bị này")}
            </label>
          </div>

          {/* Primary Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? t("auth.signing_in", "Đang đăng nhập...") : t("auth.sign_in_btn", "Đăng nhập")}</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>

        {/* Trust & Security Sub-Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">verified_user</span>
          <span className="text-[11px]">
            {t("auth.security_notice", "Bảo mật chuẩn mã hóa end-to-end & xác thực 2 lớp")}
          </span>
        </div>
      </div>

      {/* Bottom Switcher */}
      <div className="mt-6 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
        <span>{t("auth.no_account", "Chưa có tài khoản FinTrack?")}</span>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-sm text-slate-900 dark:text-white font-semibold hover:underline transition-all cursor-pointer"
        >
          {t("auth.sign_up_now", "Đăng ký ngay")}
        </button>
      </div>
    </div>
  );
};
