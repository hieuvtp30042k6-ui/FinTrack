import React, { useState, useMemo } from "react";
import { User } from "../../types/auth";
import { AdminDashboardStatsResponse } from "../../types/admin";
import { useTranslation } from "../../utils/i18n";
import { formatMoney } from "../../utils/currency";

interface AdminDashboardViewProps {
  user: User;
  stats: AdminDashboardStatsResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tabId: string) => void;
  onExportReport?: () => void;
}

const CATEGORY_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#64748b", // slate
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  stats,
  loading,
  onNavigateTab,
}) => {
  const { t, lang } = useTranslation();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const fmt = (n: number) => n.toLocaleString(lang === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 0 });
  const fmtCurrency = (n: number): string => formatMoney(n, "VND");

  const summary = stats?.summary;
  const growth = stats?.growth_chart || [];
  const recentUsers = stats?.recent_users || [];
  const topCategories = stats?.top_categories || [];

  const totalUsers = summary?.total_users ?? 0;
  const activeUsersCount = summary?.active_users ?? 0;
  const newUsersCount = summary?.new_users_7d ?? 0;
  const totalTransactions = summary?.total_transactions ?? 0;
  const totalVolume = summary?.total_volume ?? 0;

  // Retention rate
  const retentionRate = totalUsers > 0 ? Math.round((activeUsersCount / totalUsers) * 100) : 0;

  // Max value for growth chart
  const maxChartVal = useMemo(() => {
    let m = 0;
    growth.forEach((p) => {
      if (p.new_users > m) m = p.new_users;
      if (p.transactions_count > m) m = p.transactions_count;
    });
    return m === 0 ? 5 : Math.ceil(m * 1.25);
  }, [growth]);

  // Donut geometry for Category Breakdown
  const DONUT_RADIUS = 46;
  const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

  const totalCatAmount = useMemo(() => {
    return topCategories.reduce((s, c) => s + c.amount, 0);
  }, [topCategories]);

  const donutSegments = useMemo(() => {
    if (topCategories.length > 0 && totalCatAmount > 0) {
      let offsetAcc = 0;
      return topCategories.slice(0, 5).map((c, idx) => {
        const pct = c.amount / totalCatAmount;
        const dash = pct * DONUT_CIRC;
        const seg = {
          name: c.name,
          val: c.amount,
          pct,
          dash,
          offset: offsetAcc,
          color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        };
        offsetAcc += dash;
        return seg;
      });
    }

    // Fallback if no categories yet: Active vs Inactive users
    const inactiveUsers = Math.max(0, totalUsers - activeUsersCount);
    const fallbackItems = [
      { name: lang === "vi" ? "Đang hoạt động" : "Active", val: activeUsersCount, color: "#10b981" },
      { name: lang === "vi" ? "Chưa kích hoạt" : "Inactive", val: inactiveUsers, color: "#94a3b8" },
    ].filter((item) => item.val > 0);

    const sumVal = fallbackItems.reduce((s, i) => s + i.val, 0);
    let offsetAcc = 0;
    return fallbackItems.map((item) => {
      const pct = sumVal > 0 ? item.val / sumVal : 0;
      const dash = pct * DONUT_CIRC;
      const seg = {
        name: item.name,
        val: item.val,
        pct,
        dash,
        offset: offsetAcc,
        color: item.color,
      };
      offsetAcc += dash;
      return seg;
    });
  }, [topCategories, totalCatAmount, totalUsers, activeUsersCount, DONUT_CIRC, lang]);

  const getLocalizedDay = (day: string) => {
    if (lang === "vi") return day;
    const map: Record<string, string> = {
      "T2": "Mon", "T3": "Tue", "T4": "Wed", "T5": "Thu", "T6": "Fri", "T7": "Sat", "CN": "Sun",
      "Th 2": "Mon", "Th 3": "Tue", "Th 4": "Wed", "Th 5": "Thu", "Th 6": "Fri", "Th 7": "Sat", "CN ": "Sun"
    };
    return map[day] || day;
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. BANNER CHÀO MỪNG TINH GỌN ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
            {user.name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white leading-tight">
              {t("admin.dash.welcome", "Xin chào")}, {user.name || t("admin.dash.admin_title", "Quản trị viên")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t("admin.dash.status_stable", "Hệ thống FinTrack đang vận hành ổn định")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t("admin.dash.status_online", "Hệ thống trực tuyến")}
          </span>
        </div>
      </div>

      {/* ─── 2. HÀNG 4 THẺ CHỈ SỐ KPI CHÍNH ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng người dùng */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("admin.dash.total_users", "Tổng Người Dùng")}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">group</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-display">
              {loading ? "..." : fmt(totalUsers)}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              {activeUsersCount} {t("admin.dash.active_users", "đang hoạt động")} ({retentionRate}%)
            </p>
          </div>
        </div>

        {/* KPI 2: Người dùng mới */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("admin.dash.new_users_7d", "Người Dùng Mới (7D)")}
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-display">
              {loading ? "..." : `+${fmt(newUsersCount)}`}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
              {t("admin.dash.registered_7d", "Đăng ký trong 7 ngày qua")}
            </p>
          </div>
        </div>

        {/* KPI 3: Lượt giao dịch */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("admin.dash.total_tx", "Giao Dịch Hệ Thống")}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-display">
              {loading ? "..." : fmt(totalTransactions)}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
              {t("admin.dash.volume", "Khối lượng:")} <strong className="text-emerald-600 dark:text-emerald-400">{fmtCurrency(totalVolume)}</strong>
            </p>
          </div>
        </div>

        {/* KPI 4: Tỷ lệ hoạt động */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("admin.dash.retention_rate", "Tỷ Lệ Tương Tác")}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-display">
              {retentionRate}%
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
              {t("admin.dash.retention_sub", "Tài khoản duy trì thường xuyên")}
            </p>
          </div>
        </div>
      </div>

      {/* ─── 3. KHU VỰC BIỂU ĐỒ TRỰC QUAN CHÍNH (2 CỘT CÂN ĐỐI) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CỘT TRÁI: BIỂU ĐỒ XU HƯỚNG TĂNG TRƯỞNG (7 CỘT) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t("admin.dash.growth_title", "Xu Hướng Tăng Trưởng & Hoạt Động")}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {t("admin.dash.growth_subtitle", "Số liệu 7 ngày gần nhất")}
                </p>
              </div>

              {/* Chú giải màu sắc */}
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>{t("admin.dash.new_users_legend", "Người dùng mới")}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>{t("admin.dash.tx_legend", "Giao dịch")}</span>
                </span>
              </div>
            </div>

            {/* SVG Biểu đồ đường mượt mà */}
            {growth.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                {t("admin.dash.no_activity_7d", "Chưa có dữ liệu hoạt động trong 7 ngày")}
              </div>
            ) : (
              (() => {
                const W = 520;
                const H = 160;
                const PAD_L = 35;
                const PAD_R = 20;
                const PAD_Y = 18;

                const n = growth.length;
                const stepX = n > 1 ? (W - PAD_L - PAD_R) / (n - 1) : (W - PAD_L - PAD_R) / 2;
                const calcY = (val: number) =>
                  PAD_Y + (1 - val / maxChartVal) * (H - PAD_Y * 2);

                const xs = growth.map((_, i) => PAD_L + i * stepX);
                const userPts = growth
                  .map((p, i) => `${xs[i]},${calcY(p.new_users)}`)
                  .join(" ");
                const transPts = growth
                  .map((p, i) => `${xs[i]},${calcY(p.transactions_count)}`)
                  .join(" ");

                const activePt = hoveredPointIndex !== null ? growth[hoveredPointIndex] : null;

                const yTicks = [
                  { ratio: 1, val: Math.round(maxChartVal) },
                  { ratio: 0.5, val: Math.round(maxChartVal / 2) },
                  { ratio: 0, val: 0 },
                ];

                return (
                  <div className="relative pt-2">
                    {/* Tooltip Hover */}
                    {activePt && hoveredPointIndex !== null && (
                      <div
                        className="absolute z-20 pointer-events-none bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl space-y-1 transform -translate-x-1/2 -top-12"
                        style={{
                          left: `${(xs[hoveredPointIndex] / W) * 100}%`,
                        }}
                      >
                        <p className="font-semibold text-slate-300 border-b border-slate-700/80 pb-0.5 text-[11px]">
                          {getLocalizedDay(activePt.day_name)} ({activePt.display_date})
                        </p>
                        <div className="flex items-center justify-between gap-3 text-emerald-400 text-[11px]">
                          <span>{t("admin.dash.new_users_legend", "Người dùng:")}</span>
                          <strong>+{activePt.new_users}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-blue-400 text-[11px]">
                          <span>{t("admin.dash.tx_legend", "Giao dịch:")}</span>
                          <strong>{activePt.transactions_count}</strong>
                        </div>
                      </div>
                    )}

                    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full h-48 overflow-visible">
                      {/* Grid lines */}
                      {yTicks.map(({ ratio, val }) => {
                        const y = PAD_Y + (1 - ratio) * (H - PAD_Y * 2);
                        return (
                          <g key={ratio}>
                            <line
                              x1={PAD_L}
                              y1={y}
                              x2={W - PAD_R}
                              y2={y}
                              stroke="currentColor"
                              className="text-slate-100 dark:text-slate-800"
                              strokeDasharray="4 4"
                              strokeWidth="1"
                            />
                            <text
                              x={PAD_L - 8}
                              y={y + 3.5}
                              textAnchor="end"
                              className="text-[10px] fill-slate-400 dark:fill-slate-500 font-medium"
                            >
                              {val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Đường Người dùng mới (Emerald) */}
                      <polyline
                        points={userPts}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Đường Giao dịch (Blue) */}
                      <polyline
                        points={transPts}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Điểm nút & tương tác */}
                      {growth.map((pt, i) => {
                        const isHovered = hoveredPointIndex === i;
                        return (
                          <g
                            key={pt.date}
                            onMouseEnter={() => setHoveredPointIndex(i)}
                            onMouseLeave={() => setHoveredPointIndex(null)}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={xs[i]}
                              cy={calcY(pt.new_users)}
                              r={isHovered ? 5.5 : 3.5}
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="transition-all"
                            />
                            <circle
                              cx={xs[i]}
                              cy={calcY(pt.transactions_count)}
                              r={isHovered ? 5.5 : 3.5}
                              fill="#3b82f6"
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="transition-all"
                            />
                            <rect
                              x={xs[i] - 16}
                              y={0}
                              width={32}
                              height={H + 24}
                              fill="transparent"
                            />
                            <text
                              x={xs[i]}
                              y={H + 16}
                              textAnchor="middle"
                              className={`text-[10px] ${
                                isHovered ? "fill-slate-900 dark:fill-white font-bold" : "fill-slate-400 dark:fill-slate-500"
                              }`}
                            >
                              {getLocalizedDay(pt.day_name)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
            <span>
              {lang === "vi" ? "Tổng đăng ký 7 ngày: " : "7-day new signups: "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                +{growth.reduce((s, g) => s + g.new_users, 0)} {lang === "vi" ? "người dùng" : "users"}
              </strong>
            </span>
            <span>
              {lang === "vi" ? "Tổng giao dịch: " : "Total transactions: "}
              <strong className="text-blue-600 dark:text-blue-400">
                {growth.reduce((s, g) => s + g.transactions_count, 0)} {lang === "vi" ? "lượt" : "records"}
              </strong>
            </span>
          </div>
        </div>

        {/* CỘT PHẢI: BIỂU ĐỒ DONUT CƠ CẤU (5 CỘT) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {topCategories.length > 0 ? t("admin.dash.top_categories", "Cơ Cấu Danh Mục Chi Tiêu") : (lang === "vi" ? "Phân Bổ Người Dùng" : "User Distribution")}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {t("admin.dash.top_cat_sub", "Tỷ trọng các nhóm chi tiêu hàng đầu")}
              </p>
            </div>

            {donutSegments.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                {lang === "vi" ? "Chưa có dữ liệu cơ cấu" : "No breakdown data available"}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-6 py-2">
                {/* SVG Donut */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 110 110">
                    <circle
                      cx="55"
                      cy="55"
                      fill="transparent"
                      r={DONUT_RADIUS}
                      stroke="currentColor"
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="11"
                    />
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.name}
                        cx="55"
                        cy="55"
                        fill="transparent"
                        r={DONUT_RADIUS}
                        stroke={seg.color}
                        strokeWidth={hoveredCategory === seg.name ? "14" : "11"}
                        strokeDasharray={`${seg.dash} ${DONUT_CIRC}`}
                        strokeDashoffset={-seg.offset}
                        strokeLinecap="round"
                        className="transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(seg.name)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {hoveredCategory
                        ? `${Math.round(
                            (donutSegments.find((s) => s.name === hoveredCategory)?.pct || 0) * 100
                          )}%`
                        : "100%"}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      {hoveredCategory ? hoveredCategory.slice(0, 7) : (lang === "vi" ? "Toàn bộ" : "Total")}
                    </span>
                  </div>
                </div>

                {/* Chú giải phân bổ */}
                <div className="space-y-2 min-w-0 flex-1">
                  {donutSegments.map((seg) => (
                    <div
                      key={seg.name}
                      onMouseEnter={() => setHoveredCategory(seg.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                        hoveredCategory === seg.name ? "bg-slate-50 dark:bg-slate-800" : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                          {seg.name}
                        </span>
                      </div>
                      <span className="text-slate-900 dark:text-slate-100 font-bold shrink-0 text-[11px]">
                        {Math.round(seg.pct * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t("admin.dash.total_recorded_expense", "Tổng chi ghi nhận:")}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(totalCatAmount)}</span>
          </div>
        </div>
      </div>

      {/* ─── 4. LỐI TẮT CHỨC NĂNG & NGƯỜI DÙNG MỚI ĐĂNG KÝ ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Lối tắt quản trị nhanh (Quick Shortcuts) - 7 Cột */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            {t("admin.dash.quick_shortcuts", "Lối Tắt Quản Trị Nhanh")}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                id: "users",
                label: t("admin.dash.shortcut_users_title", "Người Dùng"),
                desc: t("admin.dash.shortcut_users_desc", "Phân quyền & Khóa"),
                icon: "group",
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/40 dark:hover:bg-blue-900/40",
              },
              {
                id: "categories",
                label: t("admin.dash.shortcut_cat_title", "Danh Mục"),
                desc: t("admin.dash.shortcut_cat_desc", "Chuẩn hóa chi tiêu"),
                icon: "category",
                color: "text-rose-600 dark:text-rose-400",
                bg: "bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/40 dark:hover:bg-rose-900/40",
              },
              {
                id: "system",
                label: t("admin.dash.shortcut_stats_title", "Thống Kê"),
                desc: t("admin.dash.shortcut_stats_desc", "Biểu đồ toàn sàn"),
                icon: "analytics",
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40",
              },
              {
                id: "monitor",
                label: t("admin.dash.shortcut_monitor_title", "Giám Sát"),
                desc: t("admin.dash.shortcut_monitor_desc", "Hạ tầng & Dịch vụ"),
                icon: "monitoring",
                color: "text-violet-600 dark:text-violet-400",
                bg: "bg-violet-50/70 hover:bg-violet-100/70 dark:bg-violet-950/40 dark:hover:bg-violet-900/40",
              },
            ].map((shortcut) => (
              <button
                key={shortcut.id}
                type="button"
                onClick={() => onNavigateTab(shortcut.id)}
                className={`p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-left transition-all cursor-pointer ${shortcut.bg}`}
              >
                <span className={`material-symbols-outlined text-2xl ${shortcut.color}`}>
                  {shortcut.icon}
                </span>
                <div className="font-bold text-xs text-slate-900 dark:text-white mt-2">{shortcut.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{shortcut.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Danh sách người dùng mới đăng ký - 5 Cột */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              {t("admin.dash.recent_registrations", "Đăng Ký Mới Nhất")}
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab("users")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              {t("admin.dash.view_all", "Tất cả →")}
            </button>
          </div>

          {recentUsers.length === 0 ? (
            <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
              {t("admin.dash.no_recent_users", "Chưa có người dùng mới")}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentUsers.slice(0, 4).map((u) => {
                const initials = u.name
                  ? u.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(-2)
                      .join("")
                      .toUpperCase()
                  : "U";

                return (
                  <div key={u.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.status === "active"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {u.status === "active" ? t("admin.dash.status_active", "Hoạt động") : t("admin.dash.status_locked", "Khóa")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
