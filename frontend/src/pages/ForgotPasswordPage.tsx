import React, { useState } from "react";
import { forgotPasswordApi } from "../services/api";
import { useTranslation } from "../utils/i18n";

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError(null);
    setLoading(true);

    try {
      await forgotPasswordApi(email);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("common.error_occurred", "Đã xảy ra lỗi. Vui lòng thử lại sau."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-6 relative z-10">
      <div className="w-full max-w-[440px] flex flex-col items-center">
        {/* Brand Header / Breadcrumb */}
        <header className="flex items-center gap-2 mb-6 select-none">
          <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-emerald-600 flex items-center justify-center text-white shadow-sm ring-1 ring-black/5">
            <span className="material-symbols-outlined text-[19px]">account_balance_wallet</span>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span className="font-display font-bold text-slate-900 dark:text-white tracking-tight text-sm">FinTrack</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-semibold text-slate-500 dark:text-slate-400 tracking-wider text-[11px]">
              {t("auth.forgot_title", "QUÊN MẬT KHẨU").toUpperCase()}
            </span>
          </div>
        </header>

        {/* Main Card */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] p-6 sm:p-8 backdrop-blur-sm transition-colors">
          {/* Header badge & titles */}
          <div className="flex flex-col mb-6">
            <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-4 text-slate-800 dark:text-slate-200 shadow-xs">
              <span className="material-symbols-outlined text-[22px]">lock_reset</span>
            </div>
            <h1 className="font-display font-bold text-[22px] sm:text-2xl text-slate-900 dark:text-white tracking-tight mb-2">
              {t("auth.forgot_password", "Quên mật khẩu?")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("auth.forgot_instruction", "Nhập địa chỉ email liên kết với tài khoản FinTrack của bạn. Chúng tôi sẽ gửi liên kết khôi phục mật khẩu nếu tài khoản tồn tại.")}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl p-3.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider" htmlFor="emailInput">
                  {t("auth.email_label", "Địa chỉ email")}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-slate-400 dark:text-slate-500 text-[20px] pointer-events-none">
                    mail
                  </span>
                  <input
                    id="emailInput"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.email_placeholder", "name@example.com")}
                    className="w-full h-11 pl-10 pr-3.5 bg-slate-50/50 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <button
                id="submitBtn"
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 active:bg-slate-950 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all duration-150 mt-1 cursor-pointer group disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>{t("auth.sending_reset_link", "Đang gửi liên kết...")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("auth.send_reset_link", "Gửi liên kết khôi phục")}</span>
                    <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Dynamic Success Notice */
            <div className="mt-2 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 rounded-xl p-3.5 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px] shrink-0 mt-0.5">
                check_circle
              </span>
              <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-normal">
                {t("auth.forgot_success_notice", "Yêu cầu đã được ghi nhận. Vui lòng kiểm tra hộp thư đến (và thư mục spam) của địa chỉ email đã cung cấp trong vài phút tới để đặt lại mật khẩu.")}
              </p>
            </div>
          )}

          {/* Security Badge/Notice Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
            <span className="material-symbols-outlined text-[17px] text-emerald-600 dark:text-emerald-400">lock_clock</span>
            <span className="font-normal">
              {t("auth.forgot_validity", "Liên kết có hiệu lực trong 15 phút & sử dụng một lần duy nhất.")}
            </span>
          </div>
        </div>

        {/* Back to login link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>{t("auth.back_to_login", "Quay lại Đăng nhập")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
