import React, { useState, useEffect } from "react";
import { User } from "../types/auth";
import { USER_NAV_ITEMS, UserTabId } from "../config/userNavigation";
import { NotificationDropdown } from "../components/NotificationDropdown";
import { SupportFeedbackModal } from "../components/SupportFeedbackModal";
import { getUserTickets, FEEDBACK_CHANGE_EVENT } from "../services/feedbackService";
import { usePrivacyMode } from "../utils/privacyMode";
import { useTranslation } from "../utils/i18n";
import { ThemeAndLanguageBar } from "../components/ThemeAndLanguageBar";

interface UserLayoutProps {
  user: User;
  activeTab: UserTabId;
  onTabChange: (tabId: UserTabId) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const UserLayout: React.FC<UserLayoutProps> = ({
  user,
  activeTab,
  onTabChange,
  onLogout,
  children,
}) => {
  const [isPrivate, togglePrivacy] = usePrivacyMode();
  const { t, lang } = useTranslation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Support & Feedback modal state
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportInitialTab, setSupportInitialTab] = useState<"submit" | "history" | "faq">("submit");
  const [hasUnreadReply, setHasUnreadReply] = useState(false);

  useEffect(() => {
    const checkReplies = () => {
      const tickets = getUserTickets(user.email, user.id);
      const hasResolved = tickets.some((t) => t.adminReply || t.status === "resolved");
      setHasUnreadReply(hasResolved);
    };
    checkReplies();
    window.addEventListener(FEEDBACK_CHANGE_EVENT, checkReplies);
    window.addEventListener("storage", checkReplies);

    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: "submit" | "history" | "faq" }>;
      if (customEvent.detail?.tab) {
        setSupportInitialTab(customEvent.detail.tab);
      }
      setIsSupportOpen(true);
    };
    window.addEventListener("fintrack:open-support-modal", handleCustomOpen);

