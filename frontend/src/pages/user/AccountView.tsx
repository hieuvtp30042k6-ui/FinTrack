import React, { useState, useRef, useEffect, useMemo } from "react";
import { User } from "../../types/auth";
import {
  updateProfileApi,
  uploadAvatarApi,
  deleteAvatarApi,
  changePasswordApi,
  getConnectedAppsApi,
  revokeConnectedAppApi,
  resetUserDataApi,
  deleteAccountApi,
  ConnectedAppItem,
} from "../../services/api";
import { getUserTickets, FEEDBACK_CHANGE_EVENT } from "../../services/feedbackService";
import { useTranslation } from "../../utils/i18n";

interface AccountViewProps {
  user: User;
  onLogout?: () => void;
  onUserUpdate?: (user: User) => void;
  onUserUpdated?: (user: User) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  onLogout,
  onUserUpdate,
  onUserUpdated,
}) => {
  const { t, lang } = useTranslation();
  // Modal states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isResetDataOpen, setIsResetDataOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isConnectedAppsOpen, setIsConnectedAppsOpen] = useState(false);

  // Connected Apps state
  const [connectedApps, setConnectedApps] = useState<ConnectedAppItem[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsActionLoading, setAppsActionLoading] = useState(false);
  const [appsMessage, setAppsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset Data form state
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Delete Account form state
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 2FA state (lưu theo từng user id, mặc định true theo thiết kế)
  const [is2faEnabled, setIs2faEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`fintrack_2fa_${user.id}`);
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  // Support & Feedback tickets stats
  const [ticketCount, setTicketCount] = useState(0);
  const [resolvedTicketCount, setResolvedTicketCount] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      const tickets = getUserTickets(user.email, user.id);
      setTicketCount(tickets.length);
      setResolvedTicketCount(tickets.filter((t) => t.adminReply || t.status === "resolved").length);
    };
    updateStats();
    window.addEventListener(FEEDBACK_CHANGE_EVENT, updateStats);
    window.addEventListener("storage", updateStats);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGE_EVENT, updateStats);
      window.removeEventListener("storage", updateStats);
    };
  }, [user.email, user.id]);

  const handleOpenSupport = (tab: "submit" | "history" | "faq" = "submit") => {
    window.dispatchEvent(new CustomEvent("fintrack:open-support-modal", { detail: { tab } }));
  };

  const handleToggle2fa = () => {
    setIs2faEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`fintrack_2fa_${user.id}`, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Edit Profile Form State
  const [nameInput, setNameInput] = useState(user.name);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null);
  const [willRemoveAvatar, setWillRemoveAvatar] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Sync avatarPreview when user changes
  useEffect(() => {
    setNameInput(user.name);
    setAvatarPreview(user.avatar_url || null);
  }, [user]);

  // Compute initials
  const initials = useMemo(() => {
    if (!user.name) return "NA";
    return user.name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(-2)
      .join("")
      .toUpperCase();
  }, [user.name]);

  // Nhãn vai trò cho cả 3 vai trò
  const roleLabel = useMemo(() => {
    switch (user.role) {
      case "super_admin":
        return lang === 'en' ? "Super Administrator" : "Quản trị cấp cao (Super Admin)";
      case "admin":
        return lang === 'en' ? "Administrator (Admin)" : "Quản trị viên (Admin)";
      case "user":
      default:
        return lang === 'en' ? "Member (User)" : "Thành viên (User)";
    }
  }, [user.role, lang]);

  // Thời gian cập nhật mật khẩu lần cuối
  const lastUpdatedText = useMemo(() => {
    if (!user.updated_at) return lang === 'en' ? "Last updated: 3 months ago" : "Cập nhật lần cuối: 3 tháng trước";
    try {
      const d = new Date(user.updated_at);
      if (isNaN(d.getTime())) return lang === 'en' ? "Last updated: 3 months ago" : "Cập nhật lần cuối: 3 tháng trước";
      const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return lang === 'en' ? "Last updated: Today" : "Cập nhật lần cuối: Hôm nay";
      if (diffDays < 30) return lang === 'en' ? `Last updated: ${diffDays} days ago` : `Cập nhật lần cuối: ${diffDays} ngày trước`;
      const diffMonths = Math.floor(diffDays / 30);
      return lang === 'en' ? `Last updated: ${diffMonths} months ago` : `Cập nhật lần cuối: ${diffMonths} tháng trước`;
    } catch {
      return lang === 'en' ? "Last updated: 3 months ago" : "Cập nhật lần cuối: 3 tháng trước";
    }
  }, [user.updated_at, lang]);

  // Open Edit Profile modal
  const handleOpenEditProfile = () => {
    setNameInput(user.name);
    setSelectedFile(null);
    setAvatarPreview(user.avatar_url || null);
    setWillRemoveAvatar(false);
    setProfileError(null);
    setProfileSuccess(null);
    setIsEditProfileOpen(true);
  };

  // Handle avatar file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setProfileError("Chỉ chấp nhận file ảnh định dạng JPEG, PNG hoặc WebP");
      return;
    }

    setProfileError(null);
    setSelectedFile(file);
    setWillRemoveAvatar(false);

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  // Handle remove avatar
  const handleRemoveAvatar = () => {
    setSelectedFile(null);
    setAvatarPreview(null);
    setWillRemoveAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Callback helper for user update
  const notifyUserUpdate = (updated: User) => {
    if (onUserUpdate) onUserUpdate(updated);
    if (onUserUpdated) onUserUpdated(updated);
  };

  // Submit Profile update
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setProfileError("Họ và tên không được để trống");
      return;
    }

    setProfileLoading(true);
    try {
      let updatedUser = { ...user };

      if (selectedFile) {
        updatedUser = await uploadAvatarApi(selectedFile);
      } else if (willRemoveAvatar && user.avatar_url) {
        updatedUser = await deleteAvatarApi();
      }

      if (trimmedName !== updatedUser.name) {
        updatedUser = await updateProfileApi({ name: trimmedName });
      }

      notifyUserUpdate(updatedUser);
      setProfileSuccess("Cập nhật thông tin thành công!");
      setTimeout(() => {
        setIsEditProfileOpen(false);
        setProfileSuccess(null);
      }, 800);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Cập nhật thông tin thất bại");
    } finally {
      setProfileLoading(false);
    }
  };

  // Open Change Password modal
  const handleOpenChangePassword = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsChangePasswordOpen(true);
  };

  const COMMON_PASSWORDS = [
    "12345678", "password", "password123", "admin123", "123456789", 
    "qwerty123", "iloveyou", "welcome123", "admin@123", "password@1234"
  ];

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "Độ mạnh mật khẩu", color: "text-slate-400" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[@$!%*?&_\-#^~+=><.,:;(){}[\]|\\]/.test(pwd) && pwd.length >= 10) score++;

    if (score <= 1) {
      return { score: 1, label: "Mật khẩu yếu", color: "text-rose-600" };
    } else if (score === 2) {
      return { score: 2, label: "Mật khẩu vừa phải", color: "text-amber-500" };
    } else {
      return { score: 3, label: "Mật khẩu an toàn", color: "text-emerald-600" };
    }
  };

  const newPassStrength = getPasswordStrength(newPassword);

  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[@$!%*?&_\-#^~+=><.,:;(){}[\]|\\]/.test(newPassword);
  const isCommonPassword = COMMON_PASSWORDS.includes(newPassword.toLowerCase());

  // Submit Password Change
  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (!hasMinLength) {
      setPasswordError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }
    if (newPassword.length > 128) {
      setPasswordError("Mật khẩu không được dài quá 128 ký tự.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
      return;
    }
    if (isCommonPassword) {
      setPasswordError("Mật khẩu quá phổ biến và dễ đoán. Vui lòng chọn mật khẩu khác.");
      return;
    }

    const missingCriteria: string[] = [];
    if (!hasLower) missingCriteria.push("chữ thường");
    if (!hasUpper) missingCriteria.push("chữ hoa");
    if (!hasDigit) missingCriteria.push("chữ số");
    if (!hasSpecial) missingCriteria.push("ký tự đặc biệt");

    if (missingCriteria.length > 0) {
      setPasswordError(`Mật khẩu cần chứa: ${missingCriteria.join(", ")}.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changePasswordApi({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setPasswordSuccess(res.message || "Đổi mật khẩu thành công!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordSuccess(null);
      }, 1000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại");
    } finally {
      setPasswordLoading(false);
    }
  };

  // ─── Connected Apps Handlers ────────────────────────────────────────────────
  const loadConnectedApps = async () => {
    setLoadingApps(true);
    setAppsMessage(null);
    try {
      const res = await getConnectedAppsApi();
      setConnectedApps(res.apps || []);
    } catch (err) {
      setAppsMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tải danh sách ứng dụng đã liên kết.",
      });
    } finally {
      setLoadingApps(false);
    }
  };

  const handleOpenConnectedApps = () => {
    setIsConnectedAppsOpen(true);
    loadConnectedApps();
  };

  const handleRevokeApp = async (provider: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy liên kết và thu hồi quyền truy cập của ứng dụng này?")) {
      return;
    }
    setAppsActionLoading(true);
    setAppsMessage(null);
    try {
      const res = await revokeConnectedAppApi(provider);
      setAppsMessage({ type: "success", text: res.message || "Đã hủy liên kết thành công." });
      await loadConnectedApps();
      if (onUserUpdated) {
        onUserUpdated({ ...user, google_id: null, google_connected: false });
      }
    } catch (err) {
      setAppsMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Hủy liên kết thất bại.",
      });
    } finally {
      setAppsActionLoading(false);
    }
  };

  // ─── Reset Data Handlers ───────────────────────────────────────────────────
  const handleOpenResetData = () => {
    setResetPassword("");
    setResetConfirmation("");
    setResetError(null);
    setResetSuccess(null);
    setIsResetDataOpen(true);
  };

  const handleSubmitResetData = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    const normConfirm = resetConfirmation.trim().toUpperCase();
    if (normConfirm !== "RESET DATA" && normConfirm !== "XOA DU LIEU") {
      setResetError("Vui lòng nhập chính xác cụm từ 'RESET DATA' hoặc 'XOA DU LIEU'.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await resetUserDataApi({
        password: resetPassword || undefined,
        confirmation_text: resetConfirmation.trim(),
      });
      setResetSuccess(res.message || "Toàn bộ dữ liệu tài chính của bạn đã được làm mới thành công!");
      setTimeout(() => {
        setIsResetDataOpen(false);
        setResetSuccess(null);
        window.location.reload();
      }, 1200);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Xóa dữ liệu thất bại.");
    } finally {
      setResetLoading(false);
    }
  };

  // ─── Delete Account Handlers ────────────────────────────────────────────────
  const handleOpenDeleteAccount = () => {
    setDeletePassword("");
    setDeleteConfirmation("");
    setDeleteError(null);
    setIsDeleteAccountOpen(true);
  };

  const handleSubmitDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    const normConfirm = deleteConfirmation.trim().toUpperCase();
    if (normConfirm !== "XOA TAI KHOAN" && normConfirm !== "DELETE ACCOUNT") {
      setDeleteError("Vui lòng nhập chính xác cụm từ 'XOA TAI KHOAN' hoặc 'DELETE ACCOUNT'.");
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteAccountApi({
        password: deletePassword || undefined,
        confirmation_text: deleteConfirmation.trim(),
      });
      alert("Tài khoản của bạn đã được xóa vĩnh viễn khỏi hệ thống. Tạm biệt bạn!");
      localStorage.clear();
      if (onLogout) {
        onLogout();
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Xóa tài khoản thất bại.");
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ─── TIÊU ĐỀ TRANG ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t("account.title", "Tài khoản")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("account.subtitle", "Quản lý thông tin cá nhân và bảo mật")}
        </p>
      </div>

      {/* ─── CARD 1: THÔNG TIN CÁ NHÂN ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-6 sm:p-7 space-y-6">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <span className="material-symbols-outlined text-[19px] text-slate-700 dark:text-slate-300">
              person_outline
            </span>
            <span>{t("account.personal_info", "THÔNG TIN CÁ NHÂN")}</span>
          </div>

          <button
            type="button"
            onClick={handleOpenEditProfile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-slate-600 dark:text-slate-300">edit</span>
            <span>{t("account.edit_btn", "Chỉnh sửa")}</span>
          </button>
        </div>

        {/* User Summary Row (Avatar + Name + Email) */}
        <div className="flex items-center gap-4 py-2">
          <div className="w-16 h-16 rounded-full bg-slate-900 dark:bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm overflow-hidden select-none">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{user.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Detailed Key-Value List */}
        <div className="space-y-4 pt-2">
          {/* Họ và tên */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 gap-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-normal">{t("account.full_name", "Họ và tên")}</span>
            <span className="text-slate-900 dark:text-white font-semibold text-right">{user.name}</span>
          </div>

          {/* Email */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 gap-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-normal">{t("account.email", "Email")}</span>
            <div className="flex items-center gap-2 justify-end flex-wrap">
              <span className="text-slate-900 dark:text-white font-medium">{user.email}</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                <span>{t("account.verified", "Đã xác thực")}</span>
              </span>
            </div>
          </div>

          {/* Vai trò */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 gap-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-normal">{t("account.role", "Vai trò")}</span>
            <span className="text-slate-900 dark:text-white font-medium text-right">
              {roleLabel}
            </span>
          </div>

          {/* Trạng thái */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 gap-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-normal">{t("account.status", "Trạng thái")}</span>
            <div className="flex items-center gap-2 justify-end">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">
                {user.status === "active" ? t("account.status_active", "Đang hoạt động") : t("account.status_locked", "Bị khóa")}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleOpenEditProfile}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">edit_note</span>
            <span>{t("account.edit_info_btn", "Chỉnh sửa thông tin")}</span>
          </button>
        </div>
      </div>

      {/* ─── CARD 2: BẢO MẬT ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-6 sm:p-7 space-y-6">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <span className="material-symbols-outlined text-[19px] text-slate-700 dark:text-slate-300">
              lock_outline
            </span>
            <span>{t("account.security", "BẢO MẬT")}</span>
          </div>
        </div>

        {/* Section 1: Mật khẩu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("account.password", "Mật khẩu")}
            </h4>
            <div className="text-slate-600 dark:text-slate-300 font-mono tracking-widest text-base select-none">
              ••••••••••••
            </div>
            <p className="text-xs text-slate-400">{lastUpdatedText}</p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleOpenChangePassword}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-300">
                vpn_key
              </span>
              <span>{t("account.change_password_btn", "Đổi mật khẩu")}</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* Section 2: Xác thực 2 bước (2FA) */}
        <div className="flex items-center justify-between py-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("account.two_factor", "Xác thực 2 bước (2FA)")}
              </span>
              {is2faEnabled ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                  {lang === 'en' ? "Enabled" : "Đã bật"}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {lang === 'en' ? "Disabled" : "Đã tắt"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("account.two_factor_desc", "Bảo vệ tài khoản bằng mã xác thực bổ sung qua điện thoại")}
            </p>
          </div>

          <div>
            {/* Interactive Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={is2faEnabled}
              onClick={handleToggle2fa}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                is2faEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  is2faEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ─── CARD: HỖ TRỢ, KHIẾU NẠI & ĐÓNG GÓP Ý KIẾN ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <span className="material-symbols-outlined text-[19px] text-emerald-600 dark:text-emerald-400">
              support_agent
            </span>
            <span>{lang === "en" ? "HELP, FEEDBACK & BUG REPORTS" : "TRỢ GIÚP, KHIẾU NẠI & BÁO LỖI"}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenSupport("faq")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-slate-500">help</span>
              <span>{lang === "en" ? "FAQs" : "Hỏi đáp"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenSupport("submit")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">report</span>
              <span>{lang === "en" ? "Submit Report" : "Gửi phản ánh"}</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{lang === "en" ? "Direct Line to System Admin" : "Kênh khiếu nại & tiếp nhận phản ánh trực tiếp"}</span>
              {resolvedTicketCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                  {lang === "en" ? `${resolvedTicketCount} Resolved` : `${resolvedTicketCount} đã phản hồi`}
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === "en"
                ? "Send bug reports, UI complaints, or feature requests. The admin team reviews and responds directly to your account."
                : "Báo cáo sự cố hệ thống, khiếu nại hoặc đề xuất tính năng mới. Ban quản trị sẽ tiếp nhận và giải đáp trực tiếp."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenSupport("history")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-400">
                history
              </span>
              <span>
                {lang === "en" ? "View My Tickets" : "Lịch sử yêu cầu"} ({ticketCount})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── CARD 3: QUYỀN RIÊNG TƯ & DỮ LIỆU CÁ NHÂN (DANGER ZONE) ────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/80 dark:border-rose-950/80 shadow-2xs p-6 sm:p-7 space-y-6">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            <span className="material-symbols-outlined text-[19px] text-rose-600 dark:text-rose-400">
              shield_with_heart
            </span>
            <span>{lang === 'en' ? "PRIVACY & DATA MANAGEMENT" : "QUYỀN RIÊNG TƯ & QUẢN LÝ DỮ LIỆU"}</span>
          </div>
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
            {lang === 'en' ? "High Risk Area" : "Khu vực rủi ro cao"}
          </span>
        </div>

        {/* Section 1: Quản lý liên kết ứng dụng bên thứ 3 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'en' ? "Third-party Apps (Google / OAuth)" : "Ứng dụng bên thứ ba (Google / OAuth)"}
              </h4>
              {user.google_connected || user.google_id ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                  {lang === 'en' ? "Google Linked" : "Đã liên kết Google"}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {lang === 'en' ? "Not linked" : "Chưa liên kết"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'en' ? "Manage connected single sign-on accounts and revoke access if needed" : "Xem danh sách tài khoản liên kết đăng nhập một chạm và thu hồi quyền truy cập khi cần thiết"}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleOpenConnectedApps}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-300">
                hub
              </span>
              <span>{lang === 'en' ? "Manage Permissions" : "Quản lý quyền"}</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* Section 2: Làm mới dữ liệu (Reset Data) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {lang === 'en' ? "Reset Financial Data" : "Làm mới dữ liệu tài chính (Reset Data)"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
              {lang === 'en'
                ? "Wipe all transaction history, transfers, budgets, and custom categories. Default wallets with zero balance are kept."
                : "Xóa sạch toàn bộ lịch sử thu/chi, chuyển tiền, ngân sách và danh mục tùy chỉnh. Tài khoản và ví mặc định (số dư 0đ) vẫn được bảo lưu để bắt đầu lại."}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleOpenResetData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-semibold text-amber-900 dark:text-amber-300 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-700 dark:text-amber-400">
                restart_alt
              </span>
              <span>{lang === 'en' ? "Reset Data" : "Làm mới dữ liệu"}</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* Section 3: Xóa tài khoản vĩnh viễn (Delete Account) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">
                {lang === 'en' ? "Permanently Delete Account" : "Xóa tài khoản vĩnh viễn"}
              </h4>
              {user.role === "super_admin" && (
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  {lang === 'en' ? "Protected Super Admin" : "Super Admin được bảo vệ"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
              {lang === 'en'
                ? "Permanently delete login credentials, personal profile, and all financial data. This action cannot be undone."
                : "Hủy toàn bộ thông tin đăng nhập, hồ sơ cá nhân và toàn bộ dữ liệu vĩnh viễn. Hành động này không thể khôi phục lại."}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleOpenDeleteAccount}
              disabled={user.role === "super_admin"}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                delete_forever
              </span>
              <span>{lang === 'en' ? "Delete Account" : "Xóa tài khoản"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Option đăng xuất phụ (nếu có prop onLogout) */}
      {onLogout && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
          >
            <span className="material-symbols-outlined text-[17px]">logout</span>
            <span>{t("action.logout", "Đăng xuất")}</span>
          </button>
        </div>
      )}

      {/* ─── MODAL 1: CHỈNH SỬA THÔNG TIN CÁ NHÂN & AVATAR ───────────────────────── */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  manage_accounts
                </span>
                <span>Chỉnh sửa thông tin</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitProfile} className="p-6 space-y-5">
              {profileError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{profileSuccess}</span>
                </div>
              )}

              {/* Avatar management */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Ảnh đại diện (Avatar)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-900 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                      id="avatar-file-input"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                        <span>Chọn ảnh mới</span>
                      </button>

                      {(avatarPreview || user.avatar_url) && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          <span>Xóa ảnh</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Hỗ trợ JPG, PNG hoặc WebP. Tối đa 2MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Họ và tên input */}
              <div className="space-y-1.5">
                <label htmlFor="edit-name" className="text-xs font-semibold text-slate-700 block">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Nhập họ và tên"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-1.5">
                <label htmlFor="edit-email" className="text-xs font-semibold text-slate-700 block">
                  Địa chỉ Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-500 cursor-not-allowed select-none"
                />
                <p className="text-[11px] text-slate-400">
                  Email là định danh tài khoản và không thể tự thay đổi.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  disabled={profileLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {profileLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ĐỔI MẬT KHẨU ─────────────────────────────────────────────── */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  vpn_key
                </span>
                <span>Đổi mật khẩu</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitPassword} className="p-6 space-y-4">
              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Mật khẩu hiện tại */}
              <div className="space-y-1.5">
                <label
                  htmlFor="current-password"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  Mật khẩu hiện tại <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showCurrentPass ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  Mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự (hoa, thường, số, ký tự đặc biệt)"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showNewPass ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>

                {/* Dynamic Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="grid grid-cols-3 gap-1.5 h-1 w-full rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-colors duration-200 ${
                          newPassStrength.score >= 1
                            ? newPassStrength.score === 1
                              ? "bg-rose-500"
                              : newPassStrength.score === 2
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                      ></div>
                      <div
                        className={`h-full transition-colors duration-200 ${
                          newPassStrength.score >= 2
                            ? newPassStrength.score === 2
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                      ></div>
                      <div
                        className={`h-full transition-colors duration-200 ${
                          newPassStrength.score >= 3 ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-medium ${newPassStrength.color}`}>
                        {newPassStrength.label}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Chữ hoa, thường, số &amp; ký tự đặc biệt
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showConfirmPass ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Checklist điều kiện */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-2">
                <p className="font-semibold text-slate-700">Điều kiện mật khẩu mới:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasMinLength ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {hasMinLength ? "check_circle" : "cancel"}
                    </span>
                    <span>Tối thiểu 8 ký tự</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasUpper ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {hasUpper ? "check_circle" : "cancel"}
                    </span>
                    <span>Chứa ít nhất 1 chữ in hoa</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasLower ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {hasLower ? "check_circle" : "cancel"}
                    </span>
                    <span>Chứa ít nhất 1 chữ thường</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasDigit ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {hasDigit ? "check_circle" : "cancel"}
                    </span>
                    <span>Chứa ít nhất 1 chữ số</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasSpecial ? "text-emerald-700 font-medium" : "text-slate-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {hasSpecial ? "check_circle" : "cancel"}
                    </span>
                    <span>Chứa ký tự đặc biệt (@$!%*?...)</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      newPassword && !isCommonPassword
                        ? "text-emerald-700 font-medium"
                        : "text-slate-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {newPassword && !isCommonPassword ? "check_circle" : "cancel"}
                    </span>
                    <span>Không phải mật khẩu phổ biến</span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  disabled={passwordLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {passwordLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <span>Xác nhận đổi mật khẩu</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: QUẢN LÝ ỨNG DỤNG BÊN THỨ 3 (CONNECTED APPS) ────────────────── */}
      {isConnectedAppsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  hub
                </span>
                <span>Ứng dụng bên thứ ba</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsConnectedAppsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Các ứng dụng và dịch vụ bạn đã cấp quyền đăng nhập nhanh vào FinTrack. Bạn có thể thu hồi quyền bất kỳ lúc nào.
              </p>

              {appsMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    appsMessage.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {appsMessage.type === "success" ? "check_circle" : "error"}
                  </span>
                  <span>{appsMessage.text}</span>
                </div>
              )}

              {loadingApps ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                  <span className="text-xs">Đang tải danh sách liên kết...</span>
                </div>
              ) : connectedApps.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Chưa có ứng dụng bên thứ ba nào được liên kết
                </div>
              ) : (
                <div className="space-y-3">
                  {connectedApps.map((app) => (
                    <div
                      key={app.provider}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs shrink-0">
                          {app.provider === "google" ? (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              />
                            </svg>
                          ) : (
                            <span className="material-symbols-outlined text-slate-600 text-[18px]">
                              apps
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-800 truncate">
                              {app.name}
                            </h4>
                            {app.connected ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                                Đã kết nối
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                                Chưa kết nối
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {app.email || user.email}
                          </p>
                        </div>
                      </div>

                      {app.connected && (
                        <button
                          type="button"
                          onClick={() => handleRevokeApp(app.provider)}
                          disabled={appsActionLoading}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          Thu hồi
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConnectedAppsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: LÀM MỚI DỮ LIỆU TÀI CHÍNH (RESET DATA) ────────────────────── */}
      {isResetDataOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-amber-200 max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-amber-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">
                  restart_alt
                </span>
                <span>Làm mới toàn bộ dữ liệu</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsResetDataOpen(false)}
                className="text-amber-800 hover:text-amber-950 p-1 rounded-lg hover:bg-amber-100/50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitResetData} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">warning</span>
                  <span>Lưu ý quan trọng:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900/90 pl-1">
                  <li>Toàn bộ giao dịch thu, chi, chuyển khoản sẽ bị xóa hoàn toàn.</li>
                  <li>Tất cả ngân sách và danh mục tùy chỉnh sẽ bị xóa.</li>
                  <li>Số dư các ví sẽ được đặt lại về 0 (bảo lưu 1 ví Tiền mặt).</li>
                  <li>Tài khoản đăng nhập của bạn vẫn được giữ nguyên.</li>
                </ul>
              </div>

              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{resetSuccess}</span>
                </div>
              )}

              {/* Mật khẩu xác nhận */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Mật khẩu tài khoản <span className="text-slate-400 font-normal">(nếu có)</span>
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại của bạn"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all bg-slate-50/50"
                />
              </div>

              {/* Cụm từ xác nhận */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Nhập <span className="font-mono text-amber-700 font-bold bg-amber-100 px-1 py-0.5 rounded">RESET DATA</span> để xác nhận
                </label>
                <input
                  type="text"
                  required
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="RESET DATA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all uppercase placeholder:normal-case"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetDataOpen(false)}
                  disabled={resetLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || !resetConfirmation}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {resetLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <span>Xác nhận làm mới dữ liệu</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: XÓA TÀI KHOẢN VĨNH VIỄN (DELETE ACCOUNT) ─────────────────── */}
      {isDeleteAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-rose-200 max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">
                  delete_forever
                </span>
                <span>Xóa vĩnh viễn tài khoản</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDeleteAccountOpen(false)}
                className="text-rose-800 hover:text-rose-950 p-1 rounded-lg hover:bg-rose-100/50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitDeleteAccount} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-rose-950">
                  <span className="material-symbols-outlined text-[16px] text-rose-700">error</span>
                  <span>CẢNH BÁO NGUY HIỂM: HÀNH ĐỘNG NÀY KHÔNG THỂ HOÀN TÁC!</span>
                </div>
                <p className="text-[11px] text-rose-900/90">
                  Tài khoản của bạn cùng toàn bộ dữ liệu giao dịch, ví, ngân sách và hình ảnh hồ sơ sẽ bị xóa vĩnh viễn và không thể khôi phục lại dưới bất kỳ hình thức nào.
                </p>
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Mật khẩu xác nhận */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Mật khẩu tài khoản <span className="text-slate-400 font-normal">(nếu có)</span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại để xác thực"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all bg-slate-50/50"
                />
              </div>

              {/* Cụm từ xác nhận */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Nhập <span className="font-mono text-rose-700 font-bold bg-rose-100 px-1 py-0.5 rounded">XOA TAI KHOAN</span> để xác nhận
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="XOA TAI KHOAN"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all uppercase placeholder:normal-case"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeleteAccountOpen(false)}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || !deleteConfirmation}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {deleteLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <span>Xác nhận xóa tài khoản</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
