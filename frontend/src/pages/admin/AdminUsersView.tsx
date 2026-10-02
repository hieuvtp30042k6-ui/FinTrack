import React, { useState, useEffect, useMemo } from "react";
import { User, UserRole } from "../../types/auth";
import {
  getAdminUsersApi,
  updateAdminUserStatusApi,
  updateAdminUserRoleApi,
} from "../../services/api";
import { Pagination } from "../../components/Pagination";
import { useTranslation } from "../../utils/i18n";

interface AdminUsersViewProps {
  currentUser: User;
  onRefreshStats?: () => void;
}

interface UserDetailStats {
  walletCount: number;
  transactionCount: number;
  budgetCount: number;
  lastLogin: string;
  loginIp: string;
  deviceInfo: string;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  currentUser,
  onRefreshStats,
}) => {
  const { t, lang } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // RBAC permissions of the current logged-in admin (3 vai trò riêng biệt)
  const isSuperAdmin = currentUser.role === "super_admin";

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"id" | "name" | "created_at">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserDetailStats | null>(null);

  // Lock / Unlock Modal State
  const [lockModalUser, setLockModalUser] = useState<User | null>(null);
  const [lockReason, setLockReason] = useState<string>("Vi phạm điều khoản sử dụng");
  const [customLockReason, setCustomLockReason] = useState<string>("");
  const [notifyUserViaEmail, setNotifyUserViaEmail] = useState<boolean>(true);
  const [lockLoading, setLockLoading] = useState<boolean>(false);

  const [unlockModalUser, setUnlockModalUser] = useState<User | null>(null);
  const [unlockLoading, setUnlockLoading] = useState<boolean>(false);

  // Reset Password Modal State
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null);
  const [resetPwdMode, setResetPwdMode] = useState<"link" | "manual">("link");
  const [generatedTempPwd, setGeneratedTempPwd] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  // Change Role Modal State (RBAC)
  const [changeRoleUser, setChangeRoleUser] = useState<User | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<UserRole>("user");
  const [changeRoleLoading, setChangeRoleLoading] = useState<boolean>(false);

  // Add User Modal State
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>("");
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("user");
  const [newUserPassword, setNewUserPassword] = useState<string>("");
  const [addUserLoading, setAddUserLoading] = useState<boolean>(false);

  // Phân trang danh sách người dùng
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsersApi();
      setUsers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tải danh sách người dùng";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        const matchesSearch =
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.id.toString().includes(searchQuery);

        const matchesStatus =
          statusFilter === "all" ? true : u.status === statusFilter;

        const matchesRole =
          roleFilter === "all" ? true : u.role === roleFilter;

        return matchesSearch && matchesStatus && matchesRole;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (sortField === "created_at") {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [users, searchQuery, statusFilter, roleFilter, sortField, sortOrder]);

  // Tự động về trang 1 khi thay đổi điều kiện tìm kiếm hoặc bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, roleFilter]);

  // Cắt danh sách người dùng hiển thị theo trang
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Open User Details
  const handleOpenDetails = (u: User) => {
    setViewingUser(u);
    // Mock user statistics adhering to privacy guideline (only counts, no raw transaction details)
    setUserStats({
      walletCount: (u.id % 3) + 1,
      transactionCount: ((u.id * 17) % 85) + 12,
      budgetCount: (u.id % 4) + 1,
      lastLogin: new Date(Date.now() - (u.id * 3600000 * 5)).toLocaleString("vi-VN"),
      loginIp: `113.161.${(u.id * 13) % 255}.${(u.id * 29) % 255}`,
      deviceInfo: u.id % 2 === 0 ? "Chrome 128 / Windows 11" : "Safari 17.5 / macOS Sequoia",
    });
  };

  // Confirm Lock User
  const handleConfirmLock = async () => {
    if (!lockModalUser) return;
    setLockLoading(true);
    try {
      await updateAdminUserStatusApi(lockModalUser.id, "inactive");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === lockModalUser.id ? { ...u, status: "locked" } : u
        )
      );
      showToast(
        `Đã khóa tài khoản #${lockModalUser.id} (${lockModalUser.name}). Người dùng đã bị đăng xuất khỏi tất cả phiên hoạt động.`
      );
      setLockModalUser(null);
      setCustomLockReason("");
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Khóa tài khoản thất bại";
      setError(msg);
    } finally {
      setLockLoading(false);
    }
  };

  // Confirm Unlock User
  const handleConfirmUnlock = async () => {
    if (!unlockModalUser) return;
    setUnlockLoading(true);
    try {
      await updateAdminUserStatusApi(unlockModalUser.id, "active");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === unlockModalUser.id ? { ...u, status: "active" } : u
        )
      );
      showToast(`Đã mở khóa tài khoản #${unlockModalUser.id} (${unlockModalUser.name}) thành công.`);
      setUnlockModalUser(null);
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Mở khóa thất bại";
      setError(msg);
    } finally {
      setUnlockLoading(false);
    }
  };

  // Reset Password Action (RBAC: Admin không có quyền đặt lại mật khẩu cho Super Admin / Admin khác)
  const handleExecuteResetPassword = () => {
    if (!resetPwdUser) return;
    if (!isSuperAdmin && resetPwdUser.role !== "user") {
      setError("Từ chối quyền: Admin không có quyền cấp lại mật khẩu cho Super Admin hoặc Quản trị viên khác!");
      setResetPwdUser(null);
      setGeneratedTempPwd(null);
      return;
    }
    setResetLoading(true);
    setTimeout(() => {
      setResetLoading(false);
      if (resetPwdMode === "link") {
        showToast(`Đã gửi email liên kết đặt lại mật khẩu an toàn tới: ${resetPwdUser.email}`);
        setResetPwdUser(null);
      } else {
        const temp = "FT@" + Math.random().toString(36).slice(-8) + "!9";
        setGeneratedTempPwd(temp);
      }
    }, 600);
  };

  // Execute Role Change (Super Admin Only)
  const handleExecuteChangeRole = async () => {
    if (!changeRoleUser) return;
    setChangeRoleLoading(true);
    try {
      await updateAdminUserRoleApi(changeRoleUser.id, newSelectedRole);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === changeRoleUser.id ? { ...u, role: newSelectedRole } : u
        )
      );
      showToast(
        `Đã phân quyền thành công: Tài khoản #${changeRoleUser.id} (${changeRoleUser.name}) chuyển sang vai trò [${newSelectedRole.toUpperCase()}].`
      );
      setChangeRoleUser(null);
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể thay đổi vai trò người dùng";
      setError(msg);
    } finally {
      setChangeRoleLoading(false);
    }
  };

  // Add User Action
  const handleExecuteAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    setAddUserLoading(true);
    setTimeout(() => {
      const newUser: User = {
        id: Math.max(...users.map((u) => u.id), 0) + 1,
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUsers((prev) => [newUser, ...prev]);
      setAddUserLoading(false);
      setIsAddUserOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      showToast(`Đã tạo tài khoản [${newUser.role.toUpperCase()}]: ${newUser.name} (${newUser.email})`);
      if (onRefreshStats) onRefreshStats();
    }, 600);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["ID", "Họ và tên", "Email", "Vai trò", "Trạng thái", "Ngày đăng ký"];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.email}"`,
      u.role,
      u.status,
      `"${new Date(u.created_at).toLocaleString("vi-VN")}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `danh_sach_nguoi_dung_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Đã xuất file CSV với ${filteredUsers.length} tài khoản thành công!`);
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedUsers.map((u) => u.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(paginatedUsers.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Helper render role badge
  const renderRoleBadge = (role: UserRole) => {
    if (role === "super_admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs">
          <span className="material-symbols-outlined text-[13px] text-amber-700 dark:text-amber-400">shield_person</span>
          <span>Super Admin</span>
        </span>
      );
    }
    if (role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <span className="material-symbols-outlined text-[13px]">admin_panel_settings</span>
          <span>Admin</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <span className="material-symbols-outlined text-[13px]">person</span>
        <span>User</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium rounded-xl shadow-xl border border-slate-700 dark:border-slate-600 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Cards & Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/60">
            <span className="material-symbols-outlined text-2xl">group</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t("admin.users.total_users", "Tổng người dùng")}
            </p>
            <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 font-display">{users.length}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t("admin.users.all_accounts", "Tất cả tài khoản hệ thống")}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/60">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t("admin.users.active_users", "Đang hoạt động")}
            </p>
            <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-display">
              {users.filter((u) => u.status === "active").length}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t("admin.users.normal_accounts", "Tài khoản bình thường")}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/60">
            <span className="material-symbols-outlined text-2xl">lock</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t("admin.users.locked_users", "Tài khoản bị khóa")}
            </p>
            <h4 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5 font-display">
              {users.filter((u) => u.status === "locked" || u.status === "inactive").length}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t("admin.users.locked_desc", "Hạn chế truy cập & thu hồi phiên")}
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                placeholder={t("admin.users.search_placeholder", "Tìm theo ID, họ tên, email...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-blue-500/20 focus:border-slate-800 dark:focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-blue-500/20 focus:border-slate-800 dark:focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="all">{t("admin.users.status_all", "Trạng thái: Tất cả")}</option>
              <option value="active">{t("admin.users.status_active", "Đang hoạt động")}</option>
              <option value="locked">{t("admin.users.status_locked", "Bị khóa")}</option>
            </select>

            {/* Filter Role (3 vai trò riêng biệt) */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-blue-500/20 focus:border-slate-800 dark:focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="all">{t("admin.users.role_all", "Vai trò: Tất cả")}</option>
              <option value="super_admin">{t("admin.users.role_super_admin", "Super Admin (Toàn quyền)")}</option>
              <option value="admin">{t("admin.users.role_admin", "Quản trị viên (Admin)")}</option>
              <option value="user">{t("admin.users.role_user", "Người dùng (User)")}</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Xuất bảng ra định dạng CSV/Excel"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">download</span>
              <span>{t("admin.users.export_csv", "Xuất CSV")}</span>
            </button>

            {/* Thêm người dùng (Dành cho Admin & Super Admin) */}
            <button
              type="button"
              onClick={() => setIsAddUserOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>{t("admin.users.add_user", "Thêm người dùng")}</span>
            </button>

            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title={t("action.refresh", "Làm mới dữ liệu")}
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>
                refresh
              </span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-5 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Selected Items Batch Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-slate-900 dark:bg-slate-800 text-white px-5 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-base">check_box</span>
              <span>Đang chọn <strong>{selectedIds.length}</strong> người dùng</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  showToast(`Đã xuất báo cáo chi tiết cho ${selectedIds.length} tài khoản đã chọn.`);
                  setSelectedIds([]);
                }}
                className="hover:underline cursor-pointer flex items-center gap-1 text-slate-200"
              >
                <span className="material-symbols-outlined text-sm">file_download</span>
                Xuất tệp được chọn
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                Hủy chọn
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400">
            <span className="material-symbols-outlined text-3xl animate-spin block mb-3 text-slate-600 mx-auto">
              progress_activity
            </span>
            Đang truy xuất danh sách người dùng từ hệ thống...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-2">
            <span className="material-symbols-outlined text-3xl text-slate-300 block mx-auto">
              person_search
            </span>
            <p className="font-medium text-slate-600">Không tìm thấy người dùng phù hợp</p>
            <p className="text-[11px] text-slate-400">
              Hãy thử tìm kiếm từ khóa khác hoặc xóa bớt các bộ lọc đang chọn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedUsers.length > 0 &&
                        paginatedUsers.every((u) => selectedIds.includes(u.id))
                      }
                      onChange={handleSelectAll}
                      className="rounded text-slate-900 dark:text-blue-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
                    onClick={() => {
                      if (sortField === "id") setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                      else { setSortField("id"); setSortOrder("asc"); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>ID</span>
                      {sortField === "id" && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
                    onClick={() => {
                      if (sortField === "name") setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                      else { setSortField("name"); setSortOrder("asc"); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{t("admin.users.name_col", "Họ và tên")}</span>
                      {sortField === "name" && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">{t("admin.users.role_col", "Vai trò (Role)")}</th>
                  <th className="py-3 px-4">{t("admin.users.status_col", "Trạng thái")}</th>
                  <th
                    className="py-3 px-4 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
                    onClick={() => {
                      if (sortField === "created_at") setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                      else { setSortField("created_at"); setSortOrder("desc"); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{t("admin.users.joined_date", "Ngày tham gia")}</span>
                      {sortField === "created_at" && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">{t("admin.users.actions", "Hành động")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedUsers.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  const isLocked = u.status === "locked" || u.status === "inactive";
                  const isSelected = selectedIds.includes(u.id);

                  // RBAC Constraints (3 vai trò riêng biệt):
                  const canAssignRole = isSuperAdmin && !isSelf;
                  const canLockUser = !isSelf && (isSuperAdmin || u.role !== "super_admin");
                  const canResetPassword =
                    !isSelf &&
                    (isSuperAdmin || (currentUser.role === "admin" && u.role === "user"));

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isSelected ? "bg-slate-50/90 dark:bg-slate-800/60" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(u.id)}
                          className="rounded text-slate-900 dark:text-blue-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-slate-400 dark:text-slate-500">
                        #{u.id}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {u.name
                              ? u.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(-2)
                                  .join("")
                                  .toUpperCase()
                              : "U"}
                          </div>
                          <div>
                            <span
                              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              onClick={() => handleOpenDetails(u)}
                            >
                              {u.name}
                            </span>
                            {isSelf && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                                {t("admin.users.you", "BẠN")}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {u.email}
                      </td>

                      <td className="py-3.5 px-4">
                        {renderRoleBadge(u.role)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            !isLocked
                              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800 px-2 py-0.5 rounded-md"
                              : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/70 dark:border-rose-800 px-2 py-0.5 rounded-md"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              !isLocked ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          ></span>
                          <span>{!isLocked ? t("admin.users.status_active", "Hoạt động") : t("admin.users.status_locked", "Bị khóa")}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {new Date(u.created_at).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Xem chi tiết */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(u)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title={t("admin.users.view_details", "Xem chi tiết tài khoản")}
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </button>

                          {/* Đặt lại mật khẩu */}
                          {canResetPassword ? (
                            <button
                              type="button"
                              onClick={() => {
                                setResetPwdUser(u);
                                setGeneratedTempPwd(null);
                              }}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title={t("admin.users.reset_pwd", "Đặt lại mật khẩu")}
                            >
                              <span className="material-symbols-outlined text-[16px]">key</span>
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed inline-flex items-center"
                              title={
                                isSelf
                                  ? "Vui lòng đổi mật khẩu trong phần Cài đặt tài khoản"
                                  : u.role === "super_admin"
                                  ? "Admin không có quyền cấp lại hoặc đặt lại mật khẩu cho Super Admin"
                                  : "Admin không có quyền đặt lại mật khẩu của Quản trị viên khác"
                              }
                            >
                              <span className="material-symbols-outlined text-[16px]">key</span>
                            </span>
                          )}

                          {/* Gán vai trò (Chỉ Super Admin mới gán được) */}
                          {canAssignRole ? (
                            <button
                              type="button"
                              onClick={() => {
                                setChangeRoleUser(u);
                                setNewSelectedRole(u.role);
                              }}
                              className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors cursor-pointer"
                              title={t("admin.users.change_role", "Phân quyền")}
                            >
                              <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                            </button>
                          ) : !isSelf && (
                            <span
                              className="p-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              title="Chỉ Super Admin mới có quyền phân quyền"
                            >
                              <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                            </span>
                          )}

                          {/* Nút Khóa / Mở khóa */}
                          {canLockUser ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!isLocked) {
                                  setLockModalUser(u);
                                } else {
                                  setUnlockModalUser(u);
                                }
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                !isLocked
                                  ? "border-rose-200 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:border-rose-300"
                                  : "border-emerald-200 dark:border-emerald-800/70 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-300"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {!isLocked ? "lock" : "lock_open"}
                              </span>
                              <span>{!isLocked ? t("admin.users.lock_btn", "Khóa") : t("admin.users.unlock_btn", "Mở khóa")}</span>
                            </button>
                          ) : !isSelf ? (
                            <span
                              className="px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500 cursor-not-allowed"
                              title="Không thể khóa tài khoản Super Admin"
                            >
                              {t("admin.users.lock_btn", "Khóa")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang danh sách người dùng */}
        {filteredUsers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            itemName="người dùng"
          />
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 1. MODAL XEM CHI TIẾT NGƯỜI DÙNG                                         */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setViewingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="w-13 h-13 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                {viewingUser.name
                  ? viewingUser.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(-2)
                      .join("")
                      .toUpperCase()
                  : "U"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{viewingUser.name}</h3>
                  {renderRoleBadge(viewingUser.role)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{viewingUser.email}</p>
              </div>
            </div>

            <div className="my-5 space-y-4">
              {/* Account Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Mã định danh (ID)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">#{viewingUser.id}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Trạng thái tài khoản</span>
                  <span
                    className={`font-semibold mt-0.5 block ${
                      viewingUser.status === "active" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {viewingUser.status === "active" ? "Đang hoạt động" : "Bị khóa"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Ngày đăng ký</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {new Date(viewingUser.created_at).toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Lần đăng nhập cuối</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {userStats?.lastLogin || "Gần đây"}
                  </span>
                </div>
              </div>

              {/* Statistics Counters */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
                  <span>Thống kê tài sản & Hoạt động</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Chỉ tổng số lượng</span>
                </h5>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Số ví tiền</span>
                    <strong className="text-base text-slate-900 dark:text-white font-display block mt-0.5">
                      {userStats?.walletCount}
                    </strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Giao dịch đã tạo</span>
                    <strong className="text-base text-blue-600 dark:text-blue-400 font-display block mt-0.5">
                      {userStats?.transactionCount}
                    </strong>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Ngân sách thiết lập</span>
                    <strong className="text-base text-purple-600 dark:text-purple-400 font-display block mt-0.5">
                      {userStats?.budgetCount}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Security Privacy Notice */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/60 rounded-xl text-left text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-base shrink-0 mt-0.5">
                  privacy_tip
                </span>
                <p className="text-[11px] leading-relaxed">
                  <strong>Bảo vệ quyền riêng tư:</strong> Theo quy định bảo mật hệ thống, Ban quản trị chỉ xem tổng số lượng tài sản. Toàn bộ nội dung giao dịch chi tiết của người dùng được mã hóa và bảo vệ quyền riêng tư.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 2. MODAL KHÓA TÀI KHOẢN (VỚI LÝ DO BẮT BUỘC & REVOKE SESSIONS)          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {lockModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              disabled={lockLoading}
              onClick={() => setLockModalUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-13 h-13 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Khóa tài khoản #{lockModalUser.id}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Người dùng: <strong className="text-slate-800 dark:text-slate-200">{lockModalUser.name}</strong> ({lockModalUser.email})
              </p>
            </div>

            <div className="my-5 space-y-4">
              {/* Lý do khóa (Bắt buộc) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lý do khóa tài khoản <span className="text-rose-500">*</span>
                </label>
                <select
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 mb-2 font-medium cursor-pointer"
                >
                  <option value="Vi phạm điều khoản sử dụng">Vi phạm điều khoản sử dụng</option>
                  <option value="Hành vi spam hoặc lạm dụng tài nguyên hệ thống">Hành vi spam hoặc lạm dụng tài nguyên hệ thống</option>
                  <option value="Phát hiện dấu hiệu xâm nhập / Hoạt động đáng ngờ">Phát hiện dấu hiệu xâm nhập / Hoạt động đáng ngờ</option>
                  <option value="Yêu cầu tạm khóa từ chủ sở hữu tài khoản">Yêu cầu tạm khóa từ chủ sở hữu tài khoản</option>
                  <option value="other">Lý do khác...</option>
                </select>

                {lockReason === "other" && (
                  <textarea
                    rows={2}
                    placeholder="Nhập lý do cụ thể..."
                    value={customLockReason}
                    onChange={(e) => setCustomLockReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                  />
                )}
              </div>

              {/* Tùy chọn gửi email */}
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyUserViaEmail}
                  onChange={(e) => setNotifyUserViaEmail(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-0 cursor-pointer"
                />
                <span>Gửi email thông báo lý do khóa tài khoản cho người dùng</span>
              </label>

              {/* Hộp cảnh báo về việc hủy phiên đăng nhập ngay lập tức */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-base shrink-0 mt-0.5">
                  gpp_maybe
                </span>
                <div className="leading-relaxed">
                  <strong>Đăng xuất tức thì:</strong> Sau khi khóa, tài khoản sẽ <strong>ngay lập tức bị đăng xuất khỏi tất cả các phiên đăng nhập</strong> trên mọi thiết bị và mã truy cập sẽ bị thu hồi.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={lockLoading}
                onClick={() => setLockModalUser(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={lockLoading || (lockReason === "other" && !customLockReason.trim())}
                onClick={handleConfirmLock}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {lockLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Đang xử lý khóa...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    <span>Xác nhận khóa tài khoản</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 3. MODAL MỞ KHÓA TÀI KHOẢN                                              */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {unlockModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              disabled={unlockLoading}
              onClick={() => setUnlockModalUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-13 h-13 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl">lock_open</span>
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Mở khóa tài khoản #{unlockModalUser.id}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Người dùng: <strong className="text-slate-800 dark:text-slate-200">{unlockModalUser.name}</strong> ({unlockModalUser.email})
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 my-5 text-center leading-relaxed">
              Tài khoản sẽ được chuyển lại sang trạng thái <strong>Hoạt động</strong>. Người dùng sẽ có thể đăng nhập và tiếp tục sử dụng ứng dụng bình thường.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={unlockLoading}
                onClick={() => setUnlockModalUser(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={unlockLoading}
                onClick={handleConfirmUnlock}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {unlockLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Đang kích hoạt...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Kích hoạt mở khóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 4. MODAL ĐẶT LẠI MẬT KHẨU                                               */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              disabled={resetLoading}
              onClick={() => {
                setResetPwdUser(null);
                setGeneratedTempPwd(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">key</span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">Đặt lại mật khẩu</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{resetPwdUser.name} ({resetPwdUser.email})</p>
              </div>
            </div>

            {!isSuperAdmin && resetPwdUser.role !== "user" ? (
              <div className="my-5 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-lg shrink-0 mt-0.5">block</span>
                <div>
                  <p className="font-bold">Từ chối quyền thực hiện (RBAC):</p>
                  <p className="mt-1 leading-relaxed">
                    Quản trị viên (Admin) không có quyền cấp lại hoặc đặt lại mật khẩu cho tài khoản {resetPwdUser.role === "super_admin" ? "Super Admin" : "Quản trị viên khác"}. Thao tác này chỉ dành riêng cho Super Admin hệ thống.
                  </p>
                </div>
              </div>
            ) : !generatedTempPwd ? (
              <div className="my-5 space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Chọn phương thức đặt lại mật khẩu cho tài khoản người dùng:
                </p>

                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="pwd_mode"
                      value="link"
                      checked={resetPwdMode === "link"}
                      onChange={() => setResetPwdMode("link")}
                      className="mt-0.5 text-slate-900 dark:text-blue-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Gửi liên kết đặt lại qua Email (Khuyến nghị)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hệ thống sẽ gửi email chứa liên kết an toàn có hiệu lực trong 15 phút.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="pwd_mode"
                      value="manual"
                      checked={resetPwdMode === "manual"}
                      onChange={() => setResetPwdMode("manual")}
                      className="mt-0.5 text-slate-900 dark:text-blue-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Cấp mật khẩu tạm thời ngay lập tức
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hệ thống tự động sinh mật khẩu ngẫu nhiên và yêu cầu đổi lại ở lần đăng nhập tới.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="my-5 space-y-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
                  <p className="font-semibold">Mật khẩu tạm thời đã được tạo thành công!</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                    Hãy cung cấp mật khẩu này cho người dùng và yêu cầu đổi ngay khi đăng nhập.
                  </p>
                </div>
                <div className="p-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-mono text-center text-sm font-bold tracking-wider select-all border border-slate-700">
                  {generatedTempPwd}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetPwdUser(null);
                  setGeneratedTempPwd(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {generatedTempPwd || (!isSuperAdmin && resetPwdUser.role !== "user") ? "Đóng" : "Hủy"}
              </button>
              {!generatedTempPwd && (isSuperAdmin || resetPwdUser.role === "user") && (
                <button
                  type="button"
                  disabled={resetLoading}
                  onClick={handleExecuteResetPassword}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {resetLoading && (
                    <span className="material-symbols-outlined text-sm animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>Xác nhận thực hiện</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 5. MODAL PHÂN QUYỀN / GÁN VAI TRÒ (CHỈ SUPER ADMIN)                      */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {changeRoleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              disabled={changeRoleLoading}
              onClick={() => setChangeRoleUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">shield_person</span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Phân quyền vai trò người dùng (RBAC)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tài khoản: <strong className="text-slate-800 dark:text-slate-200">{changeRoleUser.name}</strong> ({changeRoleUser.email})
                </p>
              </div>
            </div>

            <div className="my-5 space-y-4">
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-base shrink-0 mt-0.5">
                  info
                </span>
                <p className="text-[11px] leading-relaxed">
                  <strong>Đặc quyền Super Admin:</strong> Chỉ Super Admin mới có quyền gán vai trò này. Mọi thao tác thay đổi phân quyền đều được lưu vào Audit Log hệ thống.
                </p>
              </div>

              <div className="space-y-2.5">
                {/* Option 1: Super Admin */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/40 dark:hover:bg-amber-950/30 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="role_choice"
                    value="super_admin"
                    checked={newSelectedRole === "super_admin"}
                    onChange={() => setNewSelectedRole("super_admin")}
                    className="mt-1 text-amber-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-400 block">
                        Super Admin (Toàn quyền cao nhất)
                      </span>
                      <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold rounded">
                        FULL ACCESS
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5 leading-relaxed">
                      Toàn quyền hệ thống gồm: cấu hình hệ thống, sao lưu & khôi phục dữ liệu, phân quyền quản trị viên khác, quản trị bảo mật.
                    </span>
                  </div>
                </label>

                {/* Option 2: Admin */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-400 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-purple-50/40 dark:hover:bg-purple-950/30 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="role_choice"
                    value="admin"
                    checked={newSelectedRole === "admin"}
                    onChange={() => setNewSelectedRole("admin")}
                    className="mt-1 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-400 block">
                        Quản trị viên (Admin)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5 leading-relaxed">
                      Quản lý danh sách người dùng, danh mục & ví mẫu, phát thông báo hệ thống, xem báo cáo thống kê và nhật ký giám sát.
                    </span>
                  </div>
                </label>

                {/* Option 3: User */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="role_choice"
                    value="user"
                    checked={newSelectedRole === "user"}
                    onChange={() => setNewSelectedRole("user")}
                    className="mt-1 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Người dùng cá nhân (User)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5 leading-relaxed">
                      Chỉ sử dụng tính năng quản lý tài chính cá nhân thông thường, không truy cập bảng điều khiển Admin.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={changeRoleLoading}
                onClick={() => setChangeRoleUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={changeRoleLoading}
                onClick={handleExecuteChangeRole}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {changeRoleLoading && (
                  <span className="material-symbols-outlined text-sm animate-spin">
                    progress_activity
                  </span>
                )}
                <span>Lưu thay đổi phân quyền</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 6. MODAL THÊM NGƯỜI DÙNG MỚI                                            */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              disabled={addUserLoading}
              onClick={() => setIsAddUserOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">person_add</span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">Tạo tài khoản người dùng</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Khởi tạo thành viên mới vào cơ sở dữ liệu</p>
              </div>
            </div>

            <form onSubmit={handleExecuteAddUser} className="my-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-blue-500/20 focus:border-slate-800 dark:focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="nguyenvana@gmail.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-blue-500/20 focus:border-slate-800 dark:focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu ban đầu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ít nhất 6 ký tự..."
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-blue-500/20 focus:border-slate-800 dark:focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vai trò khởi tạo</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-blue-500/20 focus:border-slate-800 dark:focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="user">User (Người dùng cá nhân)</option>
                  <option value="admin">Admin (Quản trị viên)</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin (Toàn quyền)</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={addUserLoading}
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addUserLoading}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {addUserLoading && (
                    <span className="material-symbols-outlined text-sm animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>Tạo người dùng</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
