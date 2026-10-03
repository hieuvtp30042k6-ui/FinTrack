import React, { useEffect, useState, useCallback } from "react";
import { User } from "../types/auth";
import { AdminDashboardStatsResponse } from "../types/admin";
import { getNavigationByRole } from "../config/navigation";
import { getAdminDashboardStatsApi } from "../services/api";
import { AdminDashboardView } from "./admin/AdminDashboardView";
import { AdminSystemView } from "./admin/AdminSystemView";
import { AdminSecurityView } from "./admin/AdminSecurityView";
import { AdminAccountView } from "./admin/AdminAccountView";
import { AdminCategoriesView } from "./admin/AdminCategoriesView";
import { AdminConfigView } from "./admin/AdminConfigView";
import { AdminBackupView } from "./admin/AdminBackupView";
import { AdminMonitorView } from "./admin/AdminMonitorView";
import { AdminUsersView } from "./admin/AdminUsersView";
import { AdminContentView } from "./admin/AdminContentView";
import { useTranslation } from "../utils/i18n";
import { ThemeAndLanguageBar } from "../components/ThemeAndLanguageBar";
import { setUser as setStorageUser } from "../utils/storage";

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate?: (user: User) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user: initialUser,
  onLogout,
  onUserUpdate,
}) => {
  const [user, setUser] = useState<User>(initialUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [stats, setStats] = useState<AdminDashboardStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const { t } = useTranslation();

  // Get strictly Admin navigation items from central config
  const navItems = getNavigationByRole(user.role);

  // Admin initials
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "TQ";

  // Tab label mapping helper with translation
  const getAdminTabLabel = (id: string, fallback: string) => {
    switch (id) {
      case "dashboard": return t("nav.admin_dashboard", fallback);
      case "users": return t("nav.admin_users", fallback);
      case "categories": return t("nav.admin_categories", fallback);
      case "content": return t("nav.admin_content", fallback);
      case "config": return t("nav.admin_config", fallback);
      case "backup": return t("nav.admin_backup", fallback);
      case "monitor": return t("nav.admin_monitor", fallback);
      case "system": return t("nav.admin_system", fallback);
      case "security": return t("nav.admin_security", fallback);
      case "account": return t("nav.admin_account", fallback);
      default: return fallback;
    }
  };

  // Lấy dữ liệu thống kê Dashboard Admin
  const fetchDashboardStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getAdminDashboardStatsApi();
      setStats(data);
    } catch (err: unknown) {
      console.error("Lỗi khi tải thống kê Admin:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Xuất báo cáo hệ thống dạng JSON tải về
  const handleExportSystemReport = () => {
    const exportData = {
      generated_at: new Date().toISOString(),
      admin_user: user.email,
      stats: stats,
      system_status: "Healthy",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fintrack-admin-report-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Làm mới dữ liệu hiện tại
  const handleRefreshCurrent = () => {
    fetchDashboardStats();
  };

  // Chuyển tab và tự động đóng drawer trên thiết bị di động
  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileDrawerOpen(false);
  };

  // Nội dung Sidebar (dùng chung cho cả Desktop và Mobile Drawer)
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-slate-900 select-none">
      <div className="flex flex-col">
        {/* Logo & Version */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg text-slate-900 dark:text-white tracking-tight leading-tight">
                FinTrack
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
                {t("app.admin_core", "Admin Core")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full">
              v2.4
            </span>
            {/* Nút đóng trên mobile drawer */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Navigation Menu (Role: Admin) */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                type="button"
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? "text-white" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{getAdminTabLabel(item.id, item.label)}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Chân Sidebar: Card thông tin Admin */}
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
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full shrink-0 ${
                    user.role === "super_admin"
                      ? "text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700"
                      : user.role === "admin"
                      ? "text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-700"
                      : "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {user.role === "super_admin"
                    ? "Super Admin"
                    : user.role === "admin"
                    ? "Admin"
                    : "User"}
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
      {/* 1. SIDEBAR DESKTOP CỐ ĐỊNH 260px (w-64) - Chỉ hiện trên lg */}
      <aside className="hidden lg:flex w-64 shrink-0 h-screen flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30 select-none">
        {renderSidebarContent()}
      </aside>

      {/* 2. MOBILE DRAWER SIDEBAR - Hiện khi bấm hamburger */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />
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

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
                <span className="text-slate-600 dark:text-slate-300">FinTrack</span>
                <span>/</span>
                {activeTab === "account" ? (
                  <>
                    <span className="text-slate-400 dark:text-slate-500">{t("nav.admin_account", "Cài đặt")}</span>
                    <span>/</span>
                    <span className="text-slate-900 dark:text-white font-semibold">{t("nav.admin_account", "Tài khoản")}</span>
                  </>
                ) : (
                  <span className="text-slate-900 dark:text-white font-semibold truncate">
                    {activeTab === "dashboard"
                      ? t("nav.admin_dashboard", "Trung tâm điều hành")
                      : getAdminTabLabel(activeTab, navItems.find((n) => n.id === activeTab)?.label || "Bảng quản trị")}
                  </span>
                )}
              </div>
              <h1 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                {activeTab === "dashboard"
                  ? t("nav.admin_dashboard", "Bảng điều khiển Quản trị Hệ thống")
                  : activeTab === "account"
                  ? t("nav.admin_account", "Cài đặt tài khoản")
                  : getAdminTabLabel(activeTab, navItems.find((n) => n.id === activeTab)?.label || "Bảng quản trị")}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Bộ điều khiển Chế độ Sáng/Tối & Ngôn ngữ */}
            <ThemeAndLanguageBar />

            {activeTab !== "account" && (
              <button
                onClick={handleRefreshCurrent}
                disabled={loadingStats}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-xs transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
                type="button"
                title={t("action.refresh", "Làm mới dữ liệu")}
              >
                <span
                  className={`material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400 ${
                    loadingStats ? "animate-spin" : ""
                  }`}
                >
                  refresh
                </span>
                <span className="hidden sm:inline">{t("action.refresh", "Làm mới")}</span>
              </button>
            )}

            {/* Notification Bell Icon */}
            <button
              type="button"
              className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
              title={t("notification.title", "Thông báo")}
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </button>
          </div>
        </header>

        {/* Nội dung trung tâm */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === "dashboard" ? (
            <AdminDashboardView
              user={user}
              stats={stats}
              loading={loadingStats}
              onRefresh={fetchDashboardStats}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onExportReport={handleExportSystemReport}
            />
          ) : activeTab === "users" ? (
            <AdminUsersView
              currentUser={user}
              onRefreshStats={fetchDashboardStats}
            />
          ) : activeTab === "categories" ? (
            <AdminCategoriesView />
          ) : activeTab === "content" ? (
            <AdminContentView />
          ) : activeTab === "config" ? (
            <AdminConfigView />
          ) : activeTab === "backup" ? (
            <AdminBackupView />
          ) : activeTab === "monitor" ? (
            <AdminMonitorView />
          ) : activeTab === "system" ? (
            <AdminSystemView />
          ) : activeTab === "security" ? (
            <AdminSecurityView />
          ) : activeTab === "account" ? (
            <AdminAccountView
              user={user}
              onUserUpdated={(updated) => {
                setUser(updated);
                setStorageUser(updated);
                onUserUpdate?.(updated);
              }}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <span className="material-symbols-outlined text-[32px]">
                  {navItems.find((n) => n.id === activeTab)?.icon || "dns"}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  {getAdminTabLabel(activeTab, navItems.find((n) => n.id === activeTab)?.label || "")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Mô-đun đang được phát triển.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>{t("action.back", "Quay về Dashboard")}</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
