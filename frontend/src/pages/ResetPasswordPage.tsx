import React, { useState } from "react";
import { resetPasswordApi } from "../services/api";
import { useTranslation } from "../utils/i18n";

interface ResetPasswordPageProps {
  token: string;
  onSuccessToLogin: () => void;
  onCancelToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  token,
  onSuccessToLogin,
  onCancelToLogin,
}) => {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Dynamic Password Strength
  const calculateStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
    return Math.min(score, 3);
  };

  const strength = calculateStrength(newPassword);

  const getStrengthText = () => {
    if (!newPassword) return { text: t("auth.pwd_strength_label", "Chưa nhập"), color: "text-slate-400 dark:text-slate-500 font-medium" };
    if (newPassword.length < 8) return { text: t("auth.pwd_strength_weak", "Quá ngắn"), color: "text-rose-500 font-semibold" };
    if (strength === 1) return { text: t("auth.pwd_strength_weak", "Yếu"), color: "text-rose-500 font-semibold" };
    if (strength === 2) return { text: t("auth.pwd_strength_medium", "Trung bình"), color: "text-amber-500 font-semibold" };
    return { text: t("auth.pwd_strength_safe", "✓ Rất mạnh"), color: "text-emerald-500 font-semibold" };
  };

  const strengthStatus = getStrengthText();

  const isMatched = confirmPassword.length > 0 && confirmPassword === newPassword;
  const isMismatched = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordApi({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccessToLogin();
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đặt lại mật khẩu thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-center items-center py-6 px-4 md:px-8">
      <div className="relative w-full max-w-[480px] flex flex-col items-center">
        {/* Ambient Glows */}
        <div className="absolute -top-16 -left-12 w-64 h-64 bg-slate-200/50 dark:bg-slate-800/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute -bottom-10 -right-8 w-60 h-60 bg-emerald-100/40 dark:bg-emerald-950/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

        {/* Top Header & Brand Trace */}
        <div className="w-full flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[19px]">account_balance_wallet</span>
            </div>
            <span className="font-display font-bold text-base text-slate-900 dark:text-white tracking-tight">FinTrack</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs tracking-widest uppercase">
            <span>{t("auth.brand_subtitle", "FINTRACK")}</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{t("auth.reset_pwd_title", "ĐẶT LẠI MẬT KHẨU").toUpperCase()}</span>
          </div>
        </div>

        {/* Main Centered Focused Card */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200 dark:border-slate-800 p-6 md:p-8 relative overflow-hidden transition-colors">
          {/* Top Subtle Status Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-600"></div>

          {/* Token Validation Pill Tag */}
          <div className="flex items-center gap-2 w-fit bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full mb-4">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[15px]">check_circle</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-300 tracking-tight font-medium">{t("auth.token_valid", "Mã xác thực email hợp lệ")}</span>
            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">exp: 15:00</span>
          </div>

          {/* Card Title & Copy */}
          <div className="space-y-1 mb-6">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t("auth.reset_pwd_title", "Tạo mật khẩu mới")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("auth.reset_pwd_desc", "Vui lòng nhập mật khẩu mới cho tài khoản của bạn.")}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl p-3.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl p-3.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{t("common.success", "Đặt lại mật khẩu thành công! Đang chuyển hướng sang trang đăng nhập...")}</span>
            </div>
          )}

          {/* Password Reset Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: New Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider" htmlFor="new-password">
                  {t("auth.new_password", "MẬT KHẨU MỚI")}
                </label>
                <span className={`text-xs ${strengthStatus.color}`}>
                  {strengthStatus.text}
                </span>
              </div>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("auth.password_placeholder", "Tối thiểu 8 ký tự")}
                  className="w-full h-11 px-3.5 pr-11 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Ẩn hiện mật khẩu"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center p-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>

              {/* Password Strength Segmented Bar */}
              <div className="pt-1 space-y-1.5">
                <div className="grid grid-cols-3 gap-1.5 w-full h-1">
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      strength >= 1
                        ? strength === 1
                          ? "bg-rose-500"
                          : strength === 2
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  ></div>
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      strength >= 2
                        ? strength === 2
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  ></div>
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      strength >= 3 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500">verified_user</span>
                  <span>{t("auth.pwd_req_rule", "Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số & ký tự đặc biệt")}</span>
                </p>
              </div>
            </div>

            {/* Field 2: Confirm New Password */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider" htmlFor="confirm-password">
                  {t("auth.confirm_new_password", "XÁC NHẬN MẬT KHẨU MỚI")}
                </label>
              </div>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.confirm_password_placeholder", "Nhập lại mật khẩu mới")}
                  className="w-full h-11 px-3.5 pr-11 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Ẩn hiện mật khẩu xác nhận"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center p-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showConfirmPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>

              {/* Realtime Match Feedback Note */}
              <div className="min-h-[18px] flex items-center gap-1.5 pt-0.5">
                {isMatched ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t("auth.pwd_matched", "Mật khẩu hoàn toàn trùng khớp")}</span>
                  </>
                ) : isMismatched ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] text-rose-500">cancel</span>
                    <span className="text-xs text-rose-500 font-medium">{t("auth.pwd_mismatched", "Mật khẩu xác nhận chưa khớp")}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500">check_circle</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t("auth.pwd_match_rule", "Khớp với mật khẩu đã nhập ở trên")}</span>
                  </>
                )}
              </div>
            </div>

            {/* Primary CTA Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || success}
                className="group w-full h-12 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 active:scale-[0.985] text-white rounded-lg text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-75"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>{t("auth.updating_password", "Đang cập nhật mật khẩu...")}</span>
                  </>
                ) : success ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
                    <span>{t("common.success", "Đổi mật khẩu thành công!")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("auth.update_password_btn", "Cập nhật mật khẩu mới")}</span>
                    <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Security Bottom Note */}
            <div className="mt-4 pt-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px] mt-0.5">lock</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t("auth.security_reassurance", "Mã hóa một chiều mật khẩu & Bảo vệ dữ liệu cá nhân")}
              </p>
            </div>
          </form>
        </div>

        {/* Secondary Navigation Footer */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCancelToLogin}
            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-colors duration-150 py-1 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>{t("auth.cancel_back_to_login", "Hủy bỏ và quay lại Đăng nhập")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
