import { UserRole } from "../types/auth";
import { USER_NAV_ITEMS, UserNavItem } from "./userNavigation";

export { USER_NAV_ITEMS };
export type { UserNavItem };
export type NavItem = UserNavItem;

/**
 * Admin Navigation - Được giữ nguyên cho Phase 2 (Admin)
 * Không mở rộng hoặc sửa đổi trong Phase 1 (User First).
 */
export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard",   label: "Tổng quan",            icon: "dashboard",          route: "/admin/dashboard" },
  { id: "users",       label: "Người dùng",           icon: "group",              route: "/admin/users" },
  { id: "categories",  label: "Danh Mục",             icon: "category",           route: "/admin/categories" },
  { id: "content",     label: "Phản Hồi",             icon: "campaign",           route: "/admin/content" },
  { id: "config",      label: "Cấu hình hệ thống",    icon: "settings",           route: "/admin/config" },
  { id: "backup",      label: "Sao lưu & Khôi phục",  icon: "cloud_upload",       route: "/admin/backup" },
  { id: "monitor",     label: "Giám sát",              icon: "monitoring",         route: "/admin/monitor" },
  { id: "system",      label: "Thống Kê",             icon: "dns",                route: "/admin/system" },
  { id: "security",    label: "Bảo Mật",              icon: "verified_user",      route: "/admin/security" },
  { id: "account",     label: "Tài khoản Quản trị",   icon: "manage_accounts",    route: "/admin/account" },
] as const;

/**
 * Trả về danh sách menu điều hướng theo 3 vai trò riêng biệt (RBAC):
 * 1. Super Admin: Toàn quyền, cấu hình hệ thống, sao lưu/khôi phục, phân quyền
 * 2. Admin: Quản lý người dùng, danh mục & ví, nội dung & thông báo, giám sát, thống kê
 * 3. User: Ứng dụng quản lý tài chính cá nhân
 */
export function getNavigationByRole(role: UserRole): readonly NavItem[] {
  if (role === "super_admin") {
    return ADMIN_NAV_ITEMS;
  }
  if (role === "admin") {
    // Admin không có quyền cấu hình hệ thống (config) và sao lưu/khôi phục (backup)
    return ADMIN_NAV_ITEMS.filter(
      (item) => item.id !== "config" && item.id !== "backup"
    );
  }
  return USER_NAV_ITEMS;
}
