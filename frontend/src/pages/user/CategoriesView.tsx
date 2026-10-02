import React, { useState, useEffect, useMemo } from "react";
import {
  CategoryModel,
  getCategoriesApi,
  createCategoryApi,
  deleteCategoryApi,
  getTransactionsApi,
  getBudgetsApi,
  TransactionModel,
  BudgetModel,
} from "../../services/api";
import { PeriodType, getPresetDateRange } from "../../utils/dateRange";
import { SmartRulesModal } from "../../components/SmartRulesModal";
import { useTranslation } from "../../utils/i18n";

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const AVAILABLE_ICONS = [
  { icon: "restaurant", labelVi: "Ăn uống", labelEn: "Dining" },
  { icon: "shopping_bag", labelVi: "Mua sắm", labelEn: "Shopping" },
  { icon: "directions_car", labelVi: "Di chuyển", labelEn: "Transport" },
  { icon: "receipt_long", labelVi: "Hóa đơn", labelEn: "Bills" },
  { icon: "home", labelVi: "Nhà ở", labelEn: "Housing" },
  { icon: "medical_services", labelVi: "Y tế", labelEn: "Health" },
  { icon: "sports_esports", labelVi: "Giải trí", labelEn: "Entertainment" },
  { icon: "payments", labelVi: "Lương", labelEn: "Salary" },
  { icon: "workspace_premium", labelVi: "Thưởng", labelEn: "Bonus" },
  { icon: "trending_up", labelVi: "Đầu tư", labelEn: "Investment" },
  { icon: "school", labelVi: "Giáo dục", labelEn: "Education" },
  { icon: "flight", labelVi: "Du lịch", labelEn: "Travel" },
  { icon: "fitness_center", labelVi: "Thể thao", labelEn: "Fitness" },
  { icon: "card_giftcard", labelVi: "Quà tặng", labelEn: "Gifts" },
  { icon: "savings", labelVi: "Tiết kiệm", labelEn: "Savings" },
];

