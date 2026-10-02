import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Pagination } from "../../components/Pagination";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogEntry {
  id: string;
  timestamp: string;
  level: "error" | "warning" | "info";
  message: string;
  module: string;
  detail?: string;
}

interface ServiceStatus {
  name: string;
  status: "up" | "down" | "degraded";
  latency_ms: number;
  last_check: string;
  uptime_percent: number;
  icon: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// ─── Mock data & Services ──────────────────────────────────────────────────
const generateLogs = (): LogEntry[] => [
  { id: "l1", timestamp: new Date(Date.now() - 30000).toISOString(), level: "info", message: "[Prometheus] Scrape endpoint /metrics succeeded (200 OK, latency: 12ms)", module: "prometheus.scraper" },
  { id: "l2", timestamp: new Date(Date.now() - 90000).toISOString(), level: "info", message: "[Loki] Ingested 142 log streams from Nginx reverse proxy and FastAPI container", module: "loki.ingest", detail: "Stream match: {job=\"expense-tracker-backend\"} - chunks compressed to tsdb filesystem" },
  { id: "l3", timestamp: new Date(Date.now() - 300000).toISOString(), level: "info", message: "[Nginx] Routed incoming API traffic to backend_upstream:8000 (HTTP/1.1 200)", module: "nginx.proxy" },
  { id: "l4", timestamp: new Date(Date.now() - 1200000).toISOString(), level: "info", message: "[PostgreSQL] Automated backup script backup.sh executed successfully (42.8 MB gz)", module: "scripts.backup", detail: "pg_dump -U postgres expense_tracker | gzip > backups/expense_tracker_backup_20261002.sql.gz" },
  { id: "l5", timestamp: new Date(Date.now() - 3600000).toISOString(), level: "warning", message: "[Security] Rate limit threshold warning: IP 113.185.44.20 exceeded 60 req/min", module: "security.ratelimit", detail: "Exceeded threshold. Nginx client_max_body_size enforced, rate limiting active." },
  { id: "l6", timestamp: new Date(Date.now() - 7200000).toISOString(), level: "info", message: "[Grafana] Dashboard 'Expense Tracker - System & API Monitoring' refreshed", module: "grafana.dashboards" },
  { id: "l7", timestamp: new Date(Date.now() - 10800000).toISOString(), level: "warning", message: "[Auth] Failed login attempts: 3x from user@example.com", module: "auth.login" },
  { id: "l8", timestamp: new Date(Date.now() - 14400000).toISOString(), level: "error", message: "[Audit] Account locked event recorded in audit_logs (Target User ID: 14)", module: "audit.event", detail: "Admin performed lock operation on suspicious user account." },
  { id: "l9", timestamp: new Date(Date.now() - 21600000).toISOString(), level: "info", message: "[Docker] Container expense-tracker-backend healthy (Uptime: 99.98%)", module: "docker.health" },
  { id: "l10", timestamp: new Date(Date.now() - 86400000).toISOString(), level: "info", message: "[Database] PostgreSQL connection pool stabilized (Pool size: 10 connections)", module: "db.session" },
];

const INITIAL_SERVICES: ServiceStatus[] = [
  { name: "Backend API (FastAPI)", status: "up", latency_ms: 22, last_check: new Date().toISOString(), uptime_percent: 99.98, icon: "dns" },
  { name: "CSDL (PostgreSQL 16)", status: "up", latency_ms: 6, last_check: new Date().toISOString(), uptime_percent: 99.99, icon: "database" },
  { name: "Reverse Proxy (Nginx)", status: "up", latency_ms: 2, last_check: new Date().toISOString(), uptime_percent: 100, icon: "alt_route" },
  { name: "Monitoring (Prometheus)", status: "up", latency_ms: 14, last_check: new Date().toISOString(), uptime_percent: 99.95, icon: "monitoring" },
  { name: "Dashboard (Grafana)", status: "up", latency_ms: 18, last_check: new Date().toISOString(), uptime_percent: 99.95, icon: "speed" },
  { name: "Logging (Loki + LogQL)", status: "up", latency_ms: 25, last_check: new Date().toISOString(), uptime_percent: 99.92, icon: "receipt_long" },
  { name: "Quản trị CSDL (pgAdmin)", status: "up", latency_ms: 30, last_check: new Date().toISOString(), uptime_percent: 99.90, icon: "storage" },
  { name: "Dịch vụ Email (SMTP)", status: "up", latency_ms: 450, last_check: new Date().toISOString(), uptime_percent: 98.50, icon: "mail" },
];

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s trước`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return `${Math.floor(diff / 86400000)} ngày trước`;
}

// ─── Service Status Card ──────────────────────────────────────────────────────
const ServiceCard: React.FC<{ svc: ServiceStatus; onRefresh: () => void }> = ({ svc, onRefresh }) => {
  const colorMap = { up: "text-emerald-600 bg-emerald-50 border-emerald-200", down: "text-rose-600 bg-rose-50 border-rose-200", degraded: "text-amber-700 bg-amber-50 border-amber-200" };
  const dotMap = { up: "bg-emerald-500 animate-pulse", down: "bg-rose-500", degraded: "bg-amber-500 animate-pulse" };
  const labelMap = { up: "Hoạt động", down: "Ngừng hoạt động", degraded: "Giảm hiệu suất" };

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${svc.status === "down" ? "border-rose-200" : svc.status === "degraded" ? "border-amber-200" : "border-slate-200/80"}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${colorMap[svc.status]}`}>
            <span className={`material-symbols-outlined text-[17px]`}>{svc.icon}</span>
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-xs">{svc.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotMap[svc.status]}`}></span>
              <span className={`text-[10px] font-semibold ${svc.status === "up" ? "text-emerald-600" : svc.status === "down" ? "text-rose-600" : "text-amber-700"}`}>{labelMap[svc.status]}</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={onRefresh}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors">
          <span className="material-symbols-outlined text-[14px]">refresh</span>
        </button>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Độ trễ</span>
          <span className={`font-mono font-semibold ${svc.latency_ms > 1000 ? "text-amber-600" : svc.latency_ms === 0 ? "text-rose-600" : "text-slate-700"}`}>
            {svc.latency_ms === 0 ? "N/A" : `${svc.latency_ms} ms`}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Uptime</span>
          <span className={`font-semibold ${svc.uptime_percent >= 99 ? "text-emerald-600" : svc.uptime_percent >= 95 ? "text-amber-600" : "text-rose-600"}`}>
            {svc.uptime_percent.toFixed(2)}%
          </span>
        </div>
        {/* Uptime bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${svc.uptime_percent >= 99 ? "bg-emerald-500" : svc.uptime_percent >= 95 ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${svc.uptime_percent}%` }} />
        </div>
        <div className="text-[10px] text-slate-400 text-right">{relativeTime(svc.last_check)}</div>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────
export const AdminMonitorView: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>(generateLogs());
  const [services, setServices] = useState<ServiceStatus[]>(INITIAL_SERVICES);
  const [logFilter, setLogFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    setLogs(generateLogs());
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const refreshService = (name: string) => {
    setServices(prev => prev.map(s => s.name === name ? { ...s, last_check: new Date().toISOString() } : s));
  };

  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(5);

  const filteredLogs = useMemo(() => {
    return logFilter === "all" ? logs : logs.filter(l => l.level === logFilter);
  }, [logs, logFilter]);

  const paginatedLogs = useMemo(() => {
    const start = (logsCurrentPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, logsCurrentPage, logsPageSize]);

  const errorCount = logs.filter(l => l.level === "error").length;
  const warningCount = logs.filter(l => l.level === "warning").length;
  const servicesDown = services.filter(s => s.status === "down").length;
  const servicesDegraded = services.filter(s => s.status === "degraded").length;

  const avgLatency = Math.round(services.filter(s => s.status !== "down").reduce((acc, s) => acc + s.latency_ms, 0) / services.filter(s => s.status !== "down").length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Giám sát hệ thống</h2>
          <p className="text-xs text-slate-400 mt-0.5">Cập nhật lúc: {lastRefresh.toLocaleTimeString("vi-VN")} · Tự động làm mới mỗi 30 giây</p>
        </div>
        <button onClick={refresh}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[15px]">refresh</span>Làm mới
        </button>
      </div>

      {/* Alert banners */}
      {(servicesDown > 0 || servicesDegraded > 0) && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${servicesDown > 0 ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
          <span className={`material-symbols-outlined text-2xl ${servicesDown > 0 ? "text-rose-600" : "text-amber-600"}`}>warning</span>
          <div>
            <div className={`font-bold text-sm ${servicesDown > 0 ? "text-rose-800" : "text-amber-800"}`}>
              {servicesDown > 0 ? `${servicesDown} dịch vụ đang ngừng hoạt động!` : `${servicesDegraded} dịch vụ giảm hiệu suất`}
            </div>
            <div className={`text-xs ${servicesDown > 0 ? "text-rose-600" : "text-amber-700"}`}>
              {services.filter(s => s.status !== "up").map(s => s.name).join(", ")}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Lỗi (24h)", value: errorCount, icon: "cancel", text: errorCount > 0 ? "text-rose-600" : "text-slate-900", badge: errorCount > 0 ? "bg-rose-100 text-rose-700" : "" },
          { label: "Cảnh báo (24h)", value: warningCount, icon: "warning", text: warningCount > 2 ? "text-amber-600" : "text-slate-900", badge: "" },
          { label: "Độ trễ TB", value: `${avgLatency} ms`, icon: "speed", text: avgLatency > 500 ? "text-amber-600" : "text-emerald-600", badge: "" },
          { label: "Dịch vụ Online", value: `${services.filter(s => s.status === "up").length}/${services.length}`, icon: "cloud_done", text: "text-slate-900", badge: "" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-[18px] ${c.text}`}>{c.icon}</span>
              <span className="text-xs text-slate-500">{c.label}</span>
            </div>
            <div className={`text-2xl font-bold ${c.text}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/80 px-4 py-3 shadow-sm text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <span className="material-symbols-outlined text-[18px] text-slate-400">open_in_new</span>
          <span>Bảng điều khiển:</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <span>Grafana (3001)</span>
          </a>
          <a
            href="http://localhost:9090"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <span>Prometheus (9090)</span>
          </a>
          <a
            href="http://127.0.0.1:8000/metrics"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <span>Metrics API</span>
          </a>
          <a
            href="http://localhost:5050"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <span>pgAdmin (5050)</span>
          </a>
        </div>
      </div>

      {/* Service Status */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[18px] text-slate-600">hub</span>
          <h3 className="font-bold text-slate-900 text-sm">Trạng thái dịch vụ</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {services.map(svc => (
            <ServiceCard key={svc.name} svc={svc} onRefresh={() => refreshService(svc.name)} />
          ))}
        </div>
      </div>

      {/* Log Viewer */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px] text-white">terminal</span>
          </div>
          <div>
            <span className="font-semibold text-slate-800 text-sm">Application Logs</span>
            <span className="text-[11px] text-slate-400 ml-2">24 giờ gần nhất</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {(["all", "error", "warning", "info"] as const).map(f => (
              <button key={f} type="button" onClick={() => {
                setLogFilter(f);
                setLogsCurrentPage(1);
              }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${logFilter === f
                  ? f === "error" ? "bg-rose-600 text-white" : f === "warning" ? "bg-amber-500 text-white" : f === "info" ? "bg-blue-600 text-white" : "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {f === "all" ? `Tất cả (${logs.length})` : f === "error" ? `Error (${errorCount})` : f === "warning" ? `Warning (${warningCount})` : `Info (${logs.filter(l => l.level === "info").length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {paginatedLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300">check_circle</span>
              Không có log nào ở cấp độ này.
            </div>
          ) : (
            paginatedLogs.map(log => (
              <div key={log.id} className="hover:bg-slate-50/70 transition-colors">
                <div
                  className="flex items-start gap-3 px-5 py-3 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${log.level === "error" ? "text-rose-500" : log.level === "warning" ? "text-amber-500" : "text-blue-500"}`}>
                    {log.level === "error" ? "error" : log.level === "warning" ? "warning" : "info"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${log.level === "error" ? "bg-rose-100 text-rose-700" : log.level === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        {log.level}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{log.module}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">{relativeTime(log.timestamp)}</span>
                    </div>
                    <div className="text-xs text-slate-800 font-medium mt-1">{log.message}</div>
                  </div>
                  <span className={`material-symbols-outlined text-[14px] text-slate-400 shrink-0 transition-transform ${expandedLog === log.id ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </div>
                {expandedLog === log.id && log.detail && (
                  <div className="mx-5 mb-3 p-3 bg-slate-900 rounded-xl">
                    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-words">{log.detail}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={logsCurrentPage}
          totalItems={filteredLogs.length}
          pageSize={logsPageSize}
          onPageChange={setLogsCurrentPage}
          onPageSizeChange={(newSize) => {
            setLogsPageSize(newSize);
            setLogsCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 20]}
        />
      </div>
    </div>
  );
};