    return () => {
      window.removeEventListener(FEEDBACK_CHANGE_EVENT, checkReplies);
      window.removeEventListener("storage", checkReplies);
      window.removeEventListener("fintrack:open-support-modal", handleCustomOpen);
    };
  }, [user.email, user.id]);

  // Avatar initials
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "U";

  // Tab label mapping helper with translation
  const getTabLabel = (id: string, fallback: string) => {
    switch (id) {
      case "dashboard": return t("nav.dashboard", fallback);
      case "expenses": return t("nav.expenses", fallback);
      case "categories": return t("nav.categories", fallback);
      case "wallets": return t("nav.wallets", fallback);
      case "budgets": return t("nav.budgets", fallback);
      case "split-bill": return t("nav.split_bill", fallback);
      case "reports": return t("nav.reports", fallback);
      case "account": return t("nav.account", fallback);
      default: return fallback;
    }
  };

  const currentItem = USER_NAV_ITEMS.find((n) => n.id === activeTab);
  const activeLabel = currentItem ? getTabLabel(currentItem.id, currentItem.label) : t("nav.dashboard", "Bảng điều khiển");

  // Xử lý chuyển tab trên mobile và tự động đóng drawer
  const handleNavClick = (tabId: UserTabId) => {
    onTabChange(tabId);
    setMobileDrawerOpen(false);
  };

  // Sidebar Menu Content (tái sử dụng cho cả Desktop và Mobile Drawer)
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-slate-900 select-none">
      <div className="flex flex-col">
        {/* Logo & Brand */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-slate-900/20">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg text-slate-900 dark:text-white tracking-tight leading-tight">
                FinTrack
              </span>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
                {t("app.personal", "Cá nhân")}
              </span>
            </div>
          </div>
          {/* Nút đóng drawer trên mobile */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Menu (Role: User) - USER FIRST */}
        <nav className="p-4 space-y-1">
          {USER_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                type="button"
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    isActive ? "text-white" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{getTabLabel(item.id, item.label)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Chân Sidebar: Card thông tin User */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div
          onClick={() => handleNavClick("account")}
          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-1">
            <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user.name}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 rounded-full shrink-0">
                  {t("app.personal", "Thành viên")}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLogout();
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors shrink-0 cursor-pointer"
            title={t("action.logout", "Đăng xuất")}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">logout</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-100 transition-colors">
      {/* 1. SIDEBAR DESKTOP CỐ ĐỊNH (w-64) - Chỉ hiện trên màn hình lớn (>= lg) */}
      <aside className="hidden lg:flex w-64 shrink-0 h-screen flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30 select-none">
        {renderSidebarContent()}
      </aside>

      {/* 2. MOBILE DRAWER SIDEBAR - Hiển thị trên màn hình nhỏ khi bấm hamburger */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop mờ phía sau */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />
          {/* Drawer trượt ra từ bên trái */}
          <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 z-50 shadow-2xl flex flex-col transition-transform animate-in slide-in-from-left duration-200">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* 3. MAIN CONTENT VIEWPORT */}
      <div className="flex-1 h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col min-w-0 transition-colors">
        {/* Header Topbar */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            {/* Nút Hamburger menu trên Mobile/Tablet */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Menu"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            {/* Breadcrumbs & Active Title */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
                <span className="text-slate-600 dark:text-slate-300">FinTrack</span>
                <span>/</span>
                {activeTab === "account" ? (
                  <>
                    <span className="text-slate-400 dark:text-slate-500">{t("nav.account", "Cài đặt")}</span>
                    <span>/</span>
                    <span className="text-slate-900 dark:text-white font-semibold">{t("nav.account", "Tài khoản")}</span>
                  </>
                ) : (
                  <span className="text-slate-900 dark:text-white font-semibold truncate">{activeLabel}</span>
                )}
              </div>
              <h1 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                {activeTab === "dashboard"
                  ? t("nav.dashboard", "Tổng quan tài chính cá nhân")
                  : activeTab === "expenses"
                  ? t("nav.expenses", "Quản lý thu chi")
                  : activeTab === "categories"
                  ? t("nav.categories", "Danh mục phân loại")
                  : activeTab === "wallets"
                  ? t("nav.wallets", "Ví tiền & Tài khoản")
                  : activeTab === "budgets"
                  ? t("nav.budgets", "Định mức ngân sách")
                  : activeTab === "split-bill"
                  ? t("nav.split_bill", "Chia tiền nhóm")
                  : activeTab === "reports"
                  ? t("nav.reports", "Báo cáo phân tích")
                  : t("nav.account", "Cài đặt tài khoản")}
              </h1>
            </div>
          </div>

          {/* Action Bar bên phải: Sáng/Tối, Ngôn ngữ, Riêng tư, Thêm giao dịch, Thông báo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Bộ điều khiển Chế độ Sáng/Tối & Ngôn ngữ */}
            <ThemeAndLanguageBar />

            {/* Chế độ riêng tư (ẩn số dư) */}
            <button
              onClick={togglePrivacy}
              type="button"
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isPrivate
                  ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-2xs"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-2xs"
              }`}
              title={
                isPrivate
                  ? t("privacy.show_balance", "Bấm để hiển thị số dư.")
                  : t("privacy.hide_balance", "Bấm để ẩn số dư nhạy cảm.")
              }
            >
              <span className="material-symbols-outlined text-[17px]">
                {isPrivate ? "visibility_off" : "visibility"}
              </span>
              <span className="hidden md:inline">
                {isPrivate ? t("privacy.hide_balance", "Đã ẩn số dư") : t("privacy.show_balance", "Riêng tư")}
              </span>
            </button>

            {/* Quick Action Button */}
            <button
              onClick={() => onTabChange("expenses")}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-medium shadow-xs transition-all cursor-pointer whitespace-nowrap"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span className="hidden sm:inline">{t("action.add", "Thêm giao dịch")}</span>
            </button>

            {/* Nút Hỗ trợ & Khiếu nại / Báo lỗi */}
            <button
              type="button"
              onClick={() => {
                setSupportInitialTab("submit");
                setIsSupportOpen(true);
              }}
              className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={lang === "en" ? "Help, Feedback & Bug Report" : "Trợ giúp, Khiếu nại & Báo lỗi"}
            >
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
              {hasUnreadReply && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </button>

            {/* Notification Dropdown */}
            <NotificationDropdown user={user} onNavigateTab={onTabChange} />
          </div>
        </header>

        {/* Nội dung trung tâm: responsive padding và pb-24 trên mobile để không bị thanh bottom che */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Floating Support & Feedback Widget */}
      <div className="fixed bottom-20 lg:bottom-6 right-6 z-30">
        <button
          type="button"
          onClick={() => {
            setSupportInitialTab(hasUnreadReply ? "history" : "submit");
            setIsSupportOpen(true);
          }}
          className="group flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          title={lang === "en" ? "Help, Complaints & Bug Report" : "Hỗ trợ, Khiếu nại & Báo lỗi"}
        >
          <span className="material-symbols-outlined text-[19px]">support_agent</span>
          <span className="text-xs font-semibold hidden md:inline">
            {lang === "en" ? "Support" : "Hỗ trợ & Góp ý"}
          </span>
          {hasUnreadReply && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-white animate-ping" />
          )}
        </button>
      </div>

      {/* 4. MOBILE BOTTOM NAVIGATION BAR - Linh hoạt cho điện thoại & tablet */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around items-center py-2 px-1 shadow-lg transition-colors">
        {[
          { id: "dashboard", icon: "dashboard", label: t("nav.dashboard", "Trang chủ") },
          { id: "expenses", icon: "payments", label: t("nav.expenses", "Thu chi") },
          { id: "wallets", icon: "account_balance", label: t("nav.wallets", "Ví") },
          { id: "budgets", icon: "pie_chart", label: t("nav.budgets", "Ngân sách") },
        ].map((btn) => {
          const isActive = activeTab === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => onTabChange(btn.id as UserTabId)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
                isActive
                  ? "text-slate-900 dark:text-emerald-400 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive ? "text-slate-900 dark:text-emerald-400" : ""}`}>
                {btn.icon}
              </span>
              <span className="text-[10px] tracking-tight mt-0.5">{btn.label}</span>
            </button>
          );
        })}

        {/* Nút Xem thêm (Mở Drawer menu các mục còn lại) */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            ["categories", "split-bill", "reports", "account"].includes(activeTab)
              ? "text-slate-900 dark:text-emerald-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">more_horiz</span>
          <span className="text-[10px] tracking-tight mt-0.5">{t("action.view_all", "Thêm")}</span>
        </button>
      </div>

      {/* Support, Bug Report & FAQ Modal */}
      <SupportFeedbackModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        user={user}
        initialTab={supportInitialTab}
      />
    </div>
  );
};
