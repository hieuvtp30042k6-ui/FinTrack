import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User } from "../../types/auth";
import {
  WalletModel,
  TransactionModel,
  getWalletsApi,
  getTransactionsApi,
} from "../../services/api";
import {
  PeriodType,
  getPresetDateRange,
  padZero,
} from "../../utils/dateRange";
import { convertToVnd } from "../../utils/currency";
import { usePrivacyMode, maskBalance } from "../../utils/privacyMode";
import { useTranslation } from "../../utils/i18n";

interface DashboardViewProps {
  user: User;
  onNavigateTab: (tabId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const fmtShort = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${Math.round(n)}`;
};

const CATEGORY_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6", // teal
];

export const DashboardView: React.FC<DashboardViewProps> = ({ user, onNavigateTab }) => {
  const { t, lang } = useTranslation();
  const [isPrivate, togglePrivacy] = usePrivacyMode();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("week");
  const [chartMode, setChartMode] = useState<"line" | "bar">("line");
  const [wallets, setWallets] = useState<WalletModel[]>([]);
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Hover states for tooltips
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const getDayLabel = useCallback(
    (dateStr: string): string => {
      const d = new Date(dateStr + "T00:00:00");
      const keys = ["day.sun", "day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat"];
      return t(keys[d.getDay()]);
    },
    [t]
  );

  // Date range from selected period
  const dateRange = useMemo(() => {
    return getPresetDateRange(selectedPeriod);
  }, [selectedPeriod]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [walletList, txList, allRecent] = await Promise.all([
        getWalletsApi(),
        getTransactionsApi({
          from_date: dateRange.from,
          to_date: dateRange.to,
        }),
        getTransactionsApi(),
      ]);
      setWallets(walletList);
      setTransactions(txList);
      setRecentTransactions(allRecent.slice(0, 5));
    } catch {
      // Keep resilient
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Financial totals (tự động quy đổi ngoại tệ về VNĐ, loại trừ ví lưu trữ và ví không tính vào tổng tài sản)
  const totalBalance = wallets
    .filter((w) => !w.is_excluded_from_total && !w.is_archived)
    .reduce((s, w) => s + convertToVnd(w.balance, w.currency || "VND"), 0);

  const hasForeignCurrency = wallets
    .filter((w) => !w.is_excluded_from_total && !w.is_archived)
    .some((w) => w.currency && w.currency.toUpperCase() !== "VND");

  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);

  const netBalance = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 && netBalance > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;

  // Timeline points for charts
  const chartPoints = useMemo(() => {
    if (selectedPeriod === "day") {
      const days: { key: string; label: string; income: number; expense: number }[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const y = d.getFullYear();
        const m = padZero(d.getMonth() + 1);
        const dt = padZero(d.getDate());
        const dateStr = `${y}-${m}-${dt}`;
        days.push({
          key: dateStr,
          label: i === 0 ? t("period.today") : `${dt}/${m}`,
          income: 0,
          expense: 0,
        });
      }
      transactions.forEach((tx) => {
        const found = days.find((p) => p.key === tx.transaction_date);
        if (found) {
          if (tx.type === "INCOME") found.income += tx.amount;
          else if (tx.type === "EXPENSE") found.expense += tx.amount;
        }
      });
      return days;
    }

    if (selectedPeriod === "week") {
      const [fromY, fromM, fromD] = dateRange.from.split("-").map(Number);
      const start = new Date(fromY, fromM - 1, fromD);
      const days: { key: string; label: string; income: number; expense: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const y = d.getFullYear();
        const m = padZero(d.getMonth() + 1);
        const dt = padZero(d.getDate());
        const dateStr = `${y}-${m}-${dt}`;
        days.push({
          key: dateStr,
          label: getDayLabel(dateStr),
          income: 0,
          expense: 0,
        });
      }
      transactions.forEach((tx) => {
        const found = days.find((p) => p.key === tx.transaction_date);
        if (found) {
          if (tx.type === "INCOME") found.income += tx.amount;
          else if (tx.type === "EXPENSE") found.expense += tx.amount;
        }
      });
      return days;
    }

    if (selectedPeriod === "month") {
      const [fromY, fromM] = dateRange.from.split("-").map(Number);
      const lastDay = new Date(fromY, fromM, 0).getDate();
      const points: { key: string; label: string; income: number; expense: number }[] = [];

      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${fromY}-${padZero(fromM)}-${padZero(day)}`;
        points.push({
          key: dateStr,
          label: `${padZero(day)}`,
          income: 0,
          expense: 0,
        });
      }
      transactions.forEach((tx) => {
        const found = points.find((p) => p.key === tx.transaction_date);
        if (found) {
          if (tx.type === "INCOME") found.income += tx.amount;
          else if (tx.type === "EXPENSE") found.expense += tx.amount;
        }
      });
      return points;
    }

    if (selectedPeriod === "quarter") {
      const [fromY, fromM] = dateRange.from.split("-").map(Number);
      const months: { key: string; label: string; income: number; expense: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const m = fromM + i;
        const key = `${fromY}-${padZero(m)}`;
        months.push({
          key,
          label: lang === "vi" ? `T${m}` : `M${m}`,
          income: 0,
          expense: 0,
        });
      }
      transactions.forEach((tx) => {
        const key = tx.transaction_date.slice(0, 7);
        const found = months.find((p) => p.key === key);
        if (found) {
          if (tx.type === "INCOME") found.income += tx.amount;
          else if (tx.type === "EXPENSE") found.expense += tx.amount;
        }
      });
      return months;
    }

    // year
    const [fromY] = dateRange.from.split("-").map(Number);
    const months: { key: string; label: string; income: number; expense: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${fromY}-${padZero(m)}`;
      months.push({
        key,
        label: lang === "vi" ? `T${m}` : `M${m}`,
        income: 0,
        expense: 0,
      });
    }
    transactions.forEach((tx) => {
      const key = tx.transaction_date.slice(0, 7);
      const found = months.find((p) => p.key === key);
      if (found) {
        if (tx.type === "INCOME") found.income += tx.amount;
        else if (tx.type === "EXPENSE") found.expense += tx.amount;
      }
    });
    return months;
  }, [selectedPeriod, dateRange, transactions, getDayLabel, t, lang]);

  // Max value across points for scale
  const maxPointVal = useMemo(() => {
    let max = 0;
    chartPoints.forEach((p) => {
      if (p.income > max) max = p.income;
      if (p.expense > max) max = p.expense;
    });
    return max > 0 ? max * 1.15 : 100_000;
  }, [chartPoints]);

  const avgExpense = useMemo(() => {
    if (chartPoints.length === 0) return 0;
    const s = chartPoints.reduce((sum, p) => sum + p.expense, 0);
    return s / chartPoints.length;
  }, [chartPoints]);

  // Expenses by Category for Donut Chart
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "EXPENSE")
      .forEach((t) => {
        const cat = t.category_name || "Chưa phân loại";
        map[cat] = (map[cat] ?? 0) + t.amount;
      });
    return map;
  }, [transactions]);

  const catEntries = useMemo(() => {
    return Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
  }, [expenseByCategory]);

  const totalCatExpense = catEntries.reduce((s, [, v]) => s + v, 0);

  // Donut geometry
  const DONUT_RADIUS = 48;
  const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

  const donutSegments = useMemo(() => {
    let offsetAcc = 0;
    return catEntries.map(([name, val], idx) => {
      const pct = totalCatExpense > 0 ? val / totalCatExpense : 0;
      const dash = pct * DONUT_CIRC;
      const seg = {
        name,
        val,
        pct,
        dash,
        offset: offsetAcc,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      };
      offsetAcc += dash;
      return seg;
    });
  }, [catEntries, totalCatExpense, DONUT_CIRC]);

  const periodOptions: { id: PeriodType; label: string }[] = useMemo(
    () => [
      { id: "day", label: t("period.day") },
      { id: "week", label: t("period.week") },
      { id: "month", label: t("period.month") },
      { id: "quarter", label: t("period.quarter") },
      { id: "year", label: t("period.year") },
    ],
    [t]
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ─── COMPACT TOP BAR ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
            {user.name?.charAt(0).toUpperCase() || "F"}
          </div>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
              {t("dashboard.hello")}, {user.name || "FinTracker"}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("dashboard.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Period selector tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
            {periodOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedPeriod === opt.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Quick Add Button */}
          <button
            type="button"
            onClick={() => onNavigateTab("expenses")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>{t("dashboard.record")}</span>
          </button>
        </div>
      </div>

      {/* ─── COMPACT 4-KPI METRIC CARDS ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Số dư ví */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("dashboard.total_assets")}
              </span>
              {hasForeignCurrency && (
                <span
                  className="text-[9px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded font-semibold border border-amber-200 dark:border-amber-800"
                  title="Auto converted"
                >
                  {t("dashboard.converted")}
                </span>
              )}
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[17px]">account_balance_wallet</span>
            </div>
          </div>
          <div>
            <div className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>{loading ? "..." : maskBalance(`${fmt(totalBalance)} đ`, isPrivate)}</span>
              <button
                type="button"
                onClick={togglePrivacy}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-0.5"
                title={isPrivate ? t("privacy.show_balance") : t("privacy.hide_balance")}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isPrivate ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>
                {wallets.length} {t("dashboard.active_wallets")}
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab("wallets")}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                {t("dashboard.wallets_link")}
              </button>
            </div>
          </div>
        </div>

        {/* KPI 2: Tổng chi tiêu */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("dashboard.total_expenses")}
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[17px]">trending_down</span>
            </div>
          </div>
          <div>
            <div className="font-display text-xl font-bold text-rose-600 dark:text-rose-400">
              {loading ? "..." : maskBalance(`${fmt(totalExpense)} đ`, isPrivate)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {totalExpense > 0
                ? `${t("dashboard.average")} ${fmt(Math.round(avgExpense))} đ${t("dashboard.per_step")}`
                : t("dashboard.no_expense")}
            </div>
          </div>
        </div>

        {/* KPI 3: Tổng thu nhập */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("dashboard.total_income")}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[17px]">payments</span>
            </div>
          </div>
          <div>
            <div className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : maskBalance(`${fmt(totalIncome)} đ`, isPrivate)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t("dashboard.net_cashflow")}{" "}
              <strong
                className={
                  netBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }
              >
                {maskBalance(`${netBalance >= 0 ? "+" : ""}${fmt(netBalance)} đ`, isPrivate)}
              </strong>
            </div>
          </div>
        </div>

        {/* KPI 4: Tỷ lệ tiết kiệm */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("dashboard.savings_rate")}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[17px]">savings</span>
            </div>
          </div>
          <div>
            <div className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {isPrivate ? "••••" : `${savingsRate}%`}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {savingsRate > 0 ? t("dashboard.positive_finance") : t("dashboard.no_surplus")}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN ANALYTICS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: INTERACTIVE CHART & RECENT TRANSACTIONS (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Main Chart Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-indigo-600 dark:text-indigo-400">
                  analytics
                </span>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {chartMode === "line"
                    ? t("dashboard.trend_income_expense")
                    : t("dashboard.chart_milestone")}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Mode toggle */}
                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setChartMode("line")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      chartMode === "line"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">show_chart</span>
                    <span>{t("dashboard.chart_line")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode("bar")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      chartMode === "bar"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">bar_chart</span>
                    <span>{t("dashboard.chart_bar")}</span>
                  </button>
                </div>

                {/* Legend */}
                {chartMode === "line" && (
                  <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-1 rounded-full bg-emerald-500"></span>{" "}
                      {t("dashboard.income")}
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-1 rounded-full bg-rose-500"></span>{" "}
                      {t("dashboard.expense")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Area */}
            {transactions.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs">
                <span className="material-symbols-outlined text-2xl text-slate-300 dark:text-slate-600 mb-1">
                  query_stats
                </span>
                <p>{t("dashboard.no_transactions")}</p>
              </div>
            ) : chartMode === "line" ? (
              // ─── SVG LINE / AREA CHART ──────────────────────────────
              (() => {
                const W = 540;
                const H = 150;
                const PAD_L = 46;
                const PAD_R = 16;
                const PAD_Y = 15;

                const n = chartPoints.length;
                const stepX = n > 1 ? (W - PAD_L - PAD_R) / (n - 1) : (W - PAD_L - PAD_R) / 2;
                const calcY = (val: number) => PAD_Y + (1 - val / maxPointVal) * (H - PAD_Y * 2);

                const xs = chartPoints.map((_, i) => PAD_L + i * stepX);
                const incomePts = chartPoints.map((p, i) => `${xs[i]},${calcY(p.income)}`).join(" ");
                const expensePts = chartPoints.map((p, i) => `${xs[i]},${calcY(p.expense)}`).join(" ");

                const activePt = hoveredPointIndex !== null ? chartPoints[hoveredPointIndex] : null;

                const yTicks = [
                  { ratio: 1, val: maxPointVal },
                  { ratio: 0.5, val: maxPointVal * 0.5 },
                  { ratio: 0, val: 0 },
                ];

                return (
                  <div className="relative pt-1">
                    {/* Tooltip */}
                    {activePt && hoveredPointIndex !== null && (
                      <div
                        className="absolute z-20 pointer-events-none bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xs text-white text-[11px] rounded-xl px-3 py-2 shadow-xl space-y-1 transform -translate-x-1/2 -translate-y-full -top-1"
                        style={{
                          left: `${(xs[hoveredPointIndex] / W) * 100}%`,
                        }}
                      >
                        <p className="font-semibold text-slate-300 border-b border-slate-700/80 pb-0.5">
                          {activePt.label}
                        </p>
                        <div className="flex items-center justify-between gap-3 text-emerald-400">
                          <span>{t("dashboard.income")}:</span>
                          <strong>+{fmt(activePt.income)} đ</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-rose-400">
                          <span>{t("dashboard.expense")}:</span>
                          <strong>-{fmt(activePt.expense)} đ</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-blue-300 border-t border-slate-700/50 pt-0.5">
                          <span>{t("dashboard.net")}:</span>
                          <strong>
                            {activePt.income >= activePt.expense ? "+" : ""}
                            {fmt(activePt.income - activePt.expense)} đ
                          </strong>
                        </div>
                      </div>
                    )}

                    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full h-44 overflow-visible">
                      {/* Grid lines & Y-axis labels */}
                      {yTicks.map(({ ratio, val }) => {
                        const y = PAD_Y + (1 - ratio) * (H - PAD_Y * 2);
                        return (
                          <g key={ratio}>
                            <line
                              x1={PAD_L}
                              y1={y}
                              x2={W - PAD_R}
                              y2={y}
                              stroke="#e2e8f0"
                              strokeDasharray="4 4"
                              strokeWidth="1"
                              className="dark:stroke-slate-800"
                            />
                            <text
                              x={PAD_L - 6}
                              y={y + 3.5}
                              textAnchor="end"
                              className="text-[9px] fill-slate-400 font-semibold"
                            >
                              {fmtShort(val)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Hover guideline */}
                      {hoveredPointIndex !== null && (
                        <line
                          x1={xs[hoveredPointIndex]}
                          y1={PAD_Y}
                          x2={xs[hoveredPointIndex]}
                          y2={H - PAD_Y}
                          stroke="#94a3b8"
                          strokeDasharray="3 3"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Line Thu Nhập (Emerald) */}
                      <polyline
                        points={incomePts}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Line Chi Tiêu (Rose) */}
                      <polyline
                        points={expensePts}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Dots and Axis labels */}
                      {chartPoints.map((pt, i) => {
                        const isHovered = hoveredPointIndex === i;
                        return (
                          <g
                            key={pt.key}
                            onMouseEnter={() => setHoveredPointIndex(i)}
                            onMouseLeave={() => setHoveredPointIndex(null)}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={xs[i]}
                              cy={calcY(pt.income)}
                              r={isHovered ? 5.5 : 3.5}
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="transition-all"
                            />
                            <circle
                              cx={xs[i]}
                              cy={calcY(pt.expense)}
                              r={isHovered ? 5.5 : 3.5}
                              fill="#f43f5e"
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="transition-all"
                            />
                            {/* Hitbox */}
                            <rect
                              x={xs[i] - 14}
                              y={0}
                              width={28}
                              height={H + 24}
                              fill="transparent"
                            />
                            {/* X-Label */}
                            {(n <= 12 || i % Math.ceil(n / 8) === 0) && (
                              <text
                                x={xs[i]}
                                y={H + 16}
                                textAnchor="middle"
                                className={`text-[10px] ${
                                  isHovered
                                    ? "fill-slate-900 dark:fill-white font-bold"
                                    : "fill-slate-400 dark:fill-slate-500"
                                }`}
                              >
                                {pt.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()
            ) : (
              // ─── COMPACT BAR CHART ──────────────────────────────────
              <div className="pt-2">
                <div className="flex items-end justify-between gap-1.5 h-40 px-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                  {chartPoints.map((pt, idx) => {
                    const val = pt.expense;
                    const heightPct = maxPointVal > 0 ? (val / maxPointVal) * 100 : 0;
                    const isHovered = hoveredPointIndex === idx;

                    return (
                      <div
                        key={pt.key}
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        className="flex flex-col items-center gap-1 flex-1 h-full justify-end cursor-pointer group"
                      >
                        {/* Số liệu hiển thị trực tiếp trên đỉnh cột */}
                        <span
                          className={`text-[8.5px] font-bold transition-all px-1 py-0.2 rounded ${
                            isHovered
                              ? "bg-slate-900 dark:bg-indigo-600 text-white scale-110 shadow-xs"
                              : val > 0
                              ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800"
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                          title={`${pt.label}: ${fmt(val)} đ`}
                        >
                          {val > 0 ? fmtShort(val) : 0}
                        </span>

                        <div
                          style={{ height: `${Math.max(heightPct, val > 0 ? 10 : 4)}%` }}
                          className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 shadow-2xs ${
                            isHovered
                              ? "bg-slate-900 dark:bg-indigo-600"
                              : val > avgExpense && avgExpense > 0
                              ? "bg-rose-500 hover:bg-rose-600"
                              : val > 0
                              ? "bg-slate-400 hover:bg-slate-500 dark:bg-slate-600"
                              : "bg-slate-100 dark:bg-slate-800"
                          }`}
                        />
                        <span
                          className={`text-[9px] truncate max-w-[28px] ${
                            isHovered
                              ? "font-bold text-slate-900 dark:text-white"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {pt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Summary bar */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 px-1">
                  <span>
                    {t("dashboard.period_total_expense")}{" "}
                    <strong className="text-rose-600 dark:text-rose-400">
                      {fmt(chartPoints.reduce((s, p) => s + p.expense, 0))} đ
                    </strong>
                  </span>
                  {avgExpense > 0 && (
                    <span>
                      {t("dashboard.average")}{" "}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {fmt(Math.round(avgExpense))} đ
                      </strong>
                      {t("dashboard.per_step")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Recent Transactions List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[19px] text-slate-500 dark:text-slate-400">
                  history
                </span>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {t("dashboard.recent_transactions")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("expenses")}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{t("dashboard.view_all_link")}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                {t("dashboard.no_recent_transactions")}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          tx.type === "INCOME"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {tx.type === "INCOME" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description || tx.category_name || t("dashboard.transaction")}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {tx.category_name} · {tx.wallet_name} · {tx.transaction_date}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`font-bold shrink-0 ml-3 ${
                        tx.type === "INCOME"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {maskBalance(
                        `${tx.type === "INCOME" ? "+" : "-"}${fmt(tx.amount)} đ`,
                        isPrivate
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: COMPACT DONUT & WALLETS SNAPSHOT (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Donut Chart: Category Spending Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[19px] text-blue-600 dark:text-blue-400">
                  pie_chart
                </span>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {t("dashboard.expense_breakdown")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("categories")}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {t("dashboard.categories_link")}
              </button>
            </div>

            {totalCatExpense === 0 ? (
              <div className="h-36 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs">
                <span className="material-symbols-outlined text-2xl text-slate-300 dark:text-slate-600 mb-1">
                  donut_small
                </span>
                <p>{t("dashboard.no_cat_expense")}</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* SVG Donut */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      fill="transparent"
                      r={DONUT_RADIUS}
                      stroke="#f1f5f9"
                      strokeWidth="12"
                      className="dark:stroke-slate-800"
                    />
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.name}
                        cx="60"
                        cy="60"
                        fill="transparent"
                        r={DONUT_RADIUS}
                        stroke={seg.color}
                        strokeWidth={hoveredCategory === seg.name ? "15" : "12"}
                        strokeDasharray={`${seg.dash} ${DONUT_CIRC - seg.dash}`}
                        strokeDashoffset={-seg.offset}
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(seg.name)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      />
                    ))}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none px-1">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase truncate max-w-[70px]">
                      {hoveredCategory || t("dashboard.total_cat_expense")}
                    </span>
                    <span className="font-display text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                      {fmt(hoveredCategory ? expenseByCategory[hoveredCategory] ?? 0 : totalCatExpense)} đ
                    </span>
                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                      {hoveredCategory
                        ? `${Math.round(
                            ((expenseByCategory[hoveredCategory] ?? 0) / (totalCatExpense || 1)) * 100
                          )}%`
                        : `${catEntries.length} ${t("dashboard.categories_count")}`}
                    </span>
                  </div>
                </div>

                {/* Progress bars list for top categories */}
                <div className="space-y-2.5 flex-1 w-full max-h-40 overflow-y-auto pr-1">
                  {donutSegments.slice(0, 5).map((seg) => (
                    <div
                      key={seg.name}
                      onMouseEnter={() => setHoveredCategory(seg.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                          {seg.name}
                        </span>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                            {fmt(seg.val)} đ
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[10px]">
                            {Math.round(seg.pct * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${seg.pct * 100}%`,
                            background: seg.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Wallets Quick Snapshot */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[19px] text-emerald-600 dark:text-emerald-400">
                  wallet
                </span>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {t("dashboard.accounts_wallets")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("wallets")}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {t("dashboard.manage_wallets")}
              </button>
            </div>

            {wallets.length === 0 ? (
              <div className="py-4 text-center text-slate-400 dark:text-slate-500 text-xs">
                {t("dashboard.no_wallets")}
              </div>
            ) : (
              <div className="space-y-2">
                {wallets.map((w) => (
                  <div
                    key={w.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold shadow-2xs">
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                      </div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{w.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {maskBalance(`${fmt(w.balance)} đ`, isPrivate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
