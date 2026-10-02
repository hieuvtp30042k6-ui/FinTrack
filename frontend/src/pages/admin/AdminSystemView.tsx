import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  getAdminSystemOverviewApi,
  SystemOverviewResponse,
} from "../../services/api";

// ─── Formatting Helpers ───────────────────────────────────────────────────────

const fmtNumber = (n: number): string =>
  Math.round(n).toLocaleString("vi-VN");

const fmtCurrency = (n: number): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);

const fmtShortVal = (val: number): string => {
  if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return `${Math.round(val)}`;
};

type PeriodOption = "day" | "week" | "month" | "year" | "custom";

// ─── Stat Card Component ──────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  badge?: string;
  badgeType?: "success" | "warning" | "info" | "neutral";
  icon: string;
  iconBg: string;
  iconColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  badge,
  badgeType = "neutral",
  icon,
  iconBg,
  iconColor,
}) => {
  const badgeClasses = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    warning: "bg-amber-50 text-amber-700 border-amber-200/60",
    info: "bg-blue-50 text-blue-700 border-blue-200/60",
    neutral: "bg-slate-100 text-slate-600 border-slate-200/60",
  }[badgeType];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-[22px] ${iconColor}`}>{icon}</span>
        </div>
        {badge && (
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
        {subValue && <div className="text-[11px] text-slate-400 mt-1 font-medium">{subValue}</div>}
      </div>
    </div>
  );
};

// ─── SVG Interactive Donut Chart ──────────────────────────────────────────────

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  subtitle?: string;
  data: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
}

const InteractiveDonutChart: React.FC<DonutChartProps> = ({
  title,
  subtitle,
  data,
  centerLabel,
  centerValue,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const R = 42;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  let accumulatedPercent = 0;
  const segments = data.map((d) => {
    const percent = total > 0 ? d.value / total : 0;
    const strokeDasharray = `${percent * CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    const strokeDashoffset = -accumulatedPercent * CIRCUMFERENCE;
    accumulatedPercent += percent;
    return {
      ...d,
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="my-4 flex items-center justify-center relative">
        <svg viewBox="0 0 110 110" className="w-36 h-36 transform -rotate-90">
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="12"
          />
          {segments.map((seg, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <circle
                key={seg.label}
                cx="55"
                cy="55"
                r={R}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? 14 : 12}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-200 cursor-pointer"
                opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-base font-bold text-slate-800 leading-tight">
            {activeSegment ? `${activeSegment.percent}%` : centerValue || fmtNumber(total)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium max-w-[70px] truncate">
            {activeSegment ? activeSegment.label : centerLabel || "Tổng"}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        {segments.map((seg, idx) => (
          <div
            key={seg.label}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg transition-colors cursor-pointer ${
              hoveredIdx === idx ? "bg-slate-50 font-semibold" : ""
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-slate-600 truncate">{seg.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-slate-800">{fmtNumber(seg.value)}</span>
              <span className="text-[10px] text-slate-400 w-8 text-right font-medium">
                {seg.percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Dual-Mode Main System Chart ──────────────────────────────────────────────

interface MainChartProps {
  data: Array<{
    label: string;
    income: number;
    expense: number;
    transaction_count: number;
    new_users: number;
  }>;
  chartMode: "finance" | "activity";
}

const MainSystemChart: React.FC<MainChartProps> = ({ data, chartMode }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const W = 720;
  const H = 220;
  const padL = 55;
  const padR = 25;
  const padTop = 30;
  const padBot = 35;
  const barAreaW = W - padL - padR;
  const barAreaH = H - padTop - padBot;

  const maxVal = useMemo(() => {
    if (chartMode === "finance") {
      const maxFin = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1000);
      return maxFin;
    } else {
      const maxAct = Math.max(...data.flatMap((d) => [d.transaction_count, d.new_users]), 5);
      return maxAct;
    }
  }, [data, chartMode]);

  const groupW = barAreaW / (data.length || 1);
  const barW = Math.min(24, groupW * 0.35);
  const gap = 4;

  const yTicks = [
    { ratio: 1, val: maxVal },
    { ratio: 0.66, val: maxVal * 0.66 },
    { ratio: 0.33, val: maxVal * 0.33 },
    { ratio: 0, val: 0 },
  ];

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative">
      {/* Tooltip */}
      {activePoint && hoveredIdx !== null && (
        <div
          className="absolute z-30 pointer-events-none bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 shadow-2xl space-y-1.5 transform -translate-x-1/2 -top-14"
          style={{
            left: `${((padL + hoveredIdx * groupW + groupW / 2) / W) * 100}%`,
          }}
        >
          <div className="font-semibold text-slate-300 border-b border-slate-700/80 pb-1 text-[11px]">
            {activePoint.label}
          </div>
          {chartMode === "finance" ? (
            <>
              <div className="flex items-center justify-between gap-4 text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Thu nhập:
                </span>
                <span className="font-bold">+{fmtCurrency(activePoint.income)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-rose-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                  Chi tiêu:
                </span>
                <span className="font-bold">-{fmtCurrency(activePoint.expense)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-blue-300 border-t border-slate-700/50 pt-1 text-[11px]">
                <span>Cân đối ròng:</span>
                <span className="font-bold">
                  {fmtCurrency(activePoint.income - activePoint.expense)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 text-violet-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                  Giao dịch:
                </span>
                <span className="font-bold">{fmtNumber(activePoint.transaction_count)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-blue-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  Người dùng mới:
                </span>
                <span className="font-bold">+{fmtNumber(activePoint.new_users)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* SVG Canvas */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 230 }}>
        <defs>
          <linearGradient id="emeraldBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="roseBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id="violetBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="blueBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        {/* Y-axis Ticks & Guidelines */}
        {yTicks.map(({ ratio, val }) => {
          const y = padTop + barAreaH * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="#f1f5f9"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              <text
                x={padL - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="#94a3b8"
                fontWeight="500"
              >
                {chartMode === "finance" ? fmtShortVal(val) : Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Bars and labels */}
        {data.map((d, i) => {
          const isHovered = hoveredIdx === i;
          const cx = padL + i * groupW + groupW / 2;

          if (chartMode === "finance") {
            const incH = Math.max((d.income / maxVal) * barAreaH, d.income > 0 ? 5 : 0);
            const expH = Math.max((d.expense / maxVal) * barAreaH, d.expense > 0 ? 5 : 0);
            const incX = cx - barW - gap / 2;
            const expX = cx + gap / 2;
            const incY = padTop + barAreaH - incH;
            const expY = padTop + barAreaH - expH;

            return (
              <g
                key={d.label + i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Hitbox */}
                <rect
                  x={cx - groupW / 2}
                  y={padTop}
                  width={groupW}
                  height={barAreaH + padBot}
                  fill="transparent"
                />

                {/* Hover Column Background */}
                {isHovered && (
                  <rect
                    x={cx - groupW / 2 + 4}
                    y={padTop}
                    width={groupW - 8}
                    height={barAreaH}
                    fill="#f8fafc"
                    rx={6}
                  />
                )}

                {/* Income Bar */}
                <rect
                  x={incX}
                  y={incY}
                  width={barW}
                  height={incH}
                  rx={4}
                  fill="url(#emeraldBarGrad)"
                  opacity={isHovered ? 1 : 0.88}
                />
                {d.income > 0 && (
                  <text
                    x={incX + barW / 2}
                    y={incY - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="600"
                    fill="#059669"
                  >
                    {fmtShortVal(d.income)}
                  </text>
                )}

                {/* Expense Bar */}
                <rect
                  x={expX}
                  y={expY}
                  width={barW}
                  height={expH}
                  rx={4}
                  fill="url(#roseBarGrad)"
                  opacity={isHovered ? 1 : 0.88}
                />
                {d.expense > 0 && (
                  <text
                    x={expX + barW / 2}
                    y={expY - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="600"
                    fill="#e11d48"
                  >
                    {fmtShortVal(d.expense)}
                  </text>
                )}

                {/* X-axis Label */}
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isHovered ? "700" : "500"}
                  fill={isHovered ? "#0f172a" : "#64748b"}
                >
                  {d.label}
                </text>
              </g>
            );
          } else {
            // Activity Mode
            const txH = Math.max((d.transaction_count / maxVal) * barAreaH, d.transaction_count > 0 ? 5 : 0);
            const userH = Math.max((d.new_users / maxVal) * barAreaH, d.new_users > 0 ? 5 : 0);
            const txX = cx - barW - gap / 2;
            const userX = cx + gap / 2;
            const txY = padTop + barAreaH - txH;
            const userY = padTop + barAreaH - userH;

            return (
              <g
                key={d.label + i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Hitbox */}
                <rect
                  x={cx - groupW / 2}
                  y={padTop}
                  width={groupW}
                  height={barAreaH + padBot}
                  fill="transparent"
                />

                {isHovered && (
                  <rect
                    x={cx - groupW / 2 + 4}
                    y={padTop}
                    width={groupW - 8}
                    height={barAreaH}
                    fill="#f8fafc"
                    rx={6}
                  />
                )}

                {/* Transaction Bar */}
                <rect
                  x={txX}
                  y={txY}
                  width={barW}
                  height={txH}
                  rx={4}
                  fill="url(#violetBarGrad)"
                  opacity={isHovered ? 1 : 0.88}
                />
                {d.transaction_count > 0 && (
                  <text
                    x={txX + barW / 2}
                    y={txY - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="600"
                    fill="#7c3aed"
                  >
                    {d.transaction_count}
                  </text>
                )}

                {/* New Users Bar */}
                <rect
                  x={userX}
                  y={userY}
                  width={barW}
                  height={userH}
                  rx={4}
                  fill="url(#blueBarGrad)"
                  opacity={isHovered ? 1 : 0.88}
                />
                {d.new_users > 0 && (
                  <text
                    x={userX + barW / 2}
                    y={userY - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="600"
                    fill="#2563eb"
                  >
                    {d.new_users}
                  </text>
                )}

                {/* X-axis Label */}
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isHovered ? "700" : "500"}
                  fill={isHovered ? "#0f172a" : "#64748b"}
                >
                  {d.label}
                </text>
              </g>
            );
          }
        })}
      </svg>
    </div>
  );
};

// ─── Main AdminSystemView ─────────────────────────────────────────────────────

export const AdminSystemView: React.FC = () => {
  const [data, setData] = useState<SystemOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time period controls: day, week, month, year, custom
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [chartMode, setChartMode] = useState<"finance" | "activity">("finance");

  const loadData = useCallback(async (p: PeriodOption = period, fromD?: string, toD?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminSystemOverviewApi({
        period: p,
        from_date: p === "custom" ? fromD || customFrom : undefined,
        to_date: p === "custom" ? toD || customTo : undefined,
      });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu thống kê.");
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    loadData("month");
  }, []);

  const handlePeriodChange = (newPeriod: PeriodOption) => {
    setPeriod(newPeriod);
    if (newPeriod !== "custom") {
      loadData(newPeriod);
    }
  };

  const handleApplyCustomDate = () => {
    if (customFrom && customTo && customFrom > customTo) {
      alert("Ngày bắt đầu không được lớn hơn ngày kết thúc!");
      return;
    }
    loadData("custom", customFrom, customTo);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="material-symbols-outlined text-4xl text-slate-400 animate-spin">
          progress_activity
        </span>
        <p className="text-sm font-medium text-slate-500">Đang chuẩn bị biểu đồ thống kê...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 flex items-center justify-between text-sm shadow-xs">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-red-500">error</span>
          <span>{error || "Không thể nạp dữ liệu thống kê hệ thống."}</span>
        </div>
        <button
          onClick={() => loadData(period)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          Tải lại
        </button>
      </div>
    );
  }

  const { users, transactions, wallets, categories, timeline_stats, monthly_stats, period_summary } = data;

  // Chart items: prioritize timeline_stats returned by backend
  const chartItems = (timeline_stats && timeline_stats.length > 0)
    ? timeline_stats
    : monthly_stats.slice(-6).map((m) => ({
        label: m.label,
        income: m.income,
        expense: m.expense,
        transaction_count: m.transaction_count,
        new_users: m.new_users,
      }));

  // Title for chart based on period
  const chartPeriodTitle = {
    day: "Hôm nay (theo khung giờ)",
    week: "Tuần này (theo các ngày)",
    month: "Tháng này (theo các tuần)",
    year: "Năm nay (12 tháng)",
    custom: `Khoảng ngày (${customFrom} đến ${customTo})`,
  }[period];

  // Donut 1: User Status Distribution
  const userStatusSegments: DonutSegment[] = [
    { label: "Hoạt động", value: users.active, color: "#10b981" },
    { label: "Bị khóa", value: users.locked, color: "#f43f5e" },
    { label: "Quản trị", value: users.admin_count, color: "#f59e0b" },
  ];

  // Donut 2: Auth Method Distribution
  const standardEmailUsers = Math.max(0, users.total - users.google_oauth_users);
  const authMethodSegments: DonutSegment[] = [
    { label: "Google OAuth", value: users.google_oauth_users, color: "#3b82f6" },
    { label: "Email / Mật khẩu", value: standardEmailUsers, color: "#8b5cf6" },
  ];

  // Donut 3: Transaction Types Distribution
  const txTypeSegments: DonutSegment[] = [
    { label: "Khoản thu", value: transactions.income_count, color: "#10b981" },
    { label: "Khoản chi", value: transactions.expense_count, color: "#fb7185" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header & Interactive Controls ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Thống Kê Hệ Thống</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Biểu đồ trực quan hóa dữ liệu theo ngày, tuần, tháng, năm hoặc tùy chọn ngày
          </p>
        </div>

        {/* Time Period Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/60">
            {(
              [
                { id: "day", label: "Ngày" },
                { id: "week", label: "Tuần" },
                { id: "month", label: "Tháng" },
                { id: "year", label: "Năm" },
                { id: "custom", label: "Chọn ngày" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => handlePeriodChange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  period === opt.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData(period)}
            title="Làm mới số liệu"
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[16px] text-slate-500 ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* ── Custom Date Range Picker Bar (Hiển thị khi chọn "Chọn ngày") ── */}
      {period === "custom" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="material-symbols-outlined text-[18px] text-blue-600">calendar_month</span>
            <span>Khoảng ngày tùy chọn:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Từ</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Đến</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleApplyCustomDate}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* ── Key Metrics Grid (Simplified, Modern, Visual) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Tổng người dùng"
          value={fmtNumber(users.total)}
          subValue={`+${users.new_last_30d} đăng ký trong 30 ngày`}
          badge={`${users.active} active`}
          badgeType="success"
          icon="group"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <MetricCard
          label="Tổng lượt giao dịch"
          value={fmtNumber(transactions.total)}
          subValue={`+${transactions.new_last_30d} phát sinh trong 30 ngày`}
          badge={`${transactions.income_count} thu · ${transactions.expense_count} chi`}
          badgeType="info"
          icon="receipt_long"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <MetricCard
          label="Tổng tài sản lưu trữ"
          value={fmtCurrency(wallets.total_balance)}
          subValue={`Tổng cộng ${wallets.total} ví đang quản lý`}
          badge="Số dư ví"
          badgeType="warning"
          icon="account_balance_wallet"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <MetricCard
          label="Quy mô danh mục"
          value={fmtNumber(categories.total)}
          subValue={`${categories.system_categories} chuẩn hệ thống · ${categories.user_categories} người dùng tạo`}
          badge="Danh mục"
          badgeType="neutral"
          icon="category"
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* ── Main Dynamic Visual Chart ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {chartMode === "finance"
                ? `Biểu đồ Dòng tiền & Tài chính - ${chartPeriodTitle}`
                : `Biểu đồ Tăng trưởng & Hoạt động - ${chartPeriodTitle}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {chartMode === "finance"
                ? "Theo dõi tổng thu nhập, chi tiêu và cán cân ròng theo chu kỳ đã chọn"
                : "Theo dõi lượng giao dịch phát sinh và số người dùng mới đăng ký"}
            </p>
          </div>

          {/* Mode Switcher & Legend */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/60">
              <button
                onClick={() => setChartMode("finance")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  chartMode === "finance"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-emerald-600">payments</span>
                <span>Dòng tiền</span>
              </button>
              <button
                onClick={() => setChartMode("activity")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  chartMode === "activity"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-violet-600">trending_up</span>
                <span>Tăng trưởng</span>
              </button>
            </div>

            {/* Legend Indicators */}
            <div className="hidden md:flex items-center gap-3 text-xs pl-2">
              {chartMode === "finance" ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 font-medium">Thu nhập</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-600 font-medium">Chi tiêu</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                    <span className="text-slate-600 font-medium">Giao dịch</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-600 font-medium">Người dùng mới</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* SVG Chart Rendering */}
        <MainSystemChart data={chartItems} chartMode={chartMode} />

        {/* Chart Bottom Summary Indicators for Selected Period */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div className="text-center p-3 rounded-xl bg-slate-50/70">
            <div className="text-xs font-bold text-emerald-600">
              {fmtCurrency(period_summary?.income ?? transactions.total_income)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Thu nhập trong kỳ
            </div>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-50/70">
            <div className="text-xs font-bold text-rose-500">
              {fmtCurrency(period_summary?.expense ?? transactions.total_expense)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Chi tiêu trong kỳ
            </div>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-50/70">
            <div
              className={`text-xs font-bold ${
                (period_summary?.net ?? transactions.net_balance) >= 0 ? "text-slate-800" : "text-rose-600"
              }`}
            >
              {fmtCurrency(period_summary?.net ?? transactions.net_balance)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Cân đối ròng trong kỳ
            </div>
          </div>
        </div>
      </div>

      {/* ── Tri-Donut Charts Section (Replaces Cluttered Lists) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <InteractiveDonutChart
          title="Trạng thái Người dùng"
          subtitle="Tỷ lệ người dùng active & kiểm soát rủi ro"
          data={userStatusSegments}
          centerLabel="Người dùng"
          centerValue={fmtNumber(users.total)}
        />
        <InteractiveDonutChart
          title="Phương thức Đăng nhập"
          subtitle="Tỷ lệ xác thực Google vs Mật khẩu"
          data={authMethodSegments}
          centerLabel="Tài khoản"
          centerValue={fmtNumber(users.total)}
        />
        <InteractiveDonutChart
          title="Cơ cấu Giao dịch"
          subtitle="Phân bổ giữa khoản thu & khoản chi"
          data={txTypeSegments}
          centerLabel="Giao dịch"
          centerValue={fmtNumber(transactions.total)}
        />
      </div>
    </div>
  );
};
