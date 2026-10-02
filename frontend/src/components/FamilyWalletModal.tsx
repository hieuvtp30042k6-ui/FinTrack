import React, { useState, useEffect } from "react";
import {
  WalletModel,
  WalletMemberModel,
  getWalletMembersApi,
  inviteWalletMemberApi,
  updateWalletMemberRoleApi,
  removeWalletMemberApi,
  leaveWalletApi,
} from "../services/api";

interface FamilyWalletModalProps {
  wallet: WalletModel;
  onClose: () => void;
  onWalletUpdated?: () => void;
}

export const FamilyWalletModal: React.FC<FamilyWalletModalProps> = ({
  wallet,
  onClose,
  onWalletUpdated,
}) => {
  const [members, setMembers] = useState<WalletMemberModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR">("VIEWER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOwner = wallet.is_owner ?? true;

  const fetchMembers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getWalletMembersApi(wallet.id);
      setMembers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tải danh sách thành viên.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [wallet.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await inviteWalletMemberApi(wallet.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setSuccessMessage(`Đã thêm thành viên ${inviteEmail.trim()} vào ví chung!`);
      setInviteEmail("");
      fetchMembers();
      if (onWalletUpdated) onWalletUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi gửi lời mời.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (memberId: number, newRole: "VIEWER" | "EDITOR") => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateWalletMemberRoleApi(wallet.id, memberId, newRole);
      setSuccessMessage("Đã cập nhật quyền hạn thành viên thành công!");
      fetchMembers();
      if (onWalletUpdated) onWalletUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi cập nhật quyền hạn.";
      setErrorMessage(msg);
    }
  };

  const handleRemoveMember = async (memberId: number, email: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thành viên ${email} khỏi ví chung này?`)) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await removeWalletMemberApi(wallet.id, memberId);
      setSuccessMessage(`Đã xóa ${email} khỏi ví chung.`);
      fetchMembers();
      if (onWalletUpdated) onWalletUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi xóa thành viên.";
      setErrorMessage(msg);
    }
  };

  const handleLeaveWallet = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn rời khỏi ví chung "${wallet.name}"? Bạn sẽ không còn quyền truy cập ví này nữa.`)) {
      return;
    }
    setErrorMessage(null);
    try {
      await leaveWalletApi(wallet.id);
      if (onWalletUpdated) onWalletUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi rời khỏi ví.";
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 animate-scaleUp max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-2xl">family_restroom</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">Ví Gia Đình / Chia Sẻ</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {wallet.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cùng các thành viên trong gia đình quản lý chi tiêu và phân quyền linh hoạt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Thông báo Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
            <span className="material-symbols-outlined text-rose-400 text-base">error</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form mời thành viên mới (chỉ Owner) */}
        {isOwner ? (
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-indigo-400">person_add</span>
              Mời người thân vào ví chung
            </h4>

            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="email"
                    required
                    placeholder="Nhập email người thân (ví dụ: vo@example.com)..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "VIEWER" | "EDITOR")}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="VIEWER">Chỉ xem (Viewer)</option>
                    <option value="EDITOR">Được ghi (Editor)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  * <strong>Editor</strong> có thể tạo/sửa chi tiêu gia đình. <strong>Viewer</strong> chỉ được theo dõi số dư.
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  {isSubmitting ? "Đang mời..." : "Mời thành viên"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span>
              <span>
                Bạn đang tham gia ví này với vai trò:{" "}
                <strong className="text-white uppercase font-bold">{wallet.my_role}</strong>
              </span>
            </div>
            <button
              onClick={handleLeaveWallet}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Rời khỏi ví
            </button>
          </div>
        )}

        {/* Danh sách thành viên hiện tại */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Danh sách thành viên ({members.length + 1})</span>
            <span className="text-[11px] font-normal text-slate-500">Chủ sở hữu & người được mời</span>
          </h4>

          {/* Thẻ Chủ sở hữu (Owner) */}
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm shadow-inner">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {wallet.owner_name || "Chủ ví"}
                  </span>
                  {isOwner && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-semibold">
                      BẠN
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {wallet.owner_email || "Chủ sở hữu ví"}
                </div>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">shield</span>
              Chủ sở hữu (Owner)
            </span>
          </div>

          {/* Danh sách Members */}
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <div className="animate-spin material-symbols-outlined text-2xl mb-1 text-indigo-400">
                progress_activity
              </div>
              Đang tải danh sách thành viên...
            </div>
          ) : members.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-950/30 border border-dashed border-slate-800 text-xs text-slate-400">
              Chưa có thành viên nào được mời vào ví chung này. Hãy nhập email người thân ở trên để bắt đầu chia sẻ!
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                      {m.name ? m.name.charAt(0).toUpperCase() : m.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {m.name || m.email.split("@")[0]}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{m.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Role dropdown (cho owner) hoặc badge tĩnh (cho member) */}
                    {isOwner ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleUpdateRole(m.id, e.target.value as "VIEWER" | "EDITOR")
                        }
                        className={`text-xs px-2.5 py-1 rounded-xl border font-medium focus:outline-none cursor-pointer ${
                          m.role === "EDITOR"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }`}
                      >
                        <option value="VIEWER">Chỉ xem (Viewer)</option>
                        <option value="EDITOR">Được ghi (Editor)</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          m.role === "EDITOR"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }`}
                      >
                        {m.role === "EDITOR" ? "Biên tập viên" : "Chỉ xem"}
                      </span>
                    )}

                    {/* Nút xóa member (chỉ owner) */}
                    {isOwner && (
                      <button
                        onClick={() => handleRemoveMember(m.id, m.email)}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                        title="Xóa thành viên khỏi ví"
                      >
                        <span className="material-symbols-outlined text-base">person_remove</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
