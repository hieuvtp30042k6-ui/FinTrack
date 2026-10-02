import React, { useEffect, useState, useCallback, useMemo } from "react";
import { getAdminSecurityAuditLogApi, SecurityAuditLogResponse, AuditEvent } from "../../services/api";
import { Pagination } from "../../components/Pagination";

const severityStyle = {
  info: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", label: "INFO", icon: "info" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "WARNING", icon: "lock" },
  critical: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200", label: "CRITICAL", icon: "admin_panel_settings" },
};

const authMethodLabel: Record<string, string> = {
  google_oauth: "Google OAuth",
  email_password: "Email/Password",
};

type TabKey = "all" | "locks" | "admins";

export const AdminSecurityView: React.FC = () => {
  const [data, setData] = useState<SecurityAuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminSecurityAuditLogApi();
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tải nhật ký bảo mật.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab]);

  const currentEvents: AuditEvent[] = useMemo(() => {
    if (!data) return [];
    if (tab === "locks") return data.lock_events || [];
    if (tab === "admins") return data.admin_events || [];
    return data.registration_events || [];
  }, [data, tab]);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentEvents.slice(start, start + pageSize);
  }, [currentEvents, currentPage, pageSize]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <span className="material-symbols-outlined text-4xl text-slate-400 animate-spin">progress_activity</span>
      <p className="text-sm text-slate-400">Đang tải nhật ký bảo mật...</p>
    </div>
  );

  if (error || !data) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 flex items-center gap-3 text-sm">
      <span className="material-symbols-outlined text-xl">error</span>
      <span>{error || "Lỗi không xác định."}</span>
      <button onClick={load} className="ml-auto px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer">Thử lại</button>
    </div>
  );

  const { summary, registration_events = [], lock_events = [], admin_events = [] } = data;

  const tabs: Array<{ key: TabKey; label: string; count: number; icon: string }> = [
    { key: "all", label: "Đăng ký", count: registration_events.length, icon: "person_add" },
    { key: "locks", label: "Bị khóa", count: lock_events.length, icon: "lock" },
    { key: "admins", label: "Admin", count: admin_events.length, icon: "admin_panel_settings" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cấu hình bảo mật & Kiểm toán</h2>
          <p className="text-xs text-slate-400 mt-0.5">Nhật ký hoạt động bảo mật hệ thống · Cập nhật: {summary.generated_at}</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-all cursor-pointer">
          <span className="material-symbols-outlined text-[15px]">refresh</span>Làm mới
        </button>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tổng tài khoản", value: summary.total_accounts, icon: "group", accent: "bg-blue-50", color: "text-blue-600" },
          { label: "Đang bị khóa", value: summary.locked_accounts, icon: "lock", accent: "bg-amber-50", color: "text-amber-600", tag: `${summary.lock_rate}%` },
          { label: "Google OAuth", value: summary.google_oauth_accounts, icon: "g_mobiledata", accent: "bg-violet-50", color: "text-violet-600", tag: `${summary.oauth_adoption_rate}%` },
          { label: "Tài khoản Admin", value: summary.admin_accounts, icon: "verified_user", accent: "bg-rose-50", color: "text-rose-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl ${card.accent} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-[20px] ${card.color}`}>{card.icon}</span>
              </div>
              {card.tag && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{card.tag}</span>
              )}
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Security Health Bars */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-slate-600">health_and_safety</span>
          Chỉ số bảo mật hệ thống
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              label: "Tỷ lệ tài khoản hoạt động",
              value: summary.total_accounts > 0 ? ((summary.active_accounts / summary.total_accounts) * 100) : 0,
              color: "bg-emerald-500",
              textColor: "text-emerald-600",
              sub: `${summary.active_accounts} / ${summary.total_accounts}`,
            },
            {
              label: "Tỷ lệ tài khoản bị khóa",
              value: summary.lock_rate,
              color: summary.lock_rate > 20 ? "bg-rose-500" : summary.lock_rate > 5 ? "bg-amber-500" : "bg-slate-300",
              textColor: summary.lock_rate > 20 ? "text-rose-600" : summary.lock_rate > 5 ? "text-amber-600" : "text-slate-500",
              sub: `${summary.locked_accounts} tài khoản bị khóa`,
            },
            {
              label: "Tỷ lệ Google OAuth",
              value: summary.oauth_adoption_rate,
              color: "bg-blue-500",
              textColor: "text-blue-600",
              sub: `${summary.google_oauth_accounts} dùng Google`,
            },
            {
              label: "Đăng ký mới 7 ngày",
              value: summary.total_accounts > 0 ? Math.min((summary.new_registrations_7d / summary.total_accounts) * 100 * 5, 100) : 0,
              color: "bg-violet-500",
              textColor: "text-violet-600",
              sub: `+${summary.new_registrations_7d} tài khoản mới`,
            },
          ].map((bar) => (
            <div key={bar.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-600">{bar.label}</span>
                <span className={`text-xs font-bold ${bar.textColor}`}>{bar.value.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${bar.color}`}
                  style={{ width: `${Math.min(bar.value, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">{bar.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-1 pt-1 gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              type="button"
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${
                tab === t.key
                  ? "bg-white border border-b-white border-slate-200 text-slate-900 -mb-px"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {currentEvents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300">check_circle</span>
            Không có sự kiện nào trong danh mục này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-5 text-left">Mức độ</th>
                  <th className="py-3 px-5 text-left">Sự kiện</th>
                  <th className="py-3 px-5 text-left">Người dùng</th>
                  <th className="py-3 px-5 text-left">Phương thức</th>
                  <th className="py-3 px-5 text-left">Trạng thái</th>
                  <th className="py-3 px-5 text-left">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedEvents.map((event) => {
                  const sev = severityStyle[event.severity as keyof typeof severityStyle] || severityStyle.info;
                  return (
                    <tr key={event.event_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                          <span className="material-symbols-outlined text-[11px]">{sev.icon}</span>
                          {sev.label}
                        </span>
                      </td>
                      <td className="py-3 px-5 max-w-[220px]">
                        <div className="font-mono text-[10px] text-slate-500">{event.event_id}</div>
                        <div className="text-slate-700 text-[11px] truncate">{event.description}</div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="font-semibold text-slate-800">{event.user_name}</div>
                        <div className="text-[10px] text-slate-400">{event.user_email}</div>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${event.auth_method === "google_oauth" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-600"}`}>
                          <span className="material-symbols-outlined text-[11px]">{event.auth_method === "google_oauth" ? "g_mobiledata" : "email"}</span>
                          {authMethodLabel[event.auth_method]}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1 font-medium ${event.user_status === "active" ? "text-emerald-600" : event.user_status === "locked" ? "text-rose-500" : "text-slate-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${event.user_status === "active" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                          {event.user_status}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-slate-400 font-mono text-[10px]">{event.timestamp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang sự kiện bảo mật */}
        {currentEvents.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={currentEvents.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            itemName="sự kiện"
          />
        )}
      </div>
    </div>
  );
};
