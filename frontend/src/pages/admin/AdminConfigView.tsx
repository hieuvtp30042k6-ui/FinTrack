import React, { useState, useEffect } from "react";
import {
  getAdminConfigApi,
  updateAdminConfigApi,
  testEmailConfigApi,
  FeatureFlag,
  SmtpConfig,
  GeneralConfig,
  ApiIntegration,
} from "../../services/api";

const STORAGE_KEY = "fintrack_admin_config";

// ─── Initial state ────────────────────────────────────────────────────────────
const DEFAULT_FLAGS: FeatureFlag[] = [
  { id: "ocr_transactions", label: "Nhập giao dịch bằng OCR", description: "Cho phép người dùng chụp ảnh hóa đơn để nhập giao dịch tự động.", enabled: false, group: "Tính năng" },
  { id: "advanced_reports", label: "Báo cáo nâng cao", description: "Biểu đồ phân tích xu hướng, so sánh theo kỳ, dự đoán chi tiêu.", enabled: true, group: "Tính năng" },
  { id: "wallet_sharing", label: "Chia sẻ ví", description: "Người dùng có thể chia sẻ ví chung với người khác.", enabled: false, group: "Tính năng" },
  { id: "budget_alerts", label: "Cảnh báo ngân sách", description: "Gửi thông báo khi chi tiêu vượt ngưỡng ngân sách.", enabled: true, group: "Thông báo" },
  { id: "email_notifications", label: "Thông báo qua Email", description: "Gửi email tóm tắt hàng tuần và cảnh báo bảo mật.", enabled: true, group: "Thông báo" },
  { id: "push_notifications", label: "Push Notification", description: "Thông báo đẩy trên trình duyệt/thiết bị di động.", enabled: false, group: "Thông báo" },
  { id: "google_login", label: "Đăng nhập Google", description: "Cho phép đăng nhập bằng tài khoản Google (OAuth2).", enabled: true, group: "Bảo mật" },
  { id: "two_fa", label: "Xác thực 2 bước (2FA)", description: "Yêu cầu OTP khi đăng nhập từ thiết bị mới.", enabled: false, group: "Bảo mật" },
  { id: "rate_limiting", label: "Giới hạn tốc độ (Rate Limit)", description: "Chặn các request bất thường theo IP và tài khoản.", enabled: true, group: "Bảo mật" },
  { id: "nginx_hardening", label: "Nginx Hardening & Gzip", description: "Bật header bảo mật chống Clickjacking và nén dữ liệu truyền tải.", enabled: true, group: "Hạ tầng & DevOps" },
  { id: "prometheus_metrics", label: "Giám sát hiệu năng (Prometheus)", description: "Kích hoạt thu thập các chỉ số CPU, RAM, Latency và Error rate tại /metrics.", enabled: true, group: "Hạ tầng & DevOps" },
  { id: "loki_logging", label: "Ghi log tập trung (Loki & LogQL)", description: "Lưu trữ tập trung và tìm kiếm log lỗi 4xx/5xx qua LogQL.", enabled: true, group: "Hạ tầng & DevOps" },
  { id: "auto_db_backup", label: "Sao lưu CSDL tự động (backup.sh)", description: "Tự động chạy sao lưu CSDL PostgreSQL định kỳ hàng ngày.", enabled: true, group: "Hạ tầng & DevOps" },
  { id: "maintenance_mode", label: "Chế độ bảo trì", description: "Chặn người dùng thường truy cập, chỉ admin vào được.", enabled: false, group: "Hệ thống" },
];

const DEFAULT_SMTP: SmtpConfig = {
  host: "smtp.gmail.com",
  port: "587",
  username: "",
  password: "",
  from_email: "no-reply@fintrack.app",
  from_name: "FinTrack",
  use_tls: true,
};

