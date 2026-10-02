import React, { useState, useEffect, useCallback } from "react";
import {
  BudgetModel,
  CategoryModel,
  getBudgetsApi,
  createBudgetApi,
  updateBudgetApi,
  deleteBudgetApi,
  getCategoriesApi,
} from "../../services/api";
import { useTranslation } from "../../utils/i18n";

const fmt = (n: number) =>
  n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

// ─── Modal: Thêm / Sửa ngân sách ─────────────────────────────────────────────

interface BudgetModalProps {
  budget?: BudgetModel | null;
  defaultCategoryId?: number | null;
  categories: CategoryModel[];
  onClose: () => void;
  onSaved: () => void;
}

const BudgetModal: React.FC<BudgetModalProps> = ({
  budget,
  defaultCategoryId,
  categories,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const isEdit = !!budget;
  const [categoryId, setCategoryId] = useState<string>(
    budget?.category_id
      ? String(budget.category_id)
      : defaultCategoryId
      ? String(defaultCategoryId)
      : ""
  );
  const [amountStr, setAmountStr] = useState<string>(
    budget?.amount ? String(budget.amount) : ""
  );
  const [startDate, setStartDate] = useState<string>(
    budget?.start_date ?? ""
  );
  const [endDate, setEndDate] = useState<string>(
    budget?.end_date ?? ""
  );
  const [isCustomRange, setIsCustomRange] = useState<boolean>(
    !!(budget?.start_date && budget?.end_date)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const raw = amountStr.replace(/[^0-9.]/g, "");
    const val = parseFloat(raw);
    if (isNaN(val) || val <= 0) {
      setError("Hạn mức ngân sách phải lớn hơn 0 đ.");
      return;
    }

    if (isCustomRange) {
      if (!startDate || !endDate) {
        setError("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.");
        return;
      }
      if (startDate > endDate) {
        setError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isEdit) {
        await updateBudgetApi(budget!.id, {
          category_id: categoryId ? parseInt(categoryId, 10) : null,
          amount: val,
          start_date: isCustomRange ? startDate : undefined,
          end_date: isCustomRange ? endDate : undefined,
        });
      } else {
        const payload: {
          category_id?: number | null;
          amount: number;
          start_date?: string;
          end_date?: string;
          month?: number;
          year?: number;
        } = {
          category_id: categoryId ? parseInt(categoryId, 10) : null,
          amount: val,
        };

        if (isCustomRange) {
          payload.start_date = startDate;
          payload.end_date = endDate;
        } else {
          const now = new Date();
          payload.month = now.getMonth() + 1;
          payload.year = now.getFullYear();
        }

        await createBudgetApi(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">
                {isEdit ? "edit" : "savings"}
              </span>
            </div>
            <h3 className="font-display font-bold text-slate-900 text-base">
              {isEdit ? t("budgets.modal_title_edit", "Chỉnh sửa ngân sách") : t("budgets.modal_title_new", "Thiết lập ngân sách mới")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl border border-rose-200">
              <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Danh mục */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("budgets.modal_category", "Danh mục chi tiêu")}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all cursor-pointer"
            >
              <option value="">{t("budgets.all_categories_general", "Tất cả danh mục (Ngân sách chung)")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {t("budgets.modal_category_hint", "Chọn danh mục cụ thể hoặc để trống để quản lý tổng mức chi tiêu.")}
            </p>
          </div>

          {/* Hạn mức số tiền */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("budgets.modal_limit", "Hạn mức ngân sách (VNĐ)")} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={amountStr ? Number(amountStr.replace(/[^0-9]/g, "")).toLocaleString("vi-VN") : ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setAmountStr(val);
                }}
                placeholder={t("budgets.modal_limit_placeholder", "Ví dụ: 3.000.000")}
                className="w-full border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                đ
              </span>
            </div>
          </div>

          {/* Chu kỳ thời gian */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                {t("budgets.modal_period", "Chu kỳ áp dụng")}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomRange(!isCustomRange)}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
              >
                {isCustomRange ? t("budgets.modal_auto_month", "Dùng chu kỳ tháng này") : t("budgets.modal_custom_date", "Tùy chỉnh ngày")}
              </button>
            </div>

            {isCustomRange ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">{t("expenses.table_date", "Từ ngày")}</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">{t("expenses.table_date", "Đến ngày")}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-400">
                  calendar_today
                </span>
                <span>{t("budgets.modal_auto_month", "Tự động áp dụng cho Tháng hiện tại")}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              {t("action.cancel", "Hủy")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading && (
                <span className="material-symbols-outlined text-[14px] animate-spin">
                  progress_activity
                </span>
              )}
              <span>{isEdit ? t("action.save", "Cập nhật") : t("budgets.modal_save", "Lưu ngân sách")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Xác nhận xóa ngân sách ───────────────────────────────────────────

interface DeleteModalProps {
  budget: BudgetModel;
  onClose: () => void;
  onConfirmed: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  budget,
  onClose,
  onConfirmed,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await deleteBudgetApi(budget.id);
      onConfirmed();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể xóa ngân sách.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[22px]">delete</span>
        </div>
        <h3 className="font-display font-bold text-slate-900 text-base mb-1.5">
          Xóa ngân sách?
        </h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Bạn có chắc chắn muốn xóa ngân sách{" "}
          <strong className="text-slate-700">
            {budget.category_name || "Tất cả danh mục"}
          </strong>{" "}
          với định mức <strong>{fmt(budget.amount)} đ</strong>? Thao tác này không thể hoàn tác.
        </p>

        {error && (
          <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleDelete}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? "Đang xóa..." : "Xóa vĩnh viễn"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main View ───────────────────────────────────────────────────────────────

interface BudgetsViewProps {
  initialCategoryId?: number | null;
  onClearInitialCategory?: () => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  initialCategoryId,
  onClearInitialCategory,
}) => {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState<BudgetModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetModel | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<BudgetModel | null>(null);

  useEffect(() => {
    if (initialCategoryId) {
      setEditingBudget(null);
      setModalOpen(true);
    }
  }, [initialCategoryId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [budgetsRes, categoriesRes] = await Promise.all([
        getBudgetsApi(),
        getCategoriesApi("expense"),
      ]);
      setBudgets(budgetsRes);
      setCategories(categoriesRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu ngân sách.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ngân sách chung = hạn mức chi tiêu đặt ra cho toàn bộ tháng ("Tất cả danh mục")
  const generalBudget = budgets.find(
    (b) => !b.category_id || b.category_name === "Tất cả danh mục"
  );

  // Sắp xếp để Ngân sách chung luôn đứng đầu
  const sortedBudgets = [...budgets].sort((a, b) => {
    const aIsGeneral = !a.category_id || a.category_name === "Tất cả danh mục";
    const bIsGeneral = !b.category_id || b.category_name === "Tất cả danh mục";
    if (aIsGeneral && !bIsGeneral) return -1;
    if (!aIsGeneral && bIsGeneral) return 1;
    return 0;
  });

  // 3 KPI cards lấy từ ngân sách chung — đây chính là hạn mức tháng mà người dùng đặt ra
  const totalBudget = generalBudget?.amount || 0;
  const totalSpent = generalBudget?.spent || 0;
  const totalRemaining = generalBudget?.remaining || 0;
  const overallPercent = generalBudget?.percentage || 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            {t("budgets.title", "Quản Lý Ngân Sách Chi Tiêu")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t("budgets.subtitle", "Thiết lập định mức chi tiêu theo tháng để kiểm soát dòng tiền thông minh.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingBudget(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{t("budgets.add_btn", "Đặt ngân sách mới")}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="font-semibold underline hover:no-underline cursor-pointer"
          >
            {t("categories.retry", "Thử lại")}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-xs">
          <span className="material-symbols-outlined text-[32px] animate-spin text-slate-400 mb-2 block">
            progress_activity
          </span>
          {t("categories.loading", "Đang tải dữ liệu ngân sách...")}
        </div>
      ) : (
        <>
          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. TỔNG ĐỊNH MỨC */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-shadow cursor-default">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t("budgets.total_budget", "TỔNG ĐỊNH MỨC")}
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                  {fmt(totalBudget)}
                </span>
                <span className="text-sm font-bold text-slate-700">đ</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t("budgets.month_budget", "Hạn mức tháng")} {generalBudget?.start_date?.slice(0, 7) || "hiện tại"}
              </p>
            </div>

            {/* 2. ĐÃ CHI TIÊU */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-shadow cursor-default">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t("budgets.total_spent", "ĐÃ CHI TIÊU")}
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-2xl sm:text-3xl font-bold text-rose-600">
                  {fmt(totalSpent)}
                </span>
                <span className="text-sm font-bold text-rose-500">đ</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t("budgets.reached", "Đạt")} {overallPercent}% {t("budgets.percent_of_total", "tổng hạn mức")}
              </p>
            </div>

            {/* 3. CÒN LẠI KHẢ DỤNG */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-shadow cursor-default">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t("budgets.remaining_available", "CÒN LẠI KHẢ DỤNG")}
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-2xl sm:text-3xl font-bold text-emerald-600">
                  {fmt(totalRemaining)}
                </span>
                <span className="text-sm font-bold text-emerald-500">đ</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t("budgets.to_spend_in_cycle", "Để chi tiêu trong chu kỳ")}
              </p>
            </div>
          </div>

          {/* Grid of Budget Cards */}
          {sortedBudgets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                account_balance_wallet
              </span>
              <p className="text-sm font-semibold text-slate-700">Chưa có ngân sách nào được thiết lập</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Hãy bắt đầu bằng việc đặt định mức chi tiêu chung hoặc cho từng danh mục để kiểm soát tài chính.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingBudget(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Đặt ngân sách ngay</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedBudgets.map((item) => {
                const isGeneral = !item.category_id || item.category_name === "Tất cả danh mục";
                const percent = item.percentage;
                const remaining = item.remaining;
                const isExceeded = item.status === "exceeded" || percent > 100;
                const isWarning = item.status === "warning" || (percent >= 80 && percent <= 100);

                let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
                let badgeText = `${t("budgets.safe", "An toàn")} (${percent}%)`;
                let barColor = "bg-emerald-500";

                if (isExceeded) {
                  badgeClass = "bg-rose-50 text-rose-700 border-rose-200/60";
                  badgeText = `${t("budgets.exceeded", "Vượt")} ${percent}%`;
                  barColor = "bg-rose-500";
                } else if (isWarning) {
                  badgeClass = "bg-amber-50 text-amber-700 border-amber-200/60";
                  badgeText = `${t("budgets.warning", "Cảnh báo")} (${percent}%)`;
                  barColor = "bg-amber-500";
                }

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
                      isGeneral
                        ? "border-slate-300 ring-2 ring-slate-900/5 relative"
                        : "border-slate-200/80"
                    }`}
                  >
                    <div>
                      {/* Header thẻ */}
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                              isGeneral
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {isGeneral ? "account_balance_wallet" : item.icon || "payments"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 truncate">
                                {isGeneral ? t("budgets.all_categories_label", "Tất cả danh mục") : (item.category_name || item.category || "Danh mục")}
                              </span>
                              {isGeneral && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                  {t("budgets.general", "Chung")}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {item.start_date} → {item.end_date}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}`}
                        >
                          {badgeText}
                        </span>
                      </div>

                      {/* Nội dung ngân sách: Logic rõ ràng, cân đối, đúng chuẩn Fintech */}
                      <div className="my-3 space-y-2.5">
                        {/* Hàng chỉ số: Hạn mức đặt ra và Số tiền đã chi đối xứng nhau */}
                        <div className="flex items-baseline justify-between pt-1">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                              {t("budgets.limit_set", "Hạn mức đặt ra")}
                            </span>
                            <span className="font-display text-lg font-bold text-slate-900">
                              {fmt(item.amount)} <span className="text-xs font-semibold text-slate-500">đ</span>
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                              {t("budgets.spent_amount", "Đã chi")} ({percent}%)
                            </span>
                            <span className="font-display text-base font-bold text-rose-600">
                              {fmt(item.spent)} <span className="text-xs font-semibold text-rose-500">đ</span>
                            </span>
                          </div>
                        </div>

                        {/* Thanh tiến độ chi tiêu */}
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer thẻ */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">
                        {t("budgets.remaining_label", "Còn lại:")}{" "}
                        <strong
                          className={`font-bold ${
                            remaining === 0 && isExceeded
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {fmt(remaining)} đ
                        </strong>
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBudget(item);
                            setModalOpen(true);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Chỉnh sửa ngân sách"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBudget(item)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xóa ngân sách"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <BudgetModal
          budget={editingBudget}
          defaultCategoryId={editingBudget?.category_id || initialCategoryId}
          categories={categories}
          onClose={() => {
            setModalOpen(false);
            setEditingBudget(null);
            if (onClearInitialCategory) onClearInitialCategory();
          }}
          onSaved={fetchData}
        />
      )}

      {/* Delete Modal */}
      {deletingBudget && (
        <DeleteModal
          budget={deletingBudget}
          onClose={() => setDeletingBudget(null)}
          onConfirmed={fetchData}
        />
      )}
    </div>
  );
};
