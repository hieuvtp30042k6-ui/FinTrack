import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReportSummaryModel,
  CategoryReportModel,
  BudgetReportModel,
  CategoryExpenseItemModel,
  getReportSummaryApi,
  getReportCategoriesApi,
  getReportBudgetsApi,
} from "../../services/api";
import { PeriodType, getPresetDateRange } from "../../utils/dateRange";
import { useTranslation } from "../../utils/i18n";

const fmt = (n: number) =>
  n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const CATEGORY_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#f97316", // orange
];

export const ReportsView: React.FC = () => {
  const { t, lang } = useTranslation();
  const [reportPeriod, setReportPeriod] = useState<PeriodType>("month");
  const [customFrom, setCustomFrom] = useState<string>(() => getPresetDateRange("month").from);
  const [customTo, setCustomTo] = useState<string>(() => getPresetDateRange("month").to);

  const [summary, setSummary] = useState<ReportSummaryModel | null>(null);
  const [catReport, setCatReport] = useState<CategoryReportModel | null>(null);
  const [budgetReport, setBudgetReport] = useState<BudgetReportModel | null>(null);

  const [hoveredCategory, setHoveredCategory] = useState<CategoryExpenseItemModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Xác định khoảng ngày thực tế để gọi API
  const activeRange = useMemo(() => {
    if (reportPeriod === "custom") {
      return { from: customFrom, to: customTo };
    }
    return getPresetDateRange(reportPeriod);
  }, [reportPeriod, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    const { from, to } = activeRange;
    if (from && to && from > to) {
      setError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [sumRes, catRes, budRes] = await Promise.all([
        getReportSummaryApi(from, to),
        getReportCategoriesApi(from, to),
        getReportBudgetsApi(from, to),
      ]);
      setSummary(sumRes);
      setCatReport(catRes);
      setBudgetReport(budRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tải dữ liệu báo cáo.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Xử lý khi thay đổi Preset kỳ báo cáo
  const handlePeriodChange = (val: PeriodType) => {
    setReportPeriod(val);
    if (val !== "custom") {
      const range = getPresetDateRange(val);
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  };

  // Xuất file CSV báo cáo tài chính
  const handleExportCSV = () => {
    if (!summary || !catReport) return;

    let csvContent = "\uFEFF"; // UTF-8 BOM cho tiếng Việt trong Excel
    csvContent += `BÁO CÁO TÀI CHÍNH FINTRAC\n`;
    csvContent += `Khoảng thời gian: ${summary.from_date} đến ${summary.to_date}\n\n`;

    csvContent += `I. TỔNG QUAN TÀI CHÍNH\n`;
    csvContent += `Tổng thu nhập,${summary.total_income},VND\n`;
    csvContent += `Tổng chi tiêu,${summary.total_expense},VND\n`;
    csvContent += `Số dư ròng,${summary.balance},VND\n`;
    csvContent += `Tỷ lệ tiết kiệm,${summary.savings_rate}%\n`;
    csvContent += `Số lượng giao dịch,${summary.transaction_count}\n\n`;

    csvContent += `II. CHI TIẾT CHI TIÊU THEO DANH MỤC\n`;
    csvContent += `Mã danh mục,Tên danh mục,Tổng chi tiêu (VND),Tỷ lệ (%),Số giao dịch\n`;
    catReport.categories.forEach((c) => {
      csvContent += `${c.category_id},"${c.category_name.replace(/"/g, '""')}",${c.total_expense},${c.percentage}%,${c.transaction_count}\n`;
    });

    if (budgetReport && budgetReport.budgets.length > 0) {
      csvContent += `\nIII. ĐỐI CHIẾU TIẾN ĐỘ NGÂN SÁCH\n`;
      csvContent += `Danh mục,Hạn mức (VND),Đã chi (VND),Còn lại (VND),Tỷ lệ sử dụng (%)\n`;
      budgetReport.budgets.forEach((b) => {
        csvContent += `"${(b.category_name || "Tất cả danh mục").replace(/"/g, '""')}",${b.budget_amount},${b.spent_amount},${b.remaining_amount},${b.usage_percent}%\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Bao_cao_tai_chinh_${summary.from_date}_${summary.to_date}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalIncome = summary?.total_income ?? 0;
  const totalExpense = summary?.total_expense ?? 0;
  const balance = summary?.balance ?? 0;
  const savingsRate = summary?.savings_rate ?? 0;
  const txCount = summary?.transaction_count ?? 0;

  // ─── Tính toán cho Biểu đồ tròn (Donut Chart) ──────────────────────────────
  const DONUT_RADIUS = 54;
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS; // ~339.29

  const donutSegments = useMemo(() => {
    if (!catReport || catReport.categories.length === 0 || totalExpense <= 0) {
      return [];
    }
    let accumulatedOffset = 0;
    return catReport.categories.map((cat, idx) => {
      const share = cat.total_expense / totalExpense;
      const strokeDash = share * DONUT_CIRCUMFERENCE;
      const strokeOffset = accumulatedOffset;
      accumulatedOffset += strokeDash;
      return {
        category: cat,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        strokeDash,
        strokeOffset,
      };
    });
  }, [catReport, totalExpense, DONUT_CIRCUMFERENCE]);

  // ─── Tính toán cho Biểu đồ cột Thu - Chi - Tích lũy (Bar Chart) ─────────────
  const maxBarValue = Math.max(totalIncome, totalExpense, Math.abs(balance), 1);
  const chartHeight = 160;
  const getBarHeight = (val: number) => {
    const ratio = Math.min(Math.max(val / maxBarValue, 0), 1);
    return Math.max(ratio * chartHeight, 6); // tối thiểu 6px để thanh hiển thị rõ
  };

  return (
    <div className="space-y-6">
      {/* Header & Bộ lọc thời gian */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">analytics</span>
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {t("reports.title", "Báo Cáo & Phân Tích Tài Chính")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("reports.subtitle", "Theo dõi trực quan cơ cấu thu chi, tỷ lệ tiết kiệm và biểu đồ tăng trưởng.")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={reportPeriod}
            onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="day">{t("reports.period_day", "Theo ngày (Hôm nay)")}</option>
            <option value="week">{t("reports.period_this_week", "Theo tuần này")}</option>
            <option value="month">{t("reports.period_this_month", "Theo tháng này")}</option>
            <option value="quarter">{t("reports.period_quarter", "Theo quý này")}</option>
            <option value="year">{t("reports.period_this_year", "Theo năm nay")}</option>
            <option value="custom">{t("reports.period_custom", "Tùy chọn khoảng ngày")}</option>
          </select>

          {reportPeriod === "custom" && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 shadow-2xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-transparent focus:outline-none text-xs cursor-pointer text-slate-800 dark:text-slate-100"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-transparent focus:outline-none text-xs cursor-pointer text-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          <button
            type="button"
            onClick={fetchData}
            title={t("action.refresh", "Làm mới dữ liệu")}
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || !summary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>{t("reports.export_csv", "Xuất CSV")}</span>
          </button>
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="font-semibold underline hover:text-rose-900 dark:hover:text-rose-200 cursor-pointer"
          >
            {t("categories.retry", "Thử lại")}
          </button>
        </div>
      )}

      {/* 3 Metric Cards (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Thu nhập */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("reports.total_income", "Tổng Thu Nhập")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </div>
          </div>
          <span className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-2 block">
            {loading ? "..." : `${fmt(totalIncome)} đ`}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {t("reports.income_generated", "Đã phát sinh")}{" "}
            {Math.max(0, txCount - (catReport?.categories.reduce((s, c) => s + (c.transaction_count || 0), 0) ?? 0))}{" "}
            {t("reports.income_unit", "khoản thu")}
          </span>
        </div>

        {/* Chi tiêu */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("reports.total_expense", "Tổng Chi Tiêu")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
            </div>
          </div>
          <span className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-2 block">
            {loading ? "..." : `${fmt(totalExpense)} đ`}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {t("reports.income_generated", "Đã phát sinh")}{" "}
            {catReport?.categories.reduce((s, c) => s + (c.transaction_count || 0), 0) ?? 0}{" "}
            {t("reports.expense_unit", "khoản chi")}
          </span>
        </div>

        {/* Số dư / Tỷ lệ tiết kiệm */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("reports.net_savings", "Tích Lũy / Tiết Kiệm Ròng")}
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                balance >= 0
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
          </div>
          <span
            className={`font-display text-2xl font-bold mt-2 block ${
              balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {loading ? "..." : `${balance > 0 ? "+" : ""}${fmt(balance)} đ`}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                savingsRate >= 20
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : savingsRate > 0
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {t("reports.savings_rate_label", "Tỷ lệ tiết kiệm:")} {savingsRate}%
            </span>
          </div>
        </div>
      </div>

      {/* ─── KHU VỰC BIỂU ĐỒ TRỰC QUAN (VISUAL CHARTS) ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu đồ 1: So sánh Dòng tiền Thu - Chi - Tích lũy (Bar Chart) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[20px]">bar_chart</span>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {t("reports.income_expense_comparison", "Đối Chiếu Thu Nhập & Chi Phí")}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {t("reports.correlation_ratio", "Tỷ lệ tương quan")}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              {t("reports.comparison_subtitle", "Biểu đồ trực quan so sánh dòng tiền vào, dòng tiền ra và khoản thặng dư trong kỳ.")}
            </p>
          </div>

          {totalIncome === 0 && totalExpense === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center text-slate-400">
              <span className="material-symbols-outlined text-3xl mb-1 text-slate-300 dark:text-slate-600">query_stats</span>
              <p className="text-xs">{t("dashboard.no_transactions", "Chưa có dữ liệu phát sinh trong kỳ")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SVG Bar Visualization with Clear Data Labels */}
              <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
                <div className="h-48 flex items-end justify-around gap-4 pt-6 border-b border-slate-200/60 dark:border-slate-700 pb-1">
                  {/* Cột 1: Thu nhập */}
                  <div className="flex-1 max-w-[95px] flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shadow-2xs whitespace-nowrap">
                      +{fmt(totalIncome)} đ
                    </span>
                    <div
                      style={{ height: `${getBarHeight(totalIncome)}px` }}
                      className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-xl shadow-xs transition-all duration-300 group-hover:brightness-105 origin-bottom"
                    />
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{t("reports.income_bar", "Thu nhập")}</span>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold -mt-1">{lang === 'en' ? "100% inflow" : "100% dòng vào"}</span>
                  </div>

                  {/* Cột 2: Chi tiêu */}
                  <div className="flex-1 max-w-[95px] flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 shadow-2xs whitespace-nowrap">
                      -{fmt(totalExpense)} đ
                    </span>
                    <div
                      style={{ height: `${getBarHeight(totalExpense)}px` }}
                      className="w-full bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-xl shadow-xs transition-all duration-300 group-hover:brightness-105 origin-bottom"
                    />
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{t("reports.expense_bar", "Chi tiêu")}</span>
                    <span className="text-[9px] text-rose-500 dark:text-rose-400 font-bold -mt-1">
                      {totalIncome > 0 ? `${Math.round((totalExpense / totalIncome) * 100)}% ${lang === 'en' ? "of income" : "thu"}` : "100%"}
                    </span>
                  </div>

                  {/* Cột 3: Số dư ròng */}
                  <div className="flex-1 max-w-[95px] flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs whitespace-nowrap ${
                        balance >= 0
                          ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800"
                          : "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      {balance >= 0 ? "+" : ""}{fmt(balance)} đ
                    </span>
                    <div
                      style={{ height: `${getBarHeight(Math.abs(balance))}px` }}
                      className={`w-full rounded-t-xl shadow-xs transition-all duration-300 group-hover:brightness-105 origin-bottom ${
                        balance >= 0
                          ? "bg-gradient-to-t from-blue-500 to-blue-400"
                          : "bg-gradient-to-t from-amber-500 to-amber-400"
                      }`}
                    />
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{t("reports.surplus_bar", "Thặng dư")}</span>
                    <span
                      className={`text-[9px] font-bold -mt-1 ${
                        savingsRate >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {lang === 'en' ? "Save" : "TK"}: {savingsRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Chi số so sánh nhanh */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t("reports.expense_income_ratio", "Tỷ lệ chi / thu nhập")}</span>
                  <span className="font-display text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t("reports.savings_efficiency", "Hiệu suất tiết kiệm")}</span>
                  <span className={`font-display text-sm font-bold mt-0.5 block ${savingsRate >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                    {savingsRate}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Biểu đồ 2: Cơ cấu chi tiêu theo Danh mục (Donut Chart) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">pie_chart</span>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {t("reports.category_breakdown", "Cơ Cấu Chi Tiêu (Donut Chart)")}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {catReport?.categories.length ?? 0} {t("dashboard.categories_count", "danh mục")}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t("reports.comparison_subtitle", "Biểu đồ trực quan phân bổ % chi tiêu giữa các danh mục thực tế.")}
            </p>
          </div>

          {!catReport || catReport.categories.length === 0 || totalExpense <= 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center text-slate-400">
              <div className="w-24 h-24 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-2xl">donut_large</span>
              </div>
              <p className="text-xs">{t("reports.no_category_expenses", "Chưa có chi tiêu nào được phân loại")}</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
              {/* Donut SVG */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 140 140">
                  {/* Vòng nền */}
                  <circle
                    cx="70"
                    cy="70"
                    r={DONUT_RADIUS}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="16"
                    className="dark:stroke-slate-800"
                  />
                  {/* Các phân đoạn màu danh mục */}
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.category.category_id}
                      cx="70"
                      cy="70"
                      r={DONUT_RADIUS}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={hoveredCategory?.category_id === seg.category.category_id ? "19" : "16"}
                      strokeDasharray={`${seg.strokeDash} ${DONUT_CIRCUMFERENCE - seg.strokeDash}`}
                      strokeDashoffset={-seg.strokeOffset}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredCategory(seg.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  ))}
                </svg>

                {/* Tâm biểu đồ Donut */}
                <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none px-2">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate max-w-[100px]">
                    {hoveredCategory ? hoveredCategory.category_name : t("dashboard.total_cat_expense", "Tổng chi")}
                  </span>
                  <span className="font-display text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {fmt(hoveredCategory ? hoveredCategory.total_expense : totalExpense)} đ
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {hoveredCategory
                      ? `${hoveredCategory.percentage}%`
                      : `${catReport.categories.reduce((s, c) => s + (c.transaction_count || 0), 0)} ${t("dashboard.transaction", "giao dịch")}`}
                  </span>
                </div>
              </div>

              {/* Chú thích Top danh mục (Legend) kèm số tiền cụ thể */}
              <div className="w-full sm:w-auto flex-1 space-y-2 max-h-56 overflow-y-auto pr-1">
                {catReport.categories.map((cat, idx) => {
                  const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                  const isHovered = hoveredCategory?.category_id === cat.category_id;
                  return (
                    <div
                      key={cat.category_id}
                      onMouseEnter={() => setHoveredCategory(cat)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`flex items-center justify-between gap-3 text-xs p-2 rounded-xl transition-all cursor-pointer ${
                        isHovered ? "bg-slate-100/90 dark:bg-slate-800 scale-[1.01] shadow-2xs" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-md shrink-0 shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {cat.category_name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {cat.transaction_count} {t("dashboard.transaction", "giao dịch")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {fmt(cat.total_expense)} đ
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── DANH SÁCH CHI TIẾT TỪNG DANH MỤC (BREAKDOWN LIST) ────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[20px]">list_alt</span>
              {t("reports.breakdown_table_title", "Bảng Phân Bổ Chi Phí Chi Tiết")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t("reports.breakdown_table_desc", "Chi tiết số tiền, tỷ trọng và tần suất giao dịch của từng danh mục.")}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">{lang === 'en' ? "Total recorded expenses" : "Tổng chi tiêu ghi nhận"}</span>
            <span className="font-display text-base font-bold text-slate-900 dark:text-white">
              {fmt(totalExpense)} đ
            </span>
          </div>
        </div>

        {/* Thanh Visual Progress phân bổ toàn diện */}
        {catReport && catReport.categories.length > 0 && totalExpense > 0 && (
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              {catReport.categories.map((cat, idx) => (
                <div
                  key={cat.category_id}
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                  }}
                  title={`${cat.category_name}: ${fmt(cat.total_expense)} đ (${cat.percentage}%)`}
                  className="h-full transition-all duration-500 hover:opacity-85"
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {catReport.categories.slice(0, 5).map((cat, idx) => (
                <div key={cat.category_id} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="font-medium">{cat.category_name}</span>
                  <span className="text-slate-400">({cat.percentage}%)</span>
                </div>
              ))}
              {catReport.categories.length > 5 && (
                <span className="text-xs text-slate-400 font-medium">
                  +{catReport.categories.length - 5} {lang === 'en' ? "other categories" : "danh mục khác"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Danh sách từng Category */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <span className="material-symbols-outlined animate-spin text-3xl mb-2">progress_activity</span>
            <p>{t("categories.loading", "Đang tổng hợp dữ liệu báo cáo...")}</p>
          </div>
        ) : !catReport || catReport.categories.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-2xs">
              <span className="material-symbols-outlined text-[24px]">receipt_long</span>
            </div>
            <h4 className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              {t("reports.no_expenses_period", "Không có khoản chi tiêu nào trong kỳ")}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {lang === 'en' ? `No expense transactions recorded from ${activeRange.from} to ${activeRange.to}.` : `Chưa có giao dịch chi tiêu nào được ghi nhận từ ${activeRange.from} đến ${activeRange.to}.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {catReport.categories.map((cat, idx) => {
              const barColor = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              return (
                <div
                  key={cat.category_id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: barColor }}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {cat.icon || cat.category_icon || "category"}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-slate-900 dark:text-white">
                          {cat.category_name}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                          {cat.transaction_count} {t("dashboard.transaction", "giao dịch")}
                        </span>
                      </div>
                      <div className="w-32 sm:w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(cat.percentage, 100)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {fmt(cat.total_expense)} đ
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {cat.percentage}% {lang === 'en' ? "total expense" : "tổng chi"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── ĐỐI CHIẾU TIẾN ĐỘ NGÂN SÁCH (BUDGET TRACKING) ───────────────────── */}
      {budgetReport && budgetReport.budgets.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[20px]">account_balance</span>
                {t("reports.budget_tracking_title", "Tình Hình Thực Hiện Ngân Sách Trong Kỳ")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("reports.budget_tracking_desc", "Đối chiếu hạn mức ngân sách đã đặt so với số tiền chi tiêu thực tế.")}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
              {budgetReport.budgets.length} {lang === 'en' ? "budgets" : "ngân sách"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetReport.budgets.map((b) => {
              const isExceeded = b.usage_percent > 100;
              const isWarning = b.usage_percent >= 80 && !isExceeded;
              const statusColor = isExceeded
                ? "bg-rose-500 text-white"
                : isWarning
                ? "bg-amber-500 text-white"
                : "bg-emerald-500 text-white";

              return (
                <div
                  key={b.budget_id}
                  className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700 rounded-2xl p-4.5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs">
                        <span className="material-symbols-outlined text-[18px]">
                          {b.category_icon || "account_balance_wallet"}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {b.category_name || (lang === 'en' ? "All Categories" : "Tất cả danh mục")}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {b.start_date} → {b.end_date}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isExceeded
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : isWarning
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {isExceeded ? t("budgets.exceeded", "Vượt") : isWarning ? t("budgets.warning", "Cảnh báo") : t("budgets.safe", "An toàn")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("budgets.spent_amount", "Đã chi:")} <strong className="text-slate-900 dark:text-white">{fmt(b.spent_amount)} đ</strong>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("budgets.limit_set", "Hạn mức:")} <strong className="text-slate-900 dark:text-white">{fmt(b.budget_amount)} đ</strong>
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-200/70 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
                        style={{ width: `${Math.min(b.usage_percent, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {lang === 'en' ? "Used:" : "Đã dùng:"} {b.usage_percent}%
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("budgets.remaining_label", "Còn lại:")} <strong className={b.remaining_amount === 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>{fmt(b.remaining_amount)} đ</strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
