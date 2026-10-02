import React, { useState, useEffect, useRef, useCallback } from "react";
import { User } from "../types/auth";
import { UserTabId } from "../config/userNavigation";
import { getBudgetsApi } from "../services/api";
import { getUserTickets, FEEDBACK_CHANGE_EVENT } from "../services/feedbackService";

export interface NotificationItem {
  id: string;
  type: "warning" | "danger" | "success" | "info";
  title: string;
  message: string;
  time: string;
  read: boolean;
  linkTab?: UserTabId;
}

interface NotificationDropdownProps {
  user: User;
  onNavigateTab: (tabId: UserTabId) => void;
}

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  user,
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storageKey = `fintrack_read_notifs_${user.id}`;

  // Đọc danh sách ID thông báo đã đọc từ localStorage
  const getReadIds = useCallback((): string[] => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  // Lưu ID thông báo đã đọc vào localStorage
  const saveReadIds = useCallback(
    (ids: string[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(ids));
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  // Sinh thông báo dựa trên dữ liệu ngân sách, phản hồi ticket và tài khoản thực tế
  const loadNotifications = useCallback(async () => {
    const readIds = getReadIds();
    const items: NotificationItem[] = [];

    // 1. Kiểm tra phản hồi từ Admin đối với khiếu nại / báo lỗi
    try {
      const userTickets = getUserTickets(user.email, user.id);
      userTickets
        .filter((t) => t.adminReply)
        .forEach((t) => {
          items.push({
            id: `ticket-reply-${t.id}`,
            type: "success",
            title: "Ban Quản trị đã phản hồi yêu cầu",
            message: `Yêu cầu #${t.id} (${t.title}): "${t.adminReply}"`,
            time: t.repliedAt || "Đã giải quyết",
            read: readIds.includes(`ticket-reply-${t.id}`),
            linkTab: "account",
          });
        });
    } catch {
      // ignore
    }

    // 2. Kiểm tra ngân sách
    try {
      const budgets = await getBudgetsApi();
      budgets.forEach((b) => {
        if (b.percentage > 100) {
          items.push({
            id: `budget-exceeded-${b.id}`,
            type: "danger",
            title: "Vượt hạn mức ngân sách!",
            message: `Ngân sách "${b.category_name || "Tất cả danh mục"}" đã chi ${fmt(b.spent)} đ / ${fmt(b.amount)} đ (${b.percentage}%).`,
            time: "Cảnh báo khẩn",
            read: readIds.includes(`budget-exceeded-${b.id}`),
            linkTab: "budgets",
          });
        } else if (b.percentage >= 80) {
          items.push({
            id: `budget-warning-${b.id}`,
            type: "warning",
            title: "Sắp chạm ngưỡng ngân sách",
            message: `Ngân sách "${b.category_name || "Tất cả danh mục"}" đã sử dụng ${b.percentage}%. Hãy cân nhắc chi tiêu!`,
            time: "Cảnh báo",
            read: readIds.includes(`budget-warning-${b.id}`),
            linkTab: "budgets",
          });
        }
      });
    } catch {
      // ignore
    }

    // 3. Thông báo bảo mật & Chào mừng hệ thống
    items.push({
      id: "welcome-notif",
      type: "success",
      title: "Đăng nhập an toàn",
      message: `Tài khoản ${user.email} đang hoạt động bảo mật với phiên làm việc hiện tại.`,
      time: "Hôm nay",
      read: readIds.includes("welcome-notif"),
      linkTab: "account",
    });

    // 4. Mẹo quản lý tài chính
    items.push({
      id: "smart-tip-1",
      type: "info",
      title: "Mẹo quản lý tài chính thông minh",
      message: "Xem biểu đồ phân tích cơ cấu chi tiêu định kỳ để tối ưu ít nhất 15% chi phí không cần thiết.",
      time: "Gợi ý",
      read: readIds.includes("smart-tip-1"),
      linkTab: "reports",
    });

    setNotifications(items);
  }, [getReadIds, user.email, user.id]);

  useEffect(() => {
    loadNotifications();

    const handleSync = () => {
      loadNotifications();
    };

    window.addEventListener(FEEDBACK_CHANGE_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGE_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [loadNotifications]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = (id: string) => {
    const readIds = getReadIds();
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      saveReadIds(next);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    saveReadIds(allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Click vào thông báo để chuyển tab
  const handleItemClick = (item: NotificationItem) => {
    handleMarkAsRead(item.id);
    if (item.linkTab) {
      onNavigateTab(item.linkTab);
      setIsOpen(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayedNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút quả chuông */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        title="Thông báo"
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
          isOpen
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>

        {/* Huy hiệu số lượng chưa đọc */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white shadow-xs animate-in zoom-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu thông báo */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-slate-900">
                Thông Báo
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center px-4 pt-2.5 border-b border-slate-100 gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterUnreadOnly(false)}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                !filterUnreadOnly
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterUnreadOnly(true)}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                filterUnreadOnly
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* Danh sách thông báo */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">
                  notifications_off
                </span>
                <p className="text-xs">Không có thông báo nào</p>
              </div>
            ) : (
              displayedNotifications.map((n) => {
                const iconColor =
                  n.type === "danger"
                    ? "bg-rose-50 text-rose-600"
                    : n.type === "warning"
                    ? "bg-amber-50 text-amber-600"
                    : n.type === "success"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-blue-50 text-blue-600";

                const iconName =
                  n.type === "danger"
                    ? "error"
                    : n.type === "warning"
                    ? "warning"
                    : n.type === "success"
                    ? "check_circle"
                    : "info";

                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                      !n.read ? "bg-blue-50/30" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${iconColor}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {iconName}
                      </span>
                    </div>

                    {/* Nội dung */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-xs truncate ${
                            !n.read
                              ? "font-bold text-slate-900"
                              : "font-semibold text-slate-700"
                          }`}
                        >
                          {n.title}
                        </h4>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                        <span>{n.time}</span>
                        {n.linkTab && (
                          <span className="text-blue-600 font-semibold hover:underline">
                            Xem chi tiết →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Đánh dấu tất cả là đã đọc
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
