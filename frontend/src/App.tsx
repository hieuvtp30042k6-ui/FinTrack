import React, { useState, useEffect } from "react";
import { User } from "./types/auth";
import { getUser, setUser, clearAuth } from "./utils/storage";
import { getMyProfileApi } from "./services/api";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { UserDashboard } from "./pages/UserDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { ThemeAndLanguageBar } from "./components/ThemeAndLanguageBar";
import { useTranslation } from "./utils/i18n";

export const App: React.FC = () => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<"login" | "register" | "forgot-password" | "reset-password">("login");
  const [registeredEmail, setRegisteredEmail] = useState<string>("");
  const [resetToken, setResetToken] = useState<string>("");
  const [sessionAlert, setSessionAlert] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check existing logged-in session (Section 10 & 16: Test 4 - Refresh / F5)
    const user = getUser();
    if (user) {
      setCurrentUser(user);
      // F01: Luôn đồng bộ hồ sơ mới nhất từ CSDL (avatar, tên, thông tin tài khoản)
      getMyProfileApi()
        .then((freshUser) => {
          if (freshUser) {
            setCurrentUser(freshUser);
            setUser(freshUser);
          }
        })
        .catch(() => {});
    } else {
      // Route protection: If unauthenticated, clear any protected route hash and enforce login
      if (window.location.hash) {
        window.location.hash = "";
      }
    }

    // 2. Check if URL contains reset password token: ?token=...
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setAuthView("reset-password");
    }

    // 3. Listen to auth expiration event from API client (Section 10 & 15: 401 token expiry / 403 locked)
    const handleAuthExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string; isLocked?: boolean }>;
      clearAuth();
      setCurrentUser(null);
      setAuthView("login");
      window.location.hash = "";
      if (customEvent?.detail?.isLocked) {
        setSessionAlert("Tài khoản của bạn đã bị khóa bởi Quản trị viên. Bạn đã được đăng xuất khỏi toàn bộ phiên làm việc.");
      } else if (customEvent?.detail?.message) {
        setSessionAlert(customEvent.detail.message);
      } else {
        setSessionAlert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
    };

    window.addEventListener("fintrack:auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("fintrack:auth-expired", handleAuthExpired);
    };
  }, []);

  // 4. Định kỳ kiểm tra tính hợp lệ của phiên đăng nhập (phát hiện ngay khi bị Admin khóa)
  useEffect(() => {
    if (!currentUser) return;

    const verifySession = async () => {
      try {
        const freshUser = await getMyProfileApi();
        if (freshUser) {
          setCurrentUser((prev) => {
            if (
              !prev ||
              prev.name !== freshUser.name ||
              prev.avatar_url !== freshUser.avatar_url ||
              prev.email !== freshUser.email
            ) {
              setUser(freshUser);
              return freshUser;
            }
            return prev;
          });
        }
      } catch {
        // Lỗi 401/403 đã được tự động xử lý trong handleResponse (api.ts) và phát sự kiện fintrack:auth-expired
      }
    };

    // Kiểm tra định kỳ mỗi 5 giây
    const intervalId = setInterval(verifySession, 5000);

    // Kiểm tra ngay khi người dùng chuyển lại tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        verifySession();
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [currentUser]);

  const handleLoginSuccess = (user: User) => {
    setSessionAlert(null);
    setCurrentUser(user);
  };

  const handleRegisterSuccess = (email: string) => {
    setRegisteredEmail(email);
    setAuthView("login");
  };

  const handleLogout = () => {
    clearAuth();
    setCurrentUser(null);
    setAuthView("login");
    window.location.hash = "";
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setUser(updatedUser);
  };

  // If authenticated, navigate based on Role with strict protection (Section 10, 11)
  if (currentUser) {
    if (currentUser.role === "super_admin" || currentUser.role === "admin") {
      return (
        <AdminDashboard
          user={currentUser}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
        />
      );
    }
    if (currentUser.role === "user") {
      // Phase 1: User Layout & User Navigation
      return (
        <UserDashboard
          user={currentUser}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
        />
      );
    }
    // Invalid role safeguard
    handleLogout();
    return null;
  }

  // If not authenticated, render selected authentication view (Route Protection)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between transition-colors">
      {/* Global Header */}
      <header className="w-full py-4 px-4 sm:px-8 md:px-12 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <span className="material-symbols-outlined text-[19px]">account_balance_wallet</span>
          </div>
          <span className="font-display font-bold text-lg text-slate-900 dark:text-white tracking-tight">FinTrack</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Bộ điều khiển Chế độ Sáng/Tối & Ngôn ngữ */}
          <ThemeAndLanguageBar />

          <button
            onClick={() => setAuthView("login")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              authView === "login"
                ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {t("action.login", "Đăng nhập")}
          </button>
          <button
            onClick={() => setAuthView("register")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              authView === "register"
                ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {t("action.register", "Đăng ký")}
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="w-full flex-1 flex flex-col items-center justify-center p-4">
        {authView === "login" && (
          <LoginPage
            onSwitchToRegister={() => setAuthView("register")}
            onSwitchToForgotPassword={() => setAuthView("forgot-password")}
            onLoginSuccess={handleLoginSuccess}
            initialEmail={registeredEmail}
            alertMessage={sessionAlert}
          />
        )}

        {authView === "register" && (
          <RegisterPage
            onSwitchToLogin={() => setAuthView("login")}
            onRegisterSuccess={handleRegisterSuccess}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {authView === "forgot-password" && (
          <ForgotPasswordPage
            onBackToLogin={() => setAuthView("login")}
          />
        )}

        {authView === "reset-password" && (
          <ResetPasswordPage
            token={resetToken}
            onSuccessToLogin={() => setAuthView("login")}
            onCancelToLogin={() => setAuthView("login")}
          />
        )}
      </main>

      {/* Global Footer */}
      <footer className="w-full py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
        {t("auth.footer_text", "© 2026 FinTrack Inc. Hệ thống Quản lý Chi tiêu Cá nhân & Gia đình.")}
      </footer>
    </div>
  );
};

export default App;