const DEFAULT_GENERAL: GeneralConfig = {
  app_name: "FinTrack",
  tagline: "Quản lý tài chính thông minh",
  default_language: "vi",
  timezone: "Asia/Ho_Chi_Minh",
  date_format: "DD/MM/YYYY",
  currency: "VND",
  max_wallets: "10",
  max_categories: "50",
  max_file_size_mb: "5",
};

const DEFAULT_APIS: ApiIntegration[] = [
  { id: "exchange_rate", name: "API Tỷ giá ngoại tệ", provider: "ExchangeRate-API", key: "er_live_********************", status: "connected", last_check: "2 phút trước" },
  { id: "google_oauth", name: "Google OAuth", provider: "Google Cloud", key: "GOCSPX-********************", status: "connected", last_check: "5 phút trước" },
  { id: "ocr_service", name: "OCR Service", provider: "Google Vision API", key: "AIza**********************", status: "disconnected", last_check: "1 giờ trước" },
  { id: "bank_api", name: "Open Banking API", provider: "VietQR", key: "vqr_*********************", status: "unknown", last_check: "Chưa kiểm tra" },
];


// ─── Toggle Switch ────────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: () => void; id: string; danger?: boolean }> = ({ checked, onChange, id, danger }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex w-11 h-6 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer focus:outline-none ${checked ? (danger ? "bg-rose-500" : "bg-emerald-500") : "bg-slate-200"}`}
  >
    <span className={`inline-block w-4 h-4 mt-0.5 bg-white rounded-full shadow transform transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
  </button>
);

// ─── Main View ────────────────────────────────────────────────────────────────
export const AdminConfigView: React.FC = () => {
  const [tab, setTab] = useState<"general" | "email" | "flags" | "api" | "limits" | "devops">("general");
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);
  const [smtp, setSmtp] = useState<SmtpConfig>(DEFAULT_SMTP);
  const [general, setGeneral] = useState<GeneralConfig>(DEFAULT_GENERAL);
  const [apis, setApis] = useState<ApiIntegration[]>(DEFAULT_APIS);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testEmailMsg, setTestEmailMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Tải cấu hình từ cache LocalStorage và Backend API
  useEffect(() => {
    // 1. Tải tức thì từ LocalStorage nếu có để tránh giật màn hình
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.general) setGeneral(parsed.general);
        if (parsed.smtp) setSmtp(parsed.smtp);
        if (parsed.flags) setFlags(parsed.flags);
        if (parsed.apis) setApis(parsed.apis);
      }
    } catch {
      // Bỏ qua lỗi cache
    }

    // 2. Tải dữ liệu chuẩn từ Backend API
    const fetchConfig = async () => {
      try {
        const data = await getAdminConfigApi();
        if (data) {
          if (data.general) setGeneral(data.general);
          if (data.smtp) setSmtp(data.smtp);
          if (data.flags && data.flags.length > 0) setFlags(data.flags);
          if (data.apis && data.apis.length > 0) setApis(data.apis);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Không thể tải cấu hình từ backend, dùng cấu hình hiện tại:", err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchConfig();
  }, []);

  const toggleFlag = (id: string) => {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const handleSave = async () => {
    setLimitError(null);
    setSaveError(null);
    const maxWallets = parseInt(general.max_wallets, 10);
    const maxCategories = parseInt(general.max_categories, 10);
    const maxFileSize = parseInt(general.max_file_size_mb, 10);

    if (
      isNaN(maxWallets) || maxWallets < 1 ||
      isNaN(maxCategories) || maxCategories < 1 ||
      isNaN(maxFileSize) || maxFileSize < 1
    ) {
      setLimitError("Các hạn mức hệ thống bắt buộc phải là số nguyên dương lớn hơn 0 (không cho phép số âm hoặc bằng 0).");
      setTab("limits");
      return;
    }

    setSaveStatus("saving");
    try {
      const payload = {
        general,
        smtp,
        flags,
        apis,
      };
      const updated = await updateAdminConfigApi(payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated || payload));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: unknown) {
      console.error("Lỗi khi lưu cấu hình hệ thống:", err);
      const msg = err instanceof Error ? err.message : "Không thể lưu cấu hình vào máy chủ.";
      setSaveError(msg);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  };

  const handleTestEmail = async () => {
    setTestEmailStatus("sending");
    setTestEmailMsg(null);
    try {
      const res = await testEmailConfigApi(smtp);
      setTestEmailStatus("sent");
      setTestEmailMsg(res.message || "Email thử nghiệm gửi thành công!");
      setTimeout(() => {
        setTestEmailStatus("idle");
        setTestEmailMsg(null);
      }, 4000);
    } catch (err: unknown) {
      setTestEmailStatus("error");
      const msg = err instanceof Error ? err.message : "Lỗi khi kiểm tra SMTP.";
      setTestEmailMsg(msg);
      setTimeout(() => {
        setTestEmailStatus("idle");
        setTestEmailMsg(null);
      }, 4000);
    }
  };


  const TABS = [
    { id: "general", label: "Cài đặt chung", icon: "tune" },
    { id: "email", label: "Email / SMTP", icon: "mail" },
    { id: "flags", label: "Feature Flag", icon: "toggle_on" },
    { id: "api", label: "API tích hợp", icon: "api" },
    { id: "limits", label: "Hạn mức", icon: "data_usage" },
    { id: "devops", label: "Hạ tầng", icon: "dns" },
  ] as const;

  const flagGroups = [...new Set(flags.map(f => f.group))];

  const maintenanceOn = flags.find(f => f.id === "maintenance_mode")?.enabled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Cấu hình hệ thống</h2>
            {loadingConfig && (
              <span className="material-symbols-outlined text-[16px] animate-spin text-slate-400" title="Đang đồng bộ dữ liệu từ máy chủ...">
                progress_activity
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Quản lý cài đặt toàn cục, tính năng và tích hợp bên thứ ba</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-sm ${saveStatus === "saved" ? "bg-emerald-500 text-white" : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"}`}
        >
          {saveStatus === "saving" && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
          {saveStatus === "saved" && <span className="material-symbols-outlined text-[16px]">check</span>}
          {saveStatus === "saving" ? "Đang lưu vào DB..." : saveStatus === "saved" ? "Đã lưu vĩnh viễn!" : "Lưu cài đặt"}
        </button>
      </div>

      {/* Save Success / Error Banner */}
      {saveStatus === "saved" && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-2xl text-emerald-600">check_circle</span>
          <div>
            <div className="font-bold text-emerald-800 text-sm">Cài đặt đã được lưu thành công!</div>
            <div className="text-xs text-emerald-700">Tất cả thay đổi đã được đồng bộ vào cơ sở dữ liệu và bảo toàn khi tải lại trang (F5).</div>
          </div>
        </div>
      )}

      {saveStatus === "error" && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-center gap-3 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-2xl text-rose-600">error</span>
          <div>
            <div className="font-bold text-rose-800 text-sm">Không thể lưu cài đặt</div>
            <div className="text-xs text-rose-700">{saveError || "Đã xảy ra lỗi khi kết nối tới máy chủ."}</div>
          </div>
        </div>
      )}

      {/* Maintenance banner */}
      {maintenanceOn && (

        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-amber-600">construction</span>
          <div>
            <div className="font-bold text-amber-800 text-sm">Chế độ bảo trì đang BẬT</div>
            <div className="text-xs text-amber-700">Người dùng thường không thể truy cập hệ thống. Chỉ admin mới vào được.</div>
          </div>
          <button type="button" onClick={() => toggleFlag("maintenance_mode")}
            className="ml-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors">
            Tắt ngay
          </button>
        </div>
      )}

      {/* Tab Nav */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border-b-2 ${tab === t.id ? "border-slate-900 text-slate-900 bg-slate-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/30"}`}>
              <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ─── General ─────────────────────────────────────────────────────── */}
          {tab === "general" && (
            <div className="space-y-5 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Tên ứng dụng</label>
                  <input type="text" value={general.app_name} onChange={e => setGeneral(g => ({ ...g, app_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Slogan</label>
                  <input type="text" value={general.tagline} onChange={e => setGeneral(g => ({ ...g, tagline: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Ngôn ngữ mặc định</label>
                  <select value={general.default_language} onChange={e => setGeneral(g => ({ ...g, default_language: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white cursor-pointer">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Múi giờ</label>
                  <select value={general.timezone} onChange={e => setGeneral(g => ({ ...g, timezone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white cursor-pointer">
                    <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Định dạng ngày</label>
                  <select value={general.date_format} onChange={e => setGeneral(g => ({ ...g, date_format: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white cursor-pointer">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Tiền tệ mặc định</label>
                  <select value={general.currency} onChange={e => setGeneral(g => ({ ...g, currency: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white cursor-pointer">
                    <option value="VND">VND (₫)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                <div className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">info</span> Xem trước
                </div>
                <div className="space-y-1">
                  <div><span className="text-slate-400">Tên:</span> <strong className="text-slate-800">{general.app_name}</strong></div>
                  <div><span className="text-slate-400">Ngày mẫu:</span> <strong className="text-slate-800">
                    {general.date_format === "DD/MM/YYYY" ? "31/12/2025" : general.date_format === "MM/DD/YYYY" ? "12/31/2025" : "2025-12-31"}
                  </strong></div>
                  <div><span className="text-slate-400">Tiền mẫu:</span> <strong className="text-slate-800">
                    {general.currency === "VND" ? "1.500.000 ₫" : general.currency === "USD" ? "$1,500.00" : "€1.500,00"}
                  </strong></div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Email ───────────────────────────────────────────────────────── */}
          {tab === "email" && (
            <div className="space-y-5 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">SMTP Host</label>
                  <input type="text" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Port</label>
                  <input type="text" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value.replace(/[^0-9]/g, "") }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Bảo mật</label>
                  <div className="flex items-center gap-3 h-[42px] px-3.5 border border-slate-200 rounded-xl">
                    <Toggle id="smtp-tls" checked={smtp.use_tls} onChange={() => setSmtp(s => ({ ...s, use_tls: !s.use_tls }))} />
                    <span className="text-sm text-slate-700">TLS/STARTTLS</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Tên người gửi</label>
                  <input type="text" value={smtp.from_name} onChange={e => setSmtp(s => ({ ...s, from_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Email người gửi</label>
                  <input type="email" value={smtp.from_email} onChange={e => setSmtp(s => ({ ...s, from_email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Username</label>
                  <input type="text" value={smtp.username} onChange={e => setSmtp(s => ({ ...s, username: e.target.value }))}
                    placeholder="Tài khoản SMTP..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Password / App Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={smtp.password} onChange={e => setSmtp(s => ({ ...s, password: e.target.value }))}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      <span className="material-symbols-outlined text-[18px]">{showPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={handleTestEmail} disabled={testEmailStatus === "sending"}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${testEmailStatus === "sent" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : testEmailStatus === "error" ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-50"}`}>
                    {testEmailStatus === "sending" && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                    {testEmailStatus === "sent" && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
                    {testEmailStatus === "error" && <span className="material-symbols-outlined text-[14px]">error</span>}
                    {testEmailStatus === "idle" && <span className="material-symbols-outlined text-[14px]">send</span>}
                    {testEmailStatus === "sending" ? "Đang gửi..." : testEmailStatus === "sent" ? "Gửi thành công!" : "Gửi email thử"}
                  </button>
                  <span className="text-xs text-slate-400">Email thử sẽ được gửi đến tài khoản admin của bạn.</span>
                </div>
                {testEmailMsg && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 ${testEmailStatus === "sent" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                    <span className="material-symbols-outlined text-[16px]">{testEmailStatus === "sent" ? "check_circle" : "error"}</span>
                    <span>{testEmailMsg}</span>
                  </div>
                )}
              </div>


              {/* Email templates info */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">Mẫu email đang dùng</div>
                {[
                  { name: "Chào mừng", trigger: "Khi người dùng đăng ký", icon: "waving_hand" },
                  { name: "Xác thực email", trigger: "Sau khi đăng ký", icon: "mark_email_read" },
                  { name: "Đặt lại mật khẩu", trigger: "Khi yêu cầu quên mật khẩu", icon: "lock_reset" },
                  { name: "Cảnh báo bảo mật", trigger: "Khi phát hiện đăng nhập lạ", icon: "security_update_warning" },
                  { name: "Tài khoản bị khóa", trigger: "Khi admin khóa tài khoản", icon: "lock" },
                ].map(t => (
                  <div key={t.name} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 text-xs hover:bg-slate-50/50 transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">{t.icon}</span>
                    <div>
                      <div className="font-semibold text-slate-800">{t.name}</div>
                      <div className="text-slate-400">{t.trigger}</div>
                    </div>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Hoạt động</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Feature Flags ───────────────────────────────────────────────── */}
          {tab === "flags" && (
            <div className="space-y-6">
              <p className="text-xs text-slate-500">Bật/tắt tính năng mà không cần triển khai lại. Thay đổi có hiệu lực ngay lập tức.</p>
              {flagGroups.map(group => (
                <div key={group} className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{group}</h4>
                  <div className="space-y-2">
                    {flags.filter(f => f.group === group).map(flag => (
                      <div key={flag.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${flag.enabled ? "bg-slate-50 border-slate-200" : "bg-white border-slate-100"}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${flag.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{flag.label}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{flag.description}</div>
                          </div>
                        </div>
                        <Toggle
                          id={`flag-${flag.id}`}
                          checked={flag.enabled}
                          onChange={() => toggleFlag(flag.id)}
                          danger={flag.id === "maintenance_mode"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── API Keys ────────────────────────────────────────────────────── */}
          {tab === "api" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Quản lý khóa API cho các dịch vụ bên thứ ba. Khóa được lưu mã hóa và chỉ hiển thị một phần.</p>
              {apis.map(api => (
                <div key={api.id} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-slate-600">api</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{api.name}</div>
                        <div className="text-xs text-slate-400">{api.provider}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${api.status === "connected" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : api.status === "disconnected" ? "bg-rose-100 text-rose-600 border border-rose-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                        {api.status === "connected" ? "✓ Kết nối" : api.status === "disconnected" ? "✕ Lỗi" : "? Chưa rõ"}
                      </span>
                      <button type="button" className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                        Kiểm tra
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 truncate">
                      {api.key}
                    </code>
                    <button type="button" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button type="button" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    Kiểm tra lần cuối: {api.last_check}
                  </div>
                </div>
              ))}
              <button type="button" className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-semibold text-slate-400 hover:border-slate-900 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[15px]">add</span>
                Thêm tích hợp mới
              </button>
            </div>
          )}

          {/* ─── Limits ──────────────────────────────────────────────────────── */}
          {tab === "limits" && (
            <div className="space-y-5 max-w-lg">
              {limitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-base text-rose-600">error</span>
                  <span>{limitError}</span>
                </div>
              )}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">info</span>
                Thay đổi hạn mức áp dụng cho <strong>người dùng mới</strong>. Giá trị phải là số nguyên dương (tối thiểu là 1).
              </div>
              <div className="space-y-4">
                {[
                  { key: "max_wallets", label: "Số ví tối đa / người dùng", unit: "ví", icon: "account_balance_wallet", defaultVal: "10" },
                  { key: "max_categories", label: "Số danh mục tùy chỉnh tối đa", unit: "danh mục", icon: "category", defaultVal: "50" },
                  { key: "max_file_size_mb", label: "Dung lượng file tối đa (mỗi file)", unit: "MB", icon: "upload_file", defaultVal: "5" },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-slate-600">{item.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                      <div className="text-[11px] text-slate-400">Tối thiểu: 1 {item.unit} (không cho phép số âm)</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={general[item.key as keyof typeof general]}
                        onKeyDown={e => {
                          // Chặn triệt để các phím số âm, số mũ và dấu thập phân
                          if (["-", "+", "e", "E", "."].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={e => {
                          const cleaned = e.target.value.replace(/[^0-9]/g, "");
                          if (cleaned === "") {
                            setGeneral(g => ({ ...g, [item.key]: "" }));
                            return;
                          }
                          const num = Math.max(1, parseInt(cleaned, 10));
                          setGeneral(g => ({ ...g, [item.key]: String(num) }));
                          setLimitError(null);
                        }}
                        onBlur={e => {
                          const val = e.target.value;
                          const num = parseInt(val, 10);
                          if (!val || isNaN(num) || num < 1) {
                            setGeneral(g => ({ ...g, [item.key]: item.defaultVal }));
                          }
                        }}
                        min="1"
                        step="1"
                        className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <span className="text-xs text-slate-500 whitespace-nowrap">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Infrastructure Settings ───────────────────────────────────────── */}
          {tab === "devops" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Nginx */}
                <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-700 text-[18px]">alt_route</span>
                      <span className="font-semibold text-xs text-slate-800">Nginx Reverse Proxy</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Cổng 80
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Điều hướng lưu lượng Frontend và Backend API qua cổng 80.</p>
                  <div className="mt-2 text-[10px] text-slate-400">Tệp cấu hình: <code className="font-mono text-slate-600">nginx/nginx.conf</code></div>
                </div>

                {/* Prometheus */}
                <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-700 text-[18px]">monitoring</span>
                      <span className="font-semibold text-xs text-slate-800">Prometheus</span>
                    </div>
                    <a
                      href="http://localhost:9090"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      Cổng 9090 <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500">Thu thập chỉ số hiệu năng và thời gian phản hồi API mỗi 15 giây.</p>
                  <div className="mt-2 text-[10px] text-slate-400">Endpoint: <a href="http://127.0.0.1:8000/metrics" target="_blank" rel="noopener noreferrer" className="font-mono text-indigo-600 hover:underline">/metrics</a></div>
                </div>

                {/* Grafana */}
                <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-700 text-[18px]">speed</span>
                      <span className="font-semibold text-xs text-slate-800">Grafana Dashboard</span>
                    </div>
                    <a
                      href="http://localhost:3001"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      Cổng 3001 <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500">Biểu đồ trực quan hóa dữ liệu giám sát hệ thống theo thời gian thực.</p>
                  <div className="mt-2 text-[10px] text-slate-400">Đăng nhập: <code className="font-mono text-slate-600">admin / admin123</code></div>
                </div>

                {/* Loki */}
                <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-700 text-[18px]">receipt_long</span>
                      <span className="font-semibold text-xs text-slate-800">Loki Logging</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Cổng 3100
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Thu thập và hỗ trợ truy vấn nhật ký lỗi tập trung bằng LogQL.</p>
                  <div className="mt-2 text-[10px] text-slate-400">Nguồn: Backend API và Nginx logs</div>
                </div>
              </div>

              {/* PostgreSQL & Scripts */}
              <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-700 text-[18px]">storage</span>
                    <span className="font-semibold text-xs text-slate-800">Cơ sở dữ liệu PostgreSQL 16</span>
                  </div>
                  <a
                    href="http://localhost:5050"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    pgAdmin (Cổng 5050) <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </a>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-6 mt-3 pt-3 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400">Sao lưu:</span> <code className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">bash scripts/backup.sh</code>
                  </div>
                  <div>
                    <span className="text-slate-400">Phục hồi:</span> <code className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">bash scripts/restore.sh &lt;file&gt;</code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
