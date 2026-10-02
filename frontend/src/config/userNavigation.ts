export interface UserNavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: string;
}

/**
 * Phase 1: User Navigation Items
 * Chỉ tập trung vào trải nghiệm và các chức năng của User (USER FIRST).
 */
export const USER_NAV_ITEMS: readonly UserNavItem[] = [
  { id: "dashboard", label: "Trang chủ", icon: "dashboard", route: "/dashboard" },
  { id: "expenses", label: "Chi tiêu", icon: "payments", route: "/expenses" },
  { id: "categories", label: "Danh mục", icon: "category", route: "/categories" },
  { id: "wallets", label: "Ví", icon: "account_balance", route: "/wallets" },
  { id: "budgets", label: "Ngân sách", icon: "pie_chart", route: "/budgets" },
  { id: "split-bill", label: "Chia tiền nhóm", icon: "group_work", route: "/split-bill" },
  { id: "reports", label: "Báo cáo", icon: "analytics", route: "/reports" },
  { id: "account", label: "Tài khoản", icon: "manage_accounts", route: "/account" },
] as const;

export type UserTabId = (typeof USER_NAV_ITEMS)[number]["id"];

export const DEFAULT_USER_TAB: UserTabId = "dashboard";

/**
 * Kiểm tra xem tabId có thuộc danh sách điều hướng hợp lệ của User hay không.
 */
export function isUserTabId(tabId: string): tabId is UserTabId {
  return USER_NAV_ITEMS.some((item) => item.id === tabId);
}

/**
 * Lấy thông tin điều hướng của User.
 * Được tách biệt hoàn toàn để Phase 2 thêm Admin mà không phải sửa User.
 */
export function getUserNavigation(): readonly UserNavItem[] {
  return USER_NAV_ITEMS;
}
