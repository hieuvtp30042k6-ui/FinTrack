import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  TransactionModel,
  WalletModel,
  CategoryModel,
  getTransactionsApi,
  createTransactionApi,
  updateTransactionApi,
  deleteTransactionApi,
  getWalletsApi,
  getCategoriesApi,
} from "../../services/api";
import { PeriodType, getPresetDateRange } from "../../utils/dateRange";
import { Pagination } from "../../components/Pagination";
import {
  detectCategoryFromNote,
  MatchResult,
} from "../../utils/autoCategorization";
import { SmartRulesModal } from "../../components/SmartRulesModal";
import { ReceiptScanModal } from "../../components/ReceiptScanModal";
import { formatMoney, convertToVnd } from "../../utils/currency";
import { useTranslation } from "../../utils/i18n";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);

const TYPE_LABEL: Record<string, string> = {
  INCOME: "Thu nhập",
  EXPENSE: "Chi tiêu",
  TRANSFER: "Chuyển tiền",
  ADJUSTMENT: "Điều chỉnh số dư",
};

// ─── Modal: Thêm / Sửa giao dịch ─────────────────────────────────────────────

interface TransactionModalProps {
  tx?: TransactionModel | null;
  wallets: WalletModel[];
  categories: CategoryModel[];
  defaultType?: "income" | "expense";
  initialData?: {
    amount?: number;
    description?: string;
    date?: string;
    categoryId?: number;
  } | null;
  onClose: () => void;
  onSaved: () => void;
  onOpenOcrScanner?: () => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({
  tx,
  wallets,
  categories,
  defaultType = "expense",
  initialData = null,
  onClose,
  onSaved,
  onOpenOcrScanner,
}) => {
  const { t } = useTranslation();
  const isEdit = !!tx;
  const [type, setType] = useState<"income" | "expense">(
    isEdit ? (tx!.type === "INCOME" ? "income" : "expense") : defaultType
  );
  const [walletId, setWalletId] = useState<string>(isEdit ? String(tx!.wallet_id) : (wallets[0]?.id ? String(wallets[0].id) : ""));
  const [categoryId, setCategoryId] = useState<string>(
    isEdit
      ? String(tx!.category_id)
      : initialData?.categoryId
      ? String(initialData.categoryId)
      : ""
  );
  const [amount, setAmount] = useState<string>(
    isEdit
      ? String(tx!.amount)
      : initialData?.amount
      ? String(initialData.amount)
      : ""
  );
  const [description, setDescription] = useState<string>(
    isEdit
      ? (tx!.description ?? "")
      : (initialData?.description ?? "")
  );
  const [txDate, setTxDate] = useState<string>(
    isEdit
      ? tx!.transaction_date
      : initialData?.date || today()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Smart Auto-Categorization State
  const [matchedSuggestion, setMatchedSuggestion] = useState<MatchResult | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);
  const [showRulesSubModal, setShowRulesSubModal] = useState(false);

  const filteredCats = categories.filter(c => c.type === type.toUpperCase());

  // Xử lý đổi type giao dịch
  const handleTypeToggle = (newType: "income" | "expense") => {
    setType(newType);
    if (!isEdit) {
      setCategoryId("");
      setAutoApplied(false);
      if (description.trim()) {
        const match = detectCategoryFromNote(description, categories, newType);
        setMatchedSuggestion(match);
        if (match) {
          setCategoryId(String(match.category.id));
          setAutoApplied(true);
        }
      } else {
        setMatchedSuggestion(null);
      }
    }
  };

  // Xử lý khi người dùng nhập ghi chú (tự động nhận diện danh mục)
  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    const match = detectCategoryFromNote(val, categories, type);
    setMatchedSuggestion(match);

    if (match) {
      if (!categoryId || autoApplied) {
        setCategoryId(String(match.category.id));
        setAutoApplied(true);
      }
    } else if (autoApplied) {
      setAutoApplied(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!walletId) { setError("Vui lòng chọn ví."); return; }
    if (!categoryId) { setError("Vui lòng chọn danh mục."); return; }
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) { setError("Số tiền phải lớn hơn 0."); return; }
    if (!txDate) { setError("Vui lòng nhập ngày giao dịch."); return; }

    setLoading(true);
    try {
      if (isEdit) {
        await updateTransactionApi(tx!.id, {
          wallet_id: Number(walletId),
          category_id: Number(categoryId),
          type,
          amount: amountNum,
          description: description.trim() || undefined,
          transaction_date: txDate,
        });
      } else {
        await createTransactionApi({
          wallet_id: Number(walletId),
          category_id: Number(categoryId),
          type,
          amount: amountNum,
          description: description.trim() || undefined,
          transaction_date: txDate,
        });
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
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
            <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">
              {isEdit ? t("expenses.modal_edit_title", "Chỉnh sửa giao dịch") : t("expenses.modal_new_title", "Ghi chép giao dịch mới")}
            </h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </div>
            )}

            {/* Type toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t("expenses.modal_type_label", "Loại giao dịch")}
              </label>
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold w-full">
                <button
                  type="button"
                  onClick={() => handleTypeToggle("expense")}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${type === "expense" ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                >
                  <span className="material-symbols-outlined text-[14px] align-middle mr-1">arrow_upward</span>
                  {t("expenses.expense", "Chi tiêu")}
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeToggle("income")}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${type === "income" ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                >
                  <span className="material-symbols-outlined text-[14px] align-middle mr-1">arrow_downward</span>
                  {t("expenses.income", "Thu nhập")}
                </button>
              </div>
            </div>

            {/* Amount */}
            {(() => {
              const activeWallet = wallets.find(w => String(w.id) === walletId);
              const activeCurrency = activeWallet?.currency || "VND";
              const amountNum = parseFloat(amount);
              const hasConverted = activeCurrency !== "VND" && !isNaN(amountNum) && amountNum > 0;

              return (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t("expenses.modal_amount", "Số tiền")} ({activeCurrency}) <span className="text-rose-500">*</span>
                    </label>
                    {hasConverted && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 font-medium">
                        ≈ {formatMoney(convertToVnd(amountNum, activeCurrency), "VND")}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min="0.01"
                      step={activeCurrency === "VND" || activeCurrency === "JPY" ? "1" : "0.01"}
                      placeholder={t("expenses.modal_amount_placeholder", "Nhập số tiền...")}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-14 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 pointer-events-none">
                      {activeCurrency}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("expenses.modal_note_label", "Ghi chú & Từ khóa gợi ý")}
                </label>
                <div className="flex items-center gap-2">
                  {onOpenOcrScanner && (
                    <button
                      type="button"
                      onClick={onOpenOcrScanner}
                      className="text-[11px] text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-lg border border-cyan-200 dark:border-cyan-800"
                      title="Quét ảnh hóa đơn để tự điền số tiền và ghi chú"
                    >
                      <span className="material-symbols-outlined text-[13px] text-cyan-600 dark:text-cyan-400">document_scanner</span>
                      <span>{t("expenses.modal_scan_receipt", "Quét hóa đơn")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowRulesSubModal(true)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                    <span>{t("expenses.modal_rules_btn", "Quy tắc")}</span>
                  </button>
                </div>
              </div>
              <textarea
                value={description}
                onChange={e => handleDescriptionChange(e.target.value)}
                rows={2}
                maxLength={255}
                placeholder={t("expenses.modal_note_placeholder", "Ví dụ: Đi Grab, cà phê Highlands, Shopee, Cơm trưa...")}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 resize-none transition-all"
              />

              {/* Thông báo Tự động gán danh mục thông minh */}
              {matchedSuggestion && autoApplied && (
                <div className="mt-2 flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/90 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[18px] shrink-0">
                      auto_awesome
                    </span>
                    <span className="truncate">
                      {t("expenses.modal_auto_detected", "✨ Tự động nhận diện")} <strong>{matchedSuggestion.category.name}</strong> (<em>"{matchedSuggestion.matchedKeyword}"</em>)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryId("");
                      setAutoApplied(false);
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 underline cursor-pointer ml-2 shrink-0"
                  >
                    {t("action.cancel", "Hủy")}
                  </button>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("expenses.modal_category", "Danh mục")} <span className="text-rose-500">*</span>
                </label>
              </div>
              {filteredCats.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
                  Không có danh mục phù hợp. Hãy tạo danh mục trước.
                </p>
              ) : (
                <select
                  value={categoryId}
                  onChange={e => {
                    setCategoryId(e.target.value);
                    setAutoApplied(false);
                  }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 cursor-pointer transition-all ${
                    autoApplied ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/20" : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <option value="">{t("expenses.modal_category_placeholder", "-- Chọn danh mục --")}</option>
                  {filteredCats.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Wallet */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t("expenses.modal_wallet", "Ví thanh toán")} <span className="text-rose-500">*</span>
              </label>
              {wallets.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
                  Bạn chưa có ví nào. Hãy tạo ví trước khi ghi giao dịch.
                </p>
              ) : (
                <select
                  value={walletId}
                  onChange={e => setWalletId(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 cursor-pointer transition-all"
                >
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} — {formatMoney(w.balance, w.currency || "VND", true)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t("expenses.modal_date", "Ngày giao dịch")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={txDate}
                onChange={e => setTxDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 cursor-pointer transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all">
                {t("expenses.modal_cancel", "Huỷ")}
              </button>
              <button
                type="submit"
                disabled={loading || wallets.length === 0}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ${
                  type === "expense" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {isEdit ? t("expenses.modal_save_changes", "Lưu thay đổi") : t("expenses.modal_record_tx", "Ghi giao dịch")}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showRulesSubModal && (
        <SmartRulesModal
          categories={categories}
          onClose={() => setShowRulesSubModal(false)}
        />
      )}
    </>
  );
};

// ─── Modal: Xác nhận xóa giao dịch ───────────────────────────────────────────

interface DeleteTxModalProps {
  tx: TransactionModel;
  onClose: () => void;
  onDeleted: () => void;
}

const DeleteTxModal: React.FC<DeleteTxModalProps> = ({ tx, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await deleteTransactionApi(tx.id);
      onDeleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xoá thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-4">
          <span className="material-symbols-outlined text-[24px]">delete</span>
        </div>
        <h3 className="font-display font-bold text-slate-900 dark:text-white text-base text-center mb-1">
          {t("expenses.modal_delete_title", "Xoá giao dịch?")}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">
          {t("expenses.modal_delete_desc", "Số dư ví sẽ được hoàn lại. Thao tác không thể hoàn tác.")}
        </p>
        {error && <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 mb-3 text-center border border-rose-200 dark:border-rose-900">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all">
            {t("expenses.modal_cancel", "Huỷ")}
          </button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {t("expenses.modal_delete_confirm", "Xoá")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

interface ExpensesViewProps {
  initialCategoryId?: number | null;
  onClearInitialCategory?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  initialCategoryId,
  onClearInitialCategory,
}) => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [wallets, setWallets] = useState<WalletModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterType, setFilterType] = useState<"" | "income" | "expense" | "transfer" | "adjustment">("");
  const [filterWallet, setFilterWallet] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>(
    initialCategoryId ? String(initialCategoryId) : ""
  );
  const [filterPeriod, setFilterPeriod] = useState<"" | PeriodType>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    if (initialCategoryId !== undefined && initialCategoryId !== null) {
      setFilterCategory(String(initialCategoryId));
    }
  }, [initialCategoryId]);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState<TransactionModel | null>(null);
  const [deleteTx, setDeleteTx] = useState<TransactionModel | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [ocrPrefill, setOcrPrefill] = useState<{
    amount?: number;
    description?: string;
    date?: string;
    categoryId?: number;
  } | null>(null);

  const handleApplyReceiptData = (data: {
    amount: number;
    description: string;
    date: string;
    categoryId?: number;
  }) => {
    setOcrPrefill(data);
    setShowReceiptScanner(false);
    setShowAdd(true);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [txList, walletList, catList] = await Promise.all([
        getTransactionsApi({
          type: filterType || undefined,
          wallet_id: filterWallet ? Number(filterWallet) : undefined,
          category_id: filterCategory ? Number(filterCategory) : undefined,
          from_date: filterFrom || undefined,
          to_date: filterTo || undefined,
        }),
        getWalletsApi(),
        getCategoriesApi(),
      ]);
      setTransactions(txList);
      setWallets(walletList);
      setCategories(catList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterWallet, filterCategory, filterFrom, filterTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Client-side search filter
  const displayed = useMemo(() => {
    return transactions.filter(tx => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        tx.description?.toLowerCase().includes(q) ||
        tx.category_name?.toLowerCase().includes(q) ||
        tx.wallet_name?.toLowerCase().includes(q) ||
        String(tx.amount).includes(q)
      );
    });
  }, [transactions, search]);

  // Phân trang danh sách giao dịch
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Tự động về trang 1 khi thay đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterWallet, filterCategory, filterPeriod, filterFrom, filterTo, search]);

  // Cắt danh sách giao dịch hiển thị theo trang
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayed.slice(start, start + pageSize);
  }, [displayed, currentPage, pageSize]);

  // KPI
  const totalExpense = transactions
    .filter(tx => tx.type === "EXPENSE")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalIncome = transactions
    .filter(tx => tx.type === "INCOME")
    .reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="space-y-6">
      {/* Modals */}
      {showRulesModal && (
        <SmartRulesModal
          categories={categories}
          onClose={() => setShowRulesModal(false)}
        />
      )}
      {showReceiptScanner && (
        <ReceiptScanModal
          categories={categories}
          onClose={() => setShowReceiptScanner(false)}
          onApplyReceipt={handleApplyReceiptData}
        />
      )}
      {showAdd && (
        <TransactionModal
          wallets={wallets}
          categories={categories}
          defaultType={filterType === "income" ? "income" : "expense"}
          initialData={ocrPrefill}
          onOpenOcrScanner={() => {
            setShowAdd(false);
            setShowReceiptScanner(true);
          }}
          onClose={() => {
            setShowAdd(false);
            setOcrPrefill(null);
          }}
          onSaved={fetchAll}
        />
      )}
      {editTx && (
        <TransactionModal
          tx={editTx}
          wallets={wallets}
          categories={categories}
          onClose={() => setEditTx(null)}
          onSaved={fetchAll}
        />
      )}
      {deleteTx && (
        <DeleteTxModal
          tx={deleteTx}
          onClose={() => setDeleteTx(null)}
          onDeleted={fetchAll}
        />
      )}

      {/* Top action bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {t("expenses.title")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t("expenses.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Type toggle */}
            <div className="inline-flex flex-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              {(["", "expense", "income", "transfer", "adjustment"] as const).map((itemType) => (
                <button
                  key={itemType}
                  type="button"
                  onClick={() => setFilterType(itemType)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filterType === itemType
                      ? itemType === "expense"
                        ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                        : itemType === "income"
                        ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : itemType === "transfer"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                        : itemType === "adjustment"
                        ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {itemType === ""
                    ? t("expenses.all")
                    : itemType === "expense"
                    ? t("expenses.expense")
                    : itemType === "income"
                    ? t("expenses.income")
                    : itemType === "transfer"
                    ? t("expenses.transfer")
                    : t("expenses.adjustment")}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowReceiptScanner(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50/80 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-950/80 text-cyan-900 dark:text-cyan-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Chụp hoặc tải ảnh hóa đơn để tự động bóc tách số tiền, ngày và danh mục"
            >
              <span className="material-symbols-outlined text-[17px] text-cyan-700 dark:text-cyan-400">
                document_scanner
              </span>
              <span>{t("expenses.scan_receipt")}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Cấu hình quy tắc tự động nhận diện danh mục theo từ khóa ghi chú"
            >
              <span className="material-symbols-outlined text-[17px] text-indigo-600 dark:text-indigo-400">
                auto_awesome
              </span>
              <span>{t("expenses.smart_rules")}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t("expenses.add_transaction")}
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
          {/* Quick Period Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
                {t("action.filter")}:
              </span>
              {(
                [
                  { id: "", label: t("expenses.all") },
                  { id: "day", label: t("period.day") },
                  { id: "week", label: t("period.week") },
                  { id: "month", label: t("period.month") },
                  { id: "quarter", label: t("period.quarter") },
                  { id: "year", label: t("period.year") },
                  { id: "custom", label: t("action.apply", "Tùy chỉnh") },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setFilterPeriod(p.id);
                    if (p.id === "") {
                      setFilterFrom("");
                      setFilterTo("");
                    } else if (p.id !== "custom") {
                      const range = getPresetDateRange(p.id);
                      setFilterFrom(range.from);
                      setFilterTo(range.to);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    filterPeriod === p.id
                      ? "bg-slate-900 dark:bg-indigo-600 text-white shadow-2xs font-semibold"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date range picker if custom or active */}
            {(filterPeriod === "custom" || filterFrom || filterTo) && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => {
                    setFilterFrom(e.target.value);
                    setFilterPeriod("custom");
                  }}
                  className="bg-transparent focus:outline-none text-xs cursor-pointer text-slate-800 dark:text-slate-100"
                  title="From date"
                />
                <span className="text-slate-400">→</span>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => {
                    setFilterTo(e.target.value);
                    setFilterPeriod("custom");
                  }}
                  className="bg-transparent focus:outline-none text-xs cursor-pointer text-slate-800 dark:text-slate-100"
                  title="To date"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFilterPeriod("");
                    setFilterFrom("");
                    setFilterTo("");
                  }}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                  title="Clear date filter"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder={t("expenses.search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
            </div>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                if (!e.target.value && onClearInitialCategory) {
                  onClearInitialCategory();
                }
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 cursor-pointer max-w-[180px] truncate"
            >
              <option value="">{t("expenses.filter_category")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === "EXPENSE" ? "▼ " : "▲ "}
                  {c.name}
                </option>
              ))}
            </select>

            {/* Wallet filter */}
            <select
              value={filterWallet}
              onChange={(e) => setFilterWallet(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">{t("expenses.filter_wallet")}</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Category Filter Chip */}
          {filterCategory && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {t("action.filter")}:
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold">
                <span>
                  {categories.find((c) => String(c.id) === filterCategory)?.name || "Category"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory("");
                    if (onClearInitialCategory) onClearInitialCategory();
                  }}
                  className="hover:text-rose-600 cursor-pointer flex items-center"
                  title="Remove filter"
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {t("expenses.total_expense")}
          </span>
          <span className="font-display text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 block font-mono">
            {fmt(totalExpense)} đ
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {t("expenses.total_income")}
          </span>
          <span className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block font-mono">
            {fmt(totalIncome)} đ
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {t("expenses.net_flow")}
          </span>
          <span className={`font-display text-xl font-bold mt-1 block font-mono ${
            totalIncome - totalExpense >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}>
            {totalIncome - totalExpense >= 0 ? "+" : ""}{fmt(totalIncome - totalExpense)} đ
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl border border-rose-200">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Transaction list */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {t("expenses.title")}
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {loading ? "..." : `${displayed.length} ${t("expenses.table_description").toLowerCase()}`}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-36 h-3 rounded bg-slate-100" />
                  <div className="w-24 h-3 rounded bg-slate-100" />
                </div>
                <div className="w-20 h-5 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && displayed.length === 0 && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
              <span className="material-symbols-outlined text-[28px]">receipt_long</span>
            </div>
            <h4 className="font-display text-base font-bold text-slate-900 dark:text-white mb-1">
              {t("expenses.empty_title", "Chưa có giao dịch nào")}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
              {t("expenses.empty_desc", "Nhấn 'Ghi giao dịch' để thêm khoản chi hoặc thu nhập đầu tiên.")}
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t("expenses.empty_btn", "Thêm giao dịch ngay")}
            </button>
          </div>
        )}

        {/* Transaction rows */}
        {!loading && displayed.length > 0 && (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedTransactions.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.type === "INCOME"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                      : tx.type === "EXPENSE"
                      ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                      : tx.type === "TRANSFER"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                      : "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {tx.type === "INCOME"
                        ? "arrow_downward"
                        : tx.type === "EXPENSE"
                        ? "arrow_upward"
                        : tx.type === "TRANSFER"
                        ? "sync_alt"
                        : "balance"}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {tx.description || tx.category_name || TYPE_LABEL[tx.type] || t("dashboard.transaction", "Giao dịch")}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      {(tx.category_name || TYPE_LABEL[tx.type] || "")} · {tx.wallet_name} · {tx.transaction_date}
                    </p>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-bold shrink-0 font-mono ${
                    tx.type === "INCOME"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : tx.type === "EXPENSE"
                      ? "text-rose-600 dark:text-rose-400"
                      : tx.type === "TRANSFER"
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {tx.type === "INCOME"
                      ? "+"
                      : tx.type === "EXPENSE"
                      ? "-"
                      : tx.type === "TRANSFER"
                      ? "⇄ "
                      : "± "}
                    {fmt(tx.amount)} đ
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditTx(tx)}
                      title={t("action.edit", "Chỉnh sửa")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTx(tx)}
                      title={t("action.delete", "Xóa")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Phân trang danh sách giao dịch */}
            <Pagination
              currentPage={currentPage}
              totalItems={displayed.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20, 50]}
              itemName={t("expenses.unit_item", "giao dịch")}
            />
          </>
        )}
      </div>
    </div>
  );
};