interface CategoriesViewProps {
  onNavigateToExpenses?: (categoryId?: number) => void;
  onNavigateToBudgets?: (categoryId?: number) => void;
  onNavigateTab?: (tab: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  onNavigateToExpenses,
  onNavigateToBudgets,
  onNavigateTab,
}) => {
  const { t, lang } = useTranslation();
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [budgets, setBudgets] = useState<BudgetModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [period, setPeriod] = useState<"" | PeriodType>("month");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] = useState<CategoryModel | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalType, setModalType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [modalIcon, setModalIcon] = useState("restaurant");
  const [modalDesc, setModalDesc] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryModel | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!deleteLoading && categoryToDelete) {
          setCategoryToDelete(null);
        } else if (!modalLoading && isModalOpen) {
          setIsModalOpen(false);
        } else if (selectedCategoryForDetail) {
          setSelectedCategoryForDetail(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [categoryToDelete, isModalOpen, deleteLoading, modalLoading, selectedCategoryForDetail]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [catData, txData, budgetData] = await Promise.all([
        getCategoriesApi(),
        getTransactionsApi(),
        getBudgetsApi(),
      ]);
      setCategories(catData);
      setTransactions(txData);
      setBudgets(budgetData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu danh mục");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter transactions by selected period
  const filteredTransactions = useMemo(() => {
    if (!period) return transactions;
    const range = getPresetDateRange(period);
    if (!range.from && !range.to) return transactions;

    return transactions.filter((tx) => {
      if (range.from && tx.transaction_date < range.from) return false;
      if (range.to && tx.transaction_date > range.to) return false;
      return true;
    });
  }, [transactions, period]);

  // Category stats calculation
  const categoryStatsMap = useMemo(() => {
    const map: Record<
      number,
      {
        txCount: number;
        totalAmount: number;
        transactions: TransactionModel[];
      }
    > = {};

    categories.forEach((cat) => {
      map[cat.id] = { txCount: 0, totalAmount: 0, transactions: [] };
    });

    filteredTransactions.forEach((tx) => {
      if (tx.category_id && map[tx.category_id]) {
        map[tx.category_id].txCount += 1;
        map[tx.category_id].totalAmount += tx.amount;
        map[tx.category_id].transactions.push(tx);
      }
    });

    return map;
  }, [categories, filteredTransactions]);

  const periodTotalExpense = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const periodTotalIncome = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  // Filtered categories according to tab and search
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (filterType === "expense" && c.type !== "EXPENSE") return false;
      if (filterType === "income" && c.type !== "INCOME") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [categories, filterType, searchQuery]);

  const handleOpenCreateModal = () => {
    setModalName("");
    setModalType(filterType === "income" ? "INCOME" : "EXPENSE");
    setModalIcon(filterType === "income" ? "payments" : "restaurant");
    setModalDesc("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const trimmedName = modalName.trim();
    if (!trimmedName) {
      setModalError("Vui lòng nhập tên danh mục.");
      return;
    }

    setModalLoading(true);
    try {
      await createCategoryApi({
        name: trimmedName,
        type: modalType,
        icon: modalIcon,
        description: modalDesc.trim() || undefined,
      });

      setIsModalOpen(false);
      await fetchData();
      showToast(`Đã tạo danh mục "${trimmedName}" thành công!`, "success");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Tạo danh mục thất bại.");
    } finally {
      setModalLoading(false);
    }
  };

  const handlePromptDelete = (e: React.MouseEvent, cat: CategoryModel) => {
    e.stopPropagation();
    setCategoryToDelete(cat);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteCategoryApi(categoryToDelete.id);
      const targetName = categoryToDelete.name;
      setCategoryToDelete(null);
      if (selectedCategoryForDetail?.id === categoryToDelete.id) {
        setSelectedCategoryForDetail(null);
      }
      await fetchData();
      showToast(`Đã xóa danh mục "${targetName}" thành công.`, "success");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Xóa danh mục thất bại.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const getIconColor = (iconName?: string | null, type?: string) => {
    switch (iconName) {
      case "restaurant":
        return "bg-orange-50 text-orange-600 border-orange-200/80";
      case "shopping_bag":
        return "bg-pink-50 text-pink-600 border-pink-200/80";
      case "directions_car":
        return "bg-blue-50 text-blue-600 border-blue-200/80";
      case "receipt_long":
      case "receipt":
        return "bg-amber-50 text-amber-600 border-amber-200/80";
      case "home":
        return "bg-indigo-50 text-indigo-600 border-indigo-200/80";
      case "medical_services":
        return "bg-rose-50 text-rose-600 border-rose-200/80";
      case "sports_esports":
        return "bg-purple-50 text-purple-600 border-purple-200/80";
      case "payments":
        return "bg-emerald-50 text-emerald-600 border-emerald-200/80";
      case "workspace_premium":
      case "military_tech":
        return "bg-teal-50 text-teal-600 border-teal-200/80";
      case "trending_up":
      case "savings":
        return "bg-cyan-50 text-cyan-600 border-cyan-200/80";
      default:
        return type === "EXPENSE"
          ? "bg-rose-50 text-rose-600 border-rose-200/80"
          : "bg-emerald-50 text-emerald-600 border-emerald-200/80";
    }
  };

  const expenseCatCount = categories.filter((c) => c.type === "EXPENSE").length;
  const incomeCatCount = categories.filter((c) => c.type === "INCOME").length;

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-60 animate-in slide-in-from-top-4 fade-in duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl border text-xs font-semibold backdrop-blur-md ${
              toast.type === "success"
                ? "bg-emerald-900/90 text-white border-emerald-700/80 shadow-emerald-900/20"
                : "bg-rose-900/90 text-white border-rose-700/80 shadow-rose-900/20"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">
              {toast.type === "success" ? "check_circle" : "error"}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ─── STREAMLINED UNIFIED TOP BAR ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Title & Quick Stats Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-primary text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">category</span>
            </div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              {t("categories.title", "Danh Mục Thu Chi")}
            </h2>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              {categories.length} {t("categories.count_items", "mục")}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
              {expenseCatCount} {t("categories.expense_count", "Chi")}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              {incomeCatCount} {t("categories.income_count", "Thu")}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              {budgets.length}/{expenseCatCount} {t("categories.has_budget", "có ngân sách")}
            </span>
          </div>
        </div>

        {/* Filters, Search & Action Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative w-full sm:w-48">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("categories.search_placeholder", "Tìm danh mục...")}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-primary focus:bg-white dark:focus:bg-slate-800 transition-all"
            />
          </div>

          {/* Type Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            {(
              [
                { id: "all", label: t("categories.all", "Tất cả") },
                { id: "expense", label: t("categories.expense_count", "Chi") },
                { id: "income", label: t("categories.income_count", "Thu") },
              ] as const
            ).map((tItem) => (
              <button
                key={tItem.id}
                type="button"
                onClick={() => setFilterType(tItem.id)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterType === tItem.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tItem.label}
              </button>
            ))}
          </div>

          {/* Period Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            {(
              [
                { id: "month", label: t("categories.this_month", "Tháng này") },
                { id: "year", label: t("categories.this_year", "Năm nay") },
                { id: "", label: t("categories.all", "Tất cả") },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  period === p.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Smart Rules Button */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
            title={t("categories.smart_rules_desc", "Quản lý quy tắc tự động nhận diện danh mục theo từ khóa")}
          >
            <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">auto_awesome</span>
            <span>{t("categories.smart_rules", "Quy tắc tự động")}</span>
          </button>

          {/* Create Button */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>{t("categories.add_category", "Tạo danh mục")}</span>
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
          <span className="text-xs">{t("categories.loading", "Đang đồng bộ danh mục & giao dịch...")}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="underline font-semibold hover:text-rose-900 cursor-pointer"
          >
            {t("categories.retry", "Thử lại")}
          </button>
        </div>
      )}

      {/* ─── COMPACT, TIDY CATEGORY GRID ─────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredCategories.map((cat) => {
            const iconName = cat.icon || (cat.type === "EXPENSE" ? "shopping_bag" : "payments");
            const colorClass = getIconColor(cat.icon, cat.type);
            const stats = categoryStatsMap[cat.id] || { txCount: 0, totalAmount: 0, transactions: [] };
            const relatedBudget = budgets.find((b) => b.category_id === cat.id);

            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategoryForDetail(cat)}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group cursor-pointer relative"
              >
                {/* Top Row: Icon + Name + Badge */}
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${colorClass}`}
                  >
                    <span className="material-symbols-outlined text-[19px]">{iconName}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
                        {cat.name}
                      </h4>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border shrink-0 ${
                          cat.type === "EXPENSE"
                            ? "bg-rose-50 text-rose-700 border-rose-200/70"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                        }`}
                      >
                        {cat.type === "EXPENSE" ? t("categories.expense_count", "Chi") : t("categories.income_count", "Thu")}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {cat.description || (cat.is_system ? t("categories.default_desc", "Mặc định") : t("categories.custom_desc", "Tùy chỉnh"))}
                    </p>
                  </div>
                </div>

                {/* Middle: Micro Budget Bar if Expense */}
                {cat.type === "EXPENSE" && relatedBudget && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>{t("categories.budget_label", "Ngân sách:")} {fmt(relatedBudget.amount)} đ</span>
                      <span
                        className={`font-semibold ${
                          relatedBudget.percentage > 100
                            ? "text-rose-600"
                            : relatedBudget.percentage >= 80
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {relatedBudget.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          relatedBudget.percentage > 100
                            ? "bg-rose-500"
                            : relatedBudget.percentage >= 80
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, relatedBudget.percentage)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Row: Amount & Actions */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {stats.txCount} {t("categories.tx_unit", "GD")}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-bold text-xs ${
                        cat.type === "EXPENSE" ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {fmt(stats.totalAmount)} đ
                    </span>

                    {/* Quick Drill-down Action (Show on hover) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToExpenses?.(cat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-primary transition-opacity p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title={t("categories.open_in_expenses", "Mở trong Sổ giao dịch")}
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </button>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={(e) => handlePromptDelete(e, cat)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity p-0.5 rounded hover:bg-rose-50 cursor-pointer"
                      title={t("categories.delete_category", "Xóa danh mục")}
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── DETAIL MODAL (CLEAN & COMPLETE) ─────────────────────────────────── */}
      {selectedCategoryForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedCategoryForDetail(null);
            }
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getIconColor(
                    selectedCategoryForDetail.icon,
                    selectedCategoryForDetail.type
                  )}`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {selectedCategoryForDetail.icon ||
                      (selectedCategoryForDetail.type === "EXPENSE" ? "shopping_bag" : "payments")}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedCategoryForDetail.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        selectedCategoryForDetail.type === "EXPENSE"
                          ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40"
                          : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                      }`}
                    >
                      {selectedCategoryForDetail.type === "EXPENSE" ? t("categories.modal_expense", "Khoản chi") : t("categories.modal_income", "Khoản thu")}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedCategoryForDetail.description || t("categories.default_desc", "Mặc định")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCategoryForDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {(() => {
                const stats = categoryStatsMap[selectedCategoryForDetail.id] || {
                  txCount: 0,
                  totalAmount: 0,
                  transactions: [],
                };
                const totalBaseline =
                  selectedCategoryForDetail.type === "EXPENSE"
                    ? periodTotalExpense
                    : periodTotalIncome;
                const sharePercent =
                  totalBaseline > 0 ? Math.round((stats.totalAmount / totalBaseline) * 100) : 0;
                const avgAmount =
                  stats.txCount > 0 ? Math.round(stats.totalAmount / stats.txCount) : 0;

                const budget = budgets.find((b) => b.category_id === selectedCategoryForDetail.id);

                return (
                  <>
                    {/* Quick Stat Tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {t("categories.detail_total", "Tổng tiền")}
                        </span>
                        <span
                          className={`text-sm font-bold mt-0.5 block ${
                            selectedCategoryForDetail.type === "EXPENSE"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {fmt(stats.totalAmount)} đ
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {t("categories.detail_tx_count", "Số giao dịch")}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {stats.txCount} {t("categories.tx_unit", "GD")}
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {t("categories.detail_avg", "Trung bình / GD")}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {fmt(avgAmount)} đ
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {t("categories.detail_share", "Tỷ trọng")}
                        </span>
                        <span className="text-sm font-bold text-primary mt-0.5 block">
                          {sharePercent}%
                        </span>
                      </div>
                    </div>

                    {/* Budget Section */}
                    {selectedCategoryForDetail.type === "EXPENSE" && (
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-primary">
                              account_balance_wallet
                            </span>
                            {t("categories.linked_budget", "Ngân sách liên kết")}
                          </span>
                          {budget ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategoryForDetail(null);
                                onNavigateToBudgets?.(selectedCategoryForDetail.id);
                              }}
                              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                            >
                              {t("categories.edit_budget", "Chỉnh sửa →")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategoryForDetail(null);
                                onNavigateToBudgets?.(selectedCategoryForDetail.id);
                              }}
                              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                            >
                              {t("categories.set_budget", "+ Đặt hạn mức →")}
                            </button>
                          )}
                        </div>

                        {budget ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                              <span>{t("categories.budget_limit", "Hạn mức:")} {fmt(budget.amount)} đ</span>
                              <span>{t("categories.budget_spent", "Đã chi:")} {fmt(budget.spent)} đ</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {t("categories.budget_left", "Còn:")} {fmt(Math.max(0, budget.amount - budget.spent))} đ
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  budget.percentage > 100
                                    ? "bg-rose-500"
                                    : budget.percentage >= 80
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, budget.percentage)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t("categories.no_budget", "Chưa có hạn mức ngân sách được thiết lập cho danh mục này.")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Recent Transactions List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                          {t("categories.recent_transactions", "Giao dịch")} ({stats.transactions.length})
                        </h4>
                        {stats.transactions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryForDetail(null);
                              onNavigateToExpenses?.(selectedCategoryForDetail.id);
                            }}
                            className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <span>{t("categories.open_in_expenses", "Mở trong Sổ GD")}</span>
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </button>
                        )}
                      </div>

                      {stats.transactions.length === 0 ? (
                        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800 text-center text-slate-400 text-xs">
                          {t("categories.no_transactions_cat", "Chưa có giao dịch nào cho danh mục này trong khoảng thời gian đã chọn.")}
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                          {stats.transactions.slice(0, 8).map((tx) => (
                            <div
                              key={tx.id}
                              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">
                                  {tx.description || selectedCategoryForDetail.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {tx.transaction_date} · {tx.wallet_name || "Ví tiền"}
                                </p>
                              </div>
                              <span
                                className={`font-bold ${
                                  tx.type === "EXPENSE" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {tx.type === "EXPENSE" ? "-" : "+"}
                                {fmt(tx.amount)} đ
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const targetCat = selectedCategoryForDetail;
                  setSelectedCategoryForDetail(null);
                  handlePromptDelete({ stopPropagation: () => {} } as React.MouseEvent, targetCat);
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                <span>{t("categories.delete_category", "Xóa danh mục")}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryForDetail(null);
                    onNavigateTab?.("reports");
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all"
                >
                  {t("categories.reports_btn", "Báo cáo")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedCategoryForDetail.id;
                    setSelectedCategoryForDetail(null);
                    onNavigateToExpenses?.(id);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>{t("categories.open_expenses_full", "Mở Sổ Giao Dịch")}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE CATEGORY MODAL ───────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !modalLoading) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("categories.modal_create_title", "Tạo danh mục mới")}</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={modalLoading}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5">
              {modalError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {modalError}
                </div>
              )}

              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalType("EXPENSE")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    modalType === "EXPENSE"
                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 ring-2 ring-rose-200 dark:ring-rose-900/50"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
                  <span>{t("categories.modal_expense", "Khoản chi")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalType("INCOME")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    modalType === "INCOME"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-200 dark:ring-emerald-900/50"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                  <span>{t("categories.modal_income", "Khoản thu")}</span>
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("categories.modal_name", "Tên danh mục")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder={t("categories.modal_name_placeholder", "Ví dụ: Ăn uống, Mua sắm, Lương...")}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 dark:focus:border-primary transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("categories.modal_choose_icon", "Chọn biểu tượng")}
                </label>
                <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  {AVAILABLE_ICONS.map((item) => (
                    <button
                      key={item.icon}
                      type="button"
                      onClick={() => setModalIcon(item.icon)}
                      className={`p-1.5 rounded-lg flex flex-col items-center gap-0.5 text-center transition-all cursor-pointer ${
                        modalIcon === item.icon
                          ? "bg-slate-900 dark:bg-primary text-white shadow-xs"
                          : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                      <span className="text-[8px] truncate w-full">{lang === "en" ? item.labelEn : item.labelVi}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("categories.modal_desc", "Mô tả / Ghi chú")}{" "}
                  <span className="text-slate-400 font-normal">{t("categories.modal_optional", "(tùy chọn)")}</span>
                </label>
                <input
                  type="text"
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  placeholder={t("categories.modal_desc_placeholder", "Ví dụ: Chi tiêu hàng ngày...")}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 dark:focus:border-primary transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={modalLoading}
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t("action.cancel", "Hủy")}
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {modalLoading ? t("categories.modal_saving", "Đang lưu...") : t("categories.modal_save", "Lưu danh mục")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM MODAL ────────────────────────────────────────────── */}
      {categoryToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteLoading) {
              setCategoryToDelete(null);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-sm w-full p-5 text-center">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("categories.delete_title", "Xóa danh mục này?")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("categories.delete_confirm", "Bạn có chắc chắn muốn xóa")} &ldquo;{categoryToDelete.name}&rdquo;?
            </p>

            {categoryStatsMap[categoryToDelete.id]?.txCount > 0 && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-[11px] text-left">
                {t("categories.delete_warning", "Hệ thống sẽ chặn thao tác xóa nếu phát sinh giao dịch.")}
              </div>
            )}

            {deleteError && (
              <div className="mt-2.5 p-2 rounded-xl bg-rose-50 text-rose-700 text-xs">
                {deleteError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t("action.cancel", "Hủy")}
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="flex-1 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60"
              >
                {deleteLoading ? t("categories.delete_deleting", "Đang xóa...") : t("categories.delete_btn", "Xác nhận xóa")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Rules Modal */}
      {showRulesModal && (
        <SmartRulesModal
          categories={categories}
          onClose={() => setShowRulesModal(false)}
        />
      )}
    </div>
  );
};
