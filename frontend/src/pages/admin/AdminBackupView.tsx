import React, { useState, useMemo } from "react";
import { Pagination } from "../../components/Pagination";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BackupRecord {
  id: string;
  created_at: string;
  size_mb: number;
  type: "auto" | "manual";
  status: "success" | "failed" | "running";
  storage: string;
  encrypted: boolean;
  note?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const INITIAL_BACKUPS: BackupRecord[] = [
  { id: "bk_20261001_030000", created_at: "2026-10-01T03:00:00Z", size_mb: 42.8, type: "auto", status: "success", storage: "local:/backups/", encrypted: true, note: "Daily auto backup" },
  { id: "bk_20260930_030000", created_at: "2026-09-30T03:00:00Z", size_mb: 41.5, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
  { id: "bk_20260929_154322", created_at: "2026-09-29T15:43:22Z", size_mb: 40.2, type: "manual", status: "success", storage: "local:/backups/", encrypted: true, note: "Trước khi nâng cấp v2.1" },
  { id: "bk_20260929_030000", created_at: "2026-09-29T03:00:00Z", size_mb: 39.7, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
  { id: "bk_20260928_030000", created_at: "2026-09-28T03:00:00Z", size_mb: 39.1, type: "auto", status: "failed", storage: "local:/backups/", encrypted: true, note: "Lỗi timeout kết nối" },
  { id: "bk_20260927_030000", created_at: "2026-09-27T03:00:00Z", size_mb: 38.6, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
  { id: "bk_20260926_030000", created_at: "2026-09-26T03:00:00Z", size_mb: 38.0, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
  { id: "bk_20260925_030000", created_at: "2026-09-25T03:00:00Z", size_mb: 37.8, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
  { id: "bk_20260924_030000", created_at: "2026-09-24T03:00:00Z", size_mb: 37.4, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
  { id: "bk_20260923_110000", created_at: "2026-09-23T11:00:00Z", size_mb: 37.0, type: "manual", status: "success", storage: "local:/backups/", encrypted: true, note: "Kiểm tra định kỳ" },
  { id: "bk_20260922_030000", created_at: "2026-09-22T03:00:00Z", size_mb: 36.5, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
  { id: "bk_20260921_030000", created_at: "2026-09-21T03:00:00Z", size_mb: 36.1, type: "auto", status: "failed", storage: "local:/backups/", encrypted: true, note: "Đĩa đầy tạm thời" },
  { id: "bk_20260920_030000", created_at: "2026-09-20T03:00:00Z", size_mb: 35.8, type: "auto", status: "success", storage: "local:/backups/", encrypted: true },
];

// ─── Restore Confirm Dialog (2-step) ─────────────────────────────────────────
interface RestoreDialogProps {
  backup: BackupRecord;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}

const RestoreDialog: React.FC<RestoreDialogProps> = ({ backup, onCancel, onConfirm, confirming }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const CONFIRM_PHRASE = "KHÔI PHỤC";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-amber-600">restore</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Khôi phục từ bản sao lưu</h3>
            <p className="text-xs text-slate-400">Bước {step} / 2</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">warning</span>
                Cảnh báo quan trọng
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] mt-1">
                <li>Toàn bộ dữ liệu hiện tại sẽ bị <strong>thay thế hoàn toàn</strong></li>
                <li>Hệ thống sẽ tạm ngừng trong quá trình khôi phục (5–10 phút)</li>
                <li>Không thể hoàn tác sau khi xác nhận</li>
                <li>Chỉ <strong>Super Admin</strong> mới được thực hiện thao tác này</li>
              </ul>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="font-semibold text-slate-700">Thông tin bản sao lưu</div>
              <div className="flex justify-between text-slate-600"><span>ID</span><code className="font-mono">{backup.id}</code></div>
              <div className="flex justify-between text-slate-600"><span>Thời gian</span><span>{new Date(backup.created_at).toLocaleString("vi-VN")}</span></div>
              <div className="flex justify-between text-slate-600"><span>Kích thước</span><span>{backup.size_mb.toFixed(1)} MB</span></div>
              <div className="flex justify-between text-slate-600"><span>Mã hóa</span><span className="text-emerald-600 font-semibold">✓ Có</span></div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onCancel}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors">Hủy</button>
              <button type="button" onClick={() => setStep(2)}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Để xác nhận, hãy nhập đúng cụm từ <strong className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-mono">{CONFIRM_PHRASE}</strong> vào ô bên dưới:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              placeholder={CONFIRM_PHRASE}
              className="w-full px-3.5 py-3 border-2 border-slate-200 rounded-xl text-sm font-mono text-center focus:outline-none focus:border-rose-400 tracking-widest"
              autoFocus
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} disabled={confirming}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors">Quay lại</button>
              <button type="button" onClick={onConfirm} disabled={confirmText !== CONFIRM_PHRASE || confirming}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:cursor-not-allowed">
                {confirming && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                {confirming ? "Đang khôi phục..." : "Xác nhận khôi phục"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────
export const AdminBackupView: React.FC = () => {
  const [backups, setBackups] = useState<BackupRecord[]>(INITIAL_BACKUPS);
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [retentionDays] = useState(7);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [backupFilter, setBackupFilter] = useState<"all" | "auto" | "manual" | "failed">("all");

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    const newId = `bk_${new Date().toISOString().replace(/[-T:Z.]/g, "").slice(0, 15)}`;
    // Simulate backup running
    const running: BackupRecord = {
      id: newId,
      created_at: new Date().toISOString(),
      size_mb: 0,
      type: "manual",
      status: "running",
      storage: "local:/backups/",
      encrypted: true,
      note: "Sao lưu thủ công",
    };
    setBackups(prev => [running, ...prev]);
    setCurrentPage(1);
    await new Promise(r => setTimeout(r, 2500));
    const success: BackupRecord = { ...running, status: "success", size_mb: 43.2 + Math.random() * 2 };
    setBackups(prev => prev.map(b => b.id === newId ? success : b));
    setCreatingBackup(false);
    showSuccess("Sao lưu thủ công hoàn thành thành công!");
  };

  const handleRestore = async () => {
    setConfirming(true);
    await new Promise(r => setTimeout(r, 2000));
    setConfirming(false);
    setRestoreTarget(null);
    showSuccess(`Khôi phục từ "${restoreTarget?.id}" thành công! Hệ thống đã được khởi động lại.`);
  };

  const handleDeleteBackup = (id: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa bản sao lưu này? Không thể hoàn tác.")) return;
    setBackups(prev => prev.filter(b => b.id !== id));
    showSuccess("Đã xóa bản sao lưu.");
  };

  const handleCleanupOldBackups = () => {
    // Keep top retentionDays successful backups and running ones, delete the rest to free disk/db space
    const successful = backups.filter(b => b.status === "success");
    const keepIds = new Set(successful.slice(0, retentionDays).map(b => b.id));
    const runningIds = new Set(backups.filter(b => b.status === "running").map(b => b.id));
    const deletedCount = backups.length - (keepIds.size + runningIds.size);

    if (deletedCount <= 0) {
      alert("Hiện tại không có bản sao lưu nào vượt quá số lượng lưu trữ hoặc bị lỗi để dọn dẹp.");
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn giải phóng ${deletedCount} bản sao lưu cũ/thất bại vượt quá chính sách lưu trữ (${retentionDays} bản gần nhất)?`)) {
      return;
    }

    setBackups(prev => prev.filter(b => keepIds.has(b.id) || runningIds.has(b.id)));
    setCurrentPage(1);
    showSuccess(`Đã giải phóng ${deletedCount} bản sao lưu cũ để tối ưu bộ nhớ hệ thống.`);
  };

  const filteredBackups = useMemo(() => {
    return backups.filter(b => {
      if (backupFilter === "all") return true;
      if (backupFilter === "failed") return b.status === "failed";
      return b.type === backupFilter;
    });
  }, [backups, backupFilter]);

  const paginatedBackups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBackups.slice(start, start + pageSize);
  }, [filteredBackups, currentPage, pageSize]);

  const totalSize = backups.filter(b => b.status === "success").reduce((s, b) => s + b.size_mb, 0);
  const lastSuccess = backups.find(b => b.status === "success");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Sao lưu & Khôi phục dữ liệu</h2>
          <p className="text-xs text-slate-400 mt-0.5">Chỉ Super Admin được phép thực hiện khôi phục dữ liệu</p>
        </div>
        <button onClick={handleCreateBackup} disabled={creatingBackup}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 shadow-sm transition-all cursor-pointer disabled:opacity-60">
          {creatingBackup ? <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
            : <span className="material-symbols-outlined text-[15px]">cloud_upload</span>}
          {creatingBackup ? "Đang sao lưu..." : "Sao lưu ngay"}
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>{successMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Tổng bản sao lưu", value: backups.length, icon: "cloud_upload", accent: "bg-slate-900", textVal: "text-white", textLbl: "text-slate-400", ico: "text-white" },
          { label: "Tổng dung lượng", value: `${totalSize.toFixed(1)} MB`, icon: "storage", accent: "bg-white", textVal: "text-slate-900", textLbl: "text-slate-500", ico: "text-blue-600" },
          { label: "Thành công", value: backups.filter(b => b.status === "success").length, icon: "check_circle", accent: "bg-white", textVal: "text-emerald-700", textLbl: "text-slate-500", ico: "text-emerald-500" },
          { label: "Thất bại", value: backups.filter(b => b.status === "failed").length, icon: "cancel", accent: "bg-white", textVal: "text-rose-600", textLbl: "text-slate-500", ico: "text-rose-500" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 shadow-sm ${s.accent} ${s.accent === "bg-slate-900" ? "border-slate-800" : "border-slate-200/80"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`material-symbols-outlined text-[18px] ${s.ico}`}>{s.icon}</span>
              <span className={`text-xs font-medium ${s.textLbl}`}>{s.label}</span>
            </div>
            <div className={`text-2xl font-bold ${s.textVal}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Schedule & Policy */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-slate-600">schedule</span>
            <h3 className="font-bold text-slate-900 text-sm">Lịch sao lưu tự động</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Hằng ngày", time: "03:00 AM", enabled: true },
              { label: "Hằng tuần (Chủ nhật)", time: "02:00 AM", enabled: false },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-slate-800">{s.label}</div>
                  <div className="text-[11px] text-slate-400">{s.time}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {s.enabled ? "Đang bật" : "Tắt"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-slate-600">policy</span>
            <h3 className="font-bold text-slate-900 text-sm">Chính sách lưu trữ</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-600">Giữ tối đa</span>
              <span className="text-xs font-bold text-slate-900">{retentionDays} bản gần nhất</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-600">Mã hóa</span>
              <span className="text-xs font-bold text-emerald-700">AES-256 ✓</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-600">Lưu gần nhất</span>
              <span className="text-xs font-bold text-slate-900">
                {lastSuccess ? new Date(lastSuccess.created_at).toLocaleString("vi-VN") : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Retention Policy Banner & Storage Optimizer */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-blue-700 text-lg">auto_delete</span>
          </div>
          <div>
            <div className="text-xs font-bold text-blue-950 flex items-center gap-2">
              Chính sách giải phóng dung lượng CSDL & File sao lưu
              <span className="bg-blue-200/60 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-semibold">Tự động xoay vòng</span>
            </div>
            <p className="text-[11px] text-blue-700/90 mt-0.5 leading-relaxed">
              Hệ thống tự động lưu giữ <strong>{retentionDays} bản sao lưu</strong> thành công gần nhất. Các bản cũ hơn {retentionDays} ngày hoặc bản ghi lỗi sẽ tự động xoay vòng loại bỏ vào Chủ Nhật hàng tuần lúc 02:00 AM để giải phóng dung lượng đĩa và CSDL.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCleanupOldBackups}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[15px]">cleaning_services</span>
          Dọn dẹp bản sao lưu cũ & lỗi
        </button>
      </div>

      {/* Backup List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[17px] text-blue-600">list</span>
            </div>
            <div>
              <span className="font-semibold text-slate-800 text-sm">Danh sách bản sao lưu</span>
              <span className="ml-2 text-xs text-slate-400">({filteredBackups.length}/{backups.length} bản)</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
            {(["all", "auto", "manual", "failed"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setBackupFilter(f);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  backupFilter === f
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f === "all" ? "Tất cả" : f === "auto" ? "Tự động" : f === "manual" ? "Thủ công" : "Thất bại"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-5 text-left">ID / Thời gian</th>
                <th className="py-3 px-5 text-left">Loại</th>
                <th className="py-3 px-5 text-left">Trạng thái</th>
                <th className="py-3 px-5 text-right">Kích thước</th>
                <th className="py-3 px-5 text-left">Ghi chú</th>
                <th className="py-3 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedBackups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300">search_off</span>
                    Không có bản sao lưu nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                paginatedBackups.map((b) => (
                  <tr key={b.id} className={`hover:bg-slate-50/80 transition-colors group ${b.status === "running" ? "bg-blue-50/40" : ""}`}>
                    <td className="py-3.5 px-5">
                      <div className="font-mono text-[10px] text-slate-500">{b.id}</div>
                      <div className="text-xs text-slate-700 font-semibold mt-0.5">
                        {new Date(b.created_at).toLocaleString("vi-VN")}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${b.type === "auto" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-violet-50 text-violet-700 border border-violet-200"}`}>
                        <span className="material-symbols-outlined text-[10px]">{b.type === "auto" ? "schedule" : "person"}</span>
                        {b.type === "auto" ? "Tự động" : "Thủ công"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      {b.status === "running" ? (
                        <span className="inline-flex items-center gap-1.5 text-blue-600 font-semibold">
                          <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          Đang chạy...
                        </span>
                      ) : b.status === "success" ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Thành công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          Thất bại
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-semibold text-slate-700">
                      {b.status === "running" ? "..." : `${b.size_mb.toFixed(1)} MB`}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[11px]">
                      {b.note || <span className="text-slate-300">—</span>}
                      {b.encrypted && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
                          <span className="material-symbols-outlined text-[11px]">lock</span>
                          Mã hóa
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {b.status === "success" && (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => setRestoreTarget(b)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors">
                            <span className="material-symbols-outlined text-[12px]">restore</span>
                            Khôi phục
                          </button>
                          <button type="button" onClick={() => handleDeleteBackup(b.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer">
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredBackups.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 20]}
        />
      </div>

      {/* Restore Dialog */}
      {restoreTarget && (
        <RestoreDialog
          backup={restoreTarget}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={handleRestore}
          confirming={confirming}
        />
      )}
    </div>
  );
};
