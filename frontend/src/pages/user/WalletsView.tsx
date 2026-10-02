import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  WalletModel,
  getWalletsApi,
  createWalletApi,
  updateWalletApi,
  deleteWalletApi,
  archiveWalletApi,
  unarchiveWalletApi,
  transferFundsApi,
  adjustBalanceApi,
  TransferRequestData,
  AdjustBalanceData,
} from "../../services/api";
import {
  CurrencyCode,
  convertToVnd,
  formatMoney,
  convertCurrency,
  DEFAULT_CURRENCIES,
} from "../../utils/currency";
import { CurrencyRatesModal } from "../../components/CurrencyRatesModal";
import { FamilyWalletModal } from "../../components/FamilyWalletModal";
import { usePrivacyMode, maskBalance, togglePrivacyMode } from "../../utils/privacyMode";
import { useTranslation } from "../../utils/i18n";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const WALLET_THEMES = [
  {
    gradient: "from-slate-900 via-slate-800 to-zinc-950",
    text: "text-white",
    subtext: "text-slate-300",
    border: "border-slate-800/80",
    badge: "bg-white/10 text-white border-white/20",
    icon: "account_balance_wallet",
  },
  {
    gradient: "from-indigo-700 via-indigo-800 to-blue-950",
    text: "text-white",
    subtext: "text-indigo-200",
    border: "border-indigo-700/80",
    badge: "bg-white/10 text-white border-white/20",
    icon: "account_balance",
  },
  {
    gradient: "from-emerald-700 via-teal-800 to-slate-950",
    text: "text-white",
    subtext: "text-emerald-200",
    border: "border-emerald-700/80",
    badge: "bg-white/10 text-white border-white/20",
    icon: "payments",
  },
  {
    gradient: "from-violet-700 via-purple-800 to-slate-950",
    text: "text-white",
    subtext: "text-purple-200",
    border: "border-violet-700/80",
    badge: "bg-white/10 text-white border-white/20",
    icon: "savings",
  },
  {
    gradient: "from-rose-700 via-rose-800 to-red-950",
    text: "text-white",
    subtext: "text-rose-200",
    border: "border-rose-700/80",
    badge: "bg-white/10 text-white border-white/20",
    icon: "credit_card",
  },
  {
    gradient: "from-cyan-700 via-blue-800 to-slate-950",
    text: "text-white",
    subtext: "text-cyan-200",
    border: "border-cyan-700/80",
    badge: "bg-white/10 text-white border-white/20",
    icon: "wallet",
  },
];

const CREDIT_THEME = {
  gradient: "from-amber-950 via-slate-900 to-neutral-950",
  text: "text-amber-100",
  subtext: "text-amber-300/80",
  border: "border-amber-500/30",
  badge: "bg-amber-400/20 text-amber-200 border-amber-400/40",
  icon: "credit_card",
};

const getWalletTheme = (wallet: WalletModel) => {
  if (wallet.wallet_type === "CREDIT") return CREDIT_THEME;
  return WALLET_THEMES[wallet.id % WALLET_THEMES.length];
};

// ─── Modal: Thêm / Sửa ví ────────────────────────────────────────────────────

interface WalletModalProps {
  wallet?: WalletModel | null;
  onClose: () => void;
  onSaved: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ wallet, onClose, onSaved }) => {
  const { t } = useTranslation();
  const isEdit = !!wallet;
  const [name, setName] = useState(wallet?.name ?? "");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState<string>(wallet?.currency || "VND");
  const [walletType, setWalletType] = useState<"STANDARD" | "CREDIT">(wallet?.wallet_type || "STANDARD");
  const [creditLimit, setCreditLimit] = useState(wallet?.credit_limit ? String(wallet.credit_limit) : "");
  const [statementDay, setStatementDay] = useState(wallet?.statement_day ? String(wallet.statement_day) : "20");
  const [paymentDueDay, setPaymentDueDay] = useState(wallet?.payment_due_day ? String(wallet.payment_due_day) : "5");
  const [isExcluded, setIsExcluded] = useState<boolean>(wallet?.is_excluded_from_total ?? false);
  const [isArchived, setIsArchived] = useState<boolean>(wallet?.is_archived ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedCurrencyInfo =
    DEFAULT_CURRENCIES[(currency.toUpperCase() as CurrencyCode)] ||
    DEFAULT_CURRENCIES.VND;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) { setError("Tên ví không được để trống."); return; }

    setLoading(true);
    try {
      const parsedLimit = creditLimit ? parseFloat(creditLimit) : undefined;
      const parsedStatement = statementDay ? parseInt(statementDay, 10) : undefined;
      const parsedDue = paymentDueDay ? parseInt(paymentDueDay, 10) : undefined;

      if (isEdit) {
        await updateWalletApi(wallet!.id, {
          name: trimmed,
          currency,
          wallet_type: walletType,
          credit_limit: walletType === "CREDIT" ? parsedLimit : null,
          statement_day: walletType === "CREDIT" ? parsedStatement : null,
          payment_due_day: walletType === "CREDIT" ? parsedDue : null,
          is_excluded_from_total: isExcluded,
          is_archived: isArchived,
        });
      } else {
        const raw = balance.replace(/[^0-9.]/g, "");
        const bal = parseFloat(raw);
        if (balance !== "" && (isNaN(bal) || bal < 0)) {
          setError("Số dư ban đầu không hợp lệ. Vui lòng nhập số >= 0.");
          setLoading(false);
          return;
        }
        await createWalletApi({
          name: trimmed,
          balance: isNaN(bal) ? 0 : bal,
          currency,
          wallet_type: walletType,
          credit_limit: walletType === "CREDIT" ? parsedLimit : undefined,
          statement_day: walletType === "CREDIT" ? parsedStatement : undefined,
          payment_due_day: walletType === "CREDIT" ? parsedDue : undefined,
          is_excluded_from_total: isExcluded,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-slate-800 text-[22px]">
              {walletType === "CREDIT" ? "credit_card" : "account_balance_wallet"}
            </span>
            <h3 className="font-display font-bold text-slate-900 text-base">
              {isEdit ? t("action.edit", "Chỉnh sửa ví") : t("wallets.modal_title_new", "Thêm ví / Thẻ mới")}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 text-rose-700 text-xs px-3 py-2.5 rounded-xl border border-rose-200">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          {/* Loại ví Segmented Control */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t("wallets.modal_type", "Loại ví / tài khoản")}</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setWalletType("STANDARD")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  walletType === "STANDARD"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                {t("wallets.modal_type_standard", "Ví tiêu chuẩn")}
              </button>
              <button
                type="button"
                onClick={() => setWalletType("CREDIT")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  walletType === "CREDIT"
                    ? "bg-slate-900 text-amber-300 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">credit_card</span>
                {t("wallets.modal_type_credit", "Thẻ tín dụng")}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t("wallets.modal_name", "Tên ví / thẻ")} <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={walletType === "CREDIT" ? t("wallets.modal_name_credit_placeholder", "Ví dụ: Thẻ HSBC Visa Platinum, VPBank...") : t("wallets.modal_name_placeholder", "Ví dụ: Tiền mặt, Ngân hàng VCB, Ví USD...")}
              maxLength={100}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          {/* Đơn vị tiền tệ */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("wallets.modal_currency", "Đơn vị tiền tệ")} <span className="text-rose-500">*</span>
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white cursor-pointer transition-all font-medium"
            >
              <option value="VND">🇻🇳 VND — Việt Nam Đồng (đ)</option>
              <option value="USD">🇺🇸 USD — Đô la Mỹ ($)</option>
              <option value="EUR">🇪🇺 EUR — Đồng Euro (€)</option>
              <option value="JPY">🇯🇵 JPY — Yên Nhật (¥)</option>
              <option value="GBP">🇬🇧 GBP — Bảng Anh (£)</option>
            </select>
          </div>

          {/* Nếu là thẻ tín dụng: Hạn mức + Ngày sao kê + Ngày đến hạn */}
          {walletType === "CREDIT" && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">info</span>
                {t("wallets.modal_credit_config", "Cấu hình Thẻ Tín Dụng")}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t("wallets.modal_credit_limit", "Hạn mức tín dụng tối đa")} ({selectedCurrencyInfo.symbol})
                </label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                  placeholder="Ví dụ: 50000000"
                  min="0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t("wallets.modal_statement_day", "Ngày sao kê hàng tháng")}
                  </label>
                  <select
                    value={statementDay}
                    onChange={e => setStatementDay(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Ngày {d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t("wallets.modal_due_day", "Hạn thanh toán hàng tháng")}
                  </label>
                  <select
                    value={paymentDueDay}
                    onChange={e => setPaymentDueDay(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Ngày {d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {walletType === "CREDIT" ? t("wallets.modal_initial_balance", "Dư nợ ban đầu (nếu có)") : `${t("wallets.modal_initial_balance", "Số dư ban đầu")} (${selectedCurrencyInfo.symbol})`}
                <span className="ml-1 text-slate-400 font-normal">{t("wallets.modal_initial_balance_hint", "— để trống nếu bắt đầu từ 0")}</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  min="0"
                  step={selectedCurrencyInfo.decimals > 0 ? "0.01" : "1"}
                  placeholder={selectedCurrencyInfo.decimals > 0 ? "0.00" : "0"}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white transition-all font-semibold"
                />
                <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-500 pointer-events-none">
                  {selectedCurrencyInfo.code}
                </span>
              </div>
            </div>
          )}

          {/* Tuỳ chọn Loại trừ khỏi Tổng tài sản */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isExcluded}
                onChange={e => setIsExcluded(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 font-medium leading-relaxed">
                {t("wallets.modal_exclude_title", "Không tính vào tổng tài sản")}
                <span className="block text-[11px] text-slate-400 font-normal">
                  {t("wallets.modal_exclude_desc", "Phù hợp cho ví tiền giữ hộ người khác, quỹ lớp, tiền dự án không phải của bạn.")}
                </span>
              </span>
            </label>
          </div>

          {/* Lưu trữ ví khi Edit */}
          {isEdit && (
            <div className="pt-1 border-t border-slate-100">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isArchived}
                  onChange={e => setIsArchived(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium leading-relaxed">
                  Lưu trữ ví (ẩn khỏi danh sách sử dụng thông thường)
                  <span className="block text-[11px] text-slate-400 font-normal">
                    Giữ nguyên lịch sử giao dịch nhưng không hiển thị khi thêm giao dịch mới.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-all">
              {t("action.cancel", "Huỷ")}
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isEdit ? t("action.save", "Lưu thay đổi") : t("wallets.modal_create_btn", "Tạo ví")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Chuyển tiền giữa các ví (Transfer) ───────────────────────────────

interface TransferModalProps {
  wallets: WalletModel[];
  defaultFromWalletId?: number;
  onClose: () => void;
  onTransferred: () => void;
}

const TransferModal: React.FC<TransferModalProps> = ({
  wallets,
  defaultFromWalletId,
  onClose,
  onTransferred,
}) => {
  const activeWallets = wallets.filter(w => !w.is_archived);
  const [fromWalletId, setFromWalletId] = useState<number>(
    defaultFromWalletId || (activeWallets[0]?.id ?? 0)
  );
  const [toWalletId, setToWalletId] = useState<number>(
    activeWallets.find(w => w.id !== fromWalletId)?.id ?? 0
  );
  const [amount, setAmount] = useState<string>("");
  const [fee, setFee] = useState<string>("0");
  const [description, setDescription] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fromWallet = wallets.find(w => w.id === fromWalletId);
  const toWallet = wallets.find(w => w.id === toWalletId);

  const numAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const numFee = parseFloat(fee.replace(/[^0-9.]/g, "")) || 0;

  // Real-time conversion preview if currencies differ
  const convertedToAmount = useMemo(() => {
    if (!fromWallet || !toWallet || numAmount <= 0) return 0;
    const fromCurr = (fromWallet.currency || "VND") as CurrencyCode;
    const toCurr = (toWallet.currency || "VND") as CurrencyCode;
    return convertCurrency(numAmount, fromCurr, toCurr);
  }, [fromWallet, toWallet, numAmount]);

  const handleQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  const handleTransferAll = () => {
    if (fromWallet && fromWallet.balance > 0) {
      setAmount(String(fromWallet.balance));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fromWalletId || !toWalletId) {
      setError("Vui lòng chọn đầy đủ ví nguồn và ví đích.");
      return;
    }
    if (fromWalletId === toWalletId) {
      setError("Ví nguồn và ví đích không được trùng nhau.");
      return;
    }
    if (numAmount <= 0) {
      setError("Số tiền chuyển phải lớn hơn 0.");
      return;
    }

    if (fromWallet && fromWallet.wallet_type !== "CREDIT") {
      if (fromWallet.balance < numAmount + numFee) {
        setError(`Số dư ví nguồn không đủ (Hiện có ${formatMoney(fromWallet.balance, fromWallet.currency || "VND")}).`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload: TransferRequestData = {
        from_wallet_id: fromWalletId,
        to_wallet_id: toWalletId,
        amount: numAmount,
        fee: numFee > 0 ? numFee : undefined,
        transfer_date: transferDate,
        description: description.trim() || undefined,
      };

      await transferFundsApi(payload);
      onTransferred();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Chuyển tiền thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">sync_alt</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base">
                Chuyển tiền giữa các ví
              </h3>
              <p className="text-[11px] text-slate-500">
                Giao dịch chuyển nội bộ không tính vào thu nhập hay chi tiêu
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 text-rose-700 text-xs px-3 py-2.5 rounded-xl border border-rose-200">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          {/* Chọn Ví nguồn và Ví đích */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
            {/* Ví Nguồn */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Ví nguồn (Chuyển đi)
              </span>
              <select
                value={fromWalletId}
                onChange={e => {
                  const newFromId = Number(e.target.value);
                  setFromWalletId(newFromId);
                  if (newFromId === toWalletId) {
                    const alt = activeWallets.find(w => w.id !== newFromId);
                    if (alt) setToWalletId(alt.id);
                  }
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {activeWallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatMoney(w.balance, w.currency || "VND")})
                  </option>
                ))}
              </select>
              {fromWallet && (
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>Số dư hiện có:</span>
                  <span className="font-semibold text-slate-800">
                    {formatMoney(fromWallet.balance, fromWallet.currency || "VND")}
                  </span>
                </div>
              )}
            </div>

            {/* Ví Đích */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Ví đích (Nhận về)
              </span>
              <select
                value={toWalletId}
                onChange={e => setToWalletId(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {activeWallets
                  .filter(w => w.id !== fromWalletId)
                  .map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatMoney(w.balance, w.currency || "VND")})
                    </option>
                  ))}
              </select>
              {toWallet && (
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>Số dư hiện tại:</span>
                  <span className="font-semibold text-slate-800">
                    {formatMoney(toWallet.balance, toWallet.currency || "VND")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Số tiền chuyển */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Số tiền chuyển <span className="text-rose-500">*</span>
              </label>
              {fromWallet && fromWallet.balance > 0 && (
                <button
                  type="button"
                  onClick={handleTransferAll}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Chuyển tất cả ({formatMoney(fromWallet.balance, fromWallet.currency || "VND")})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="0"
                step="any"
                placeholder="Nhập số tiền..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-14 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50 focus:bg-white"
              />
              <span className="absolute right-3 top-3 text-xs font-bold text-slate-500">
                {fromWallet?.currency || "VND"}
              </span>
            </div>

            {/* Quick amount suggestions */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[50000, 100000, 200000, 500000, 1000000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer transition-all"
                >
                  +{fmt(val)}
                </button>
              ))}
            </div>

            {/* Live conversion info if different currency */}
            {fromWallet && toWallet && fromWallet.currency !== toWallet.currency && numAmount > 0 && (
              <div className="mt-2.5 p-2.5 bg-indigo-50/80 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs text-indigo-900">
                <span className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
                  Quy đổi sang ví đích:
                </span>
                <span className="font-bold">
                  ≈ {formatMoney(convertedToAmount, toWallet.currency || "VND")}
                </span>
              </div>
            )}
          </div>

          {/* Phí & Ngày chuyển */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phí chuyển khoản ({fromWallet?.currency || "VND"})
              </label>
              <input
                type="number"
                value={fee}
                onChange={e => setFee(e.target.value)}
                min="0"
                step="any"
                placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày thực hiện
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú chuyển tiền</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ví dụ: Rút tiền tiết kiệm, Nạp ví điện tử..."
              maxLength={255}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              Huỷ
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Xác nhận chuyển
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Điều chỉnh số dư (Balance Adjustment) ───────────────────────────

interface AdjustBalanceModalProps {
  wallet: WalletModel;
  onClose: () => void;
  onAdjusted: () => void;
}

const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({
  wallet,
  onClose,
  onAdjusted,
}) => {
  const [targetBalance, setTargetBalance] = useState<string>(String(wallet.balance));
  const [description, setDescription] = useState<string>("Kiểm kê số dư thực tế");
  const [adjustmentDate, setAdjustmentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const numTarget = parseFloat(targetBalance.replace(/[^0-9.-]/g, "")) || 0;
  const difference = numTarget - wallet.balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isNaN(numTarget)) {
      setError("Vui lòng nhập số dư thực tế hợp lệ.");
      return;
    }

    setLoading(true);
    try {
      const payload: AdjustBalanceData = {
        wallet_id: wallet.id,
        target_balance: numTarget,
        adjustment_date: adjustmentDate,
        description: description.trim() || undefined,
      };

      await adjustBalanceApi(payload);
      onAdjusted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Điều chỉnh số dư thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-800 text-[20px]">balance</span>
            <h3 className="font-display font-bold text-slate-900 text-base">
              Điều chỉnh số dư ví
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 text-rose-700 text-xs px-3 py-2.5 rounded-xl border border-rose-200">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          {/* Thông tin ví hiện tại */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 block">{wallet.name}</span>
              <span className="text-slate-400 text-[11px]">Số dư trên ứng dụng</span>
            </div>
            <span className="font-mono font-bold text-slate-700 text-sm">
              {formatMoney(wallet.balance, wallet.currency || "VND")}
            </span>
          </div>

          {/* Nhập số dư thực tế mới */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Số dư thực tế mới sau kiểm đếm ({wallet.currency || "VND"}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={targetBalance}
                onChange={e => setTargetBalance(e.target.value)}
                step="any"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-14 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white"
              />
              <span className="absolute right-3 top-3 text-xs font-bold text-slate-500">
                {wallet.currency || "VND"}
              </span>
            </div>
          </div>

          {/* Chênh lệch hiển thị thời gian thực */}
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between font-medium ${
            difference === 0
              ? "bg-slate-50 border-slate-200 text-slate-600"
              : difference > 0
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">
                {difference >= 0 ? "trending_up" : "trending_down"}
              </span>
              Độ lệch số dư:
            </span>
            <span className="font-mono font-bold">
              {difference >= 0 ? "+" : ""}
              {formatMoney(difference, wallet.currency || "VND")}
            </span>
          </div>

          {/* Lý do & Ngày */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Lý do điều chỉnh</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ví dụ: Đếm lại tiền lẻ, Sai sót giao dịch cũ..."
              maxLength={255}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày ghi nhận</label>
            <input
              type="date"
              value={adjustmentDate}
              onChange={e => setAdjustmentDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              Huỷ
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Cập nhật số dư
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Xác nhận xóa / Lưu trữ ───────────────────────────────────────────

interface DeleteModalProps {
  wallet: WalletModel;
  onClose: () => void;
  onDeleted: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ wallet, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await deleteWalletApi(wallet.id);
      onDeleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xóa ví thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mx-auto mb-4">
          <span className="material-symbols-outlined text-[24px]">delete</span>
        </div>
        <h3 className="font-display font-bold text-slate-900 text-base text-center mb-1">Xoá ví "{wallet.name}"?</h3>
        <p className="text-xs text-slate-500 text-center mb-4">
          Nếu ví đã có giao dịch phát sinh, hệ thống sẽ tự động chuyển sang trạng thái <strong>Lưu trữ (ẩn)</strong> để bảo toàn lịch sử dữ liệu của bạn.
        </p>
        {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 mb-3 text-center border border-rose-200">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-all">Huỷ</button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

type TabFilter = "ACTIVE" | "SHARED" | "CREDIT" | "EXCLUDED" | "ARCHIVED";

export const WalletsView: React.FC = () => {
  const { t } = useTranslation();
  const [wallets, setWallets] = useState<WalletModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [familyWallet, setFamilyWallet] = useState<WalletModel | null>(null);
  const [transferFromWalletId, setTransferFromWalletId] = useState<number | undefined>(undefined);
  const [editWallet, setEditWallet] = useState<WalletModel | null>(null);
  const [adjustWallet, setAdjustWallet] = useState<WalletModel | null>(null);
  const [deleteWallet, setDeleteWallet] = useState<WalletModel | null>(null);
  const [currentTab, setCurrentTab] = useState<TabFilter>("ACTIVE");
  const [isPrivate] = usePrivacyMode();

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getWalletsApi(true); // bao gồm cả ví lưu trữ
      setWallets(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách ví.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  // Phân loại ví
  const activeWallets = useMemo(() => wallets.filter(w => !w.is_archived), [wallets]);
  const archivedWallets = useMemo(() => wallets.filter(w => w.is_archived), [wallets]);
  const sharedWallets = useMemo(() => activeWallets.filter(w => w.is_shared), [activeWallets]);
  const creditWallets = useMemo(() => activeWallets.filter(w => w.wallet_type === "CREDIT"), [activeWallets]);
  const excludedWallets = useMemo(() => activeWallets.filter(w => w.is_excluded_from_total), [activeWallets]);

  // Tổng tài sản quy đổi về VND: CHỈ TÍNH CÁC VÍ KHÔNG LƯU TRỮ VÀ KHÔNG BỊ LOẠI TRỪ
  const totalBalanceInVnd = useMemo(() => {
    return activeWallets
      .filter(w => !w.is_excluded_from_total)
      .reduce((acc, w) => acc + convertToVnd(w.balance, w.currency || "VND"), 0);
  }, [activeWallets]);

  const foreignWallets = useMemo(() => {
    return activeWallets.filter(w => w.currency && w.currency.toUpperCase() !== "VND");
  }, [activeWallets]);

  // Danh sách hiển thị theo tab
  const displayedWallets = useMemo(() => {
    switch (currentTab) {
      case "ACTIVE":
        return activeWallets;
      case "SHARED":
        return sharedWallets;
      case "CREDIT":
        return creditWallets;
      case "EXCLUDED":
        return excludedWallets;
      case "ARCHIVED":
        return archivedWallets;
      default:
        return activeWallets;
    }
  }, [currentTab, activeWallets, sharedWallets, creditWallets, excludedWallets, archivedWallets]);

  const handleToggleArchive = async (wallet: WalletModel) => {
    try {
      if (wallet.is_archived) {
        await unarchiveWalletApi(wallet.id);
      } else {
        await archiveWalletApi(wallet.id);
      }
      fetchWallets();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Thao tác thất bại.");
    }
  };

  const handleOpenTransfer = (walletId?: number) => {
    setTransferFromWalletId(walletId);
    setShowTransferModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      {showRatesModal && (
        <CurrencyRatesModal
          onClose={() => setShowRatesModal(false)}
          onRatesUpdated={() => {
            setWallets(prev => [...prev]);
          }}
        />
      )}
      {showAdd && (
        <WalletModal onClose={() => setShowAdd(false)} onSaved={fetchWallets} />
      )}
      {editWallet && (
        <WalletModal wallet={editWallet} onClose={() => setEditWallet(null)} onSaved={fetchWallets} />
      )}
      {adjustWallet && (
        <AdjustBalanceModal wallet={adjustWallet} onClose={() => setAdjustWallet(null)} onAdjusted={fetchWallets} />
      )}
      {showTransferModal && (
        <TransferModal
          wallets={wallets}
          defaultFromWalletId={transferFromWalletId}
          onClose={() => {
            setShowTransferModal(false);
            setTransferFromWalletId(undefined);
          }}
          onTransferred={fetchWallets}
        />
      )}
      {deleteWallet && (
        <DeleteModal wallet={deleteWallet} onClose={() => setDeleteWallet(null)} onDeleted={fetchWallets} />
      )}
      {familyWallet && (
        <FamilyWalletModal
          wallet={familyWallet}
          onClose={() => setFamilyWallet(null)}
          onWalletUpdated={fetchWallets}
        />
      )}

      {/* Overview card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                {t("wallets.total_assets")}
              </span>
              <button
                type="button"
                onClick={() => togglePrivacyMode()}
                title={isPrivate ? t("privacy.show_balance") : t("privacy.hide_balance")}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isPrivate ? "visibility_off" : "visibility"}
                </span>
              </button>
              {foreignWallets.length > 0 && (
                <span className="text-[10px] text-amber-300 bg-amber-400/20 border border-amber-300/40 px-2 py-0.5 rounded-full font-semibold">
                  {t("dashboard.converted")}
                </span>
              )}
              {excludedWallets.length > 0 && (
                <span className="text-[10px] text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 rounded-full font-semibold">
                  {excludedWallets.length} {t("wallets.tab_excluded").toLowerCase()}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white font-mono">
                {loading ? "..." : (isPrivate ? maskBalance(totalBalanceInVnd) : fmt(totalBalanceInVnd))}
              </span>
              <span className="text-sm font-medium text-slate-300">VNĐ</span>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              {loading
                ? "..."
                : `${activeWallets.length - excludedWallets.length} ${t("dashboard.active_wallets")}.`}
            </p>

            {foreignWallets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/10 text-xs">
                <span className="text-slate-400 text-[11px]">{t("dashboard.converted")}:</span>
                {foreignWallets.map(fw => (
                  <span
                    key={fw.id}
                    className="px-2.5 py-0.5 rounded-lg bg-white/10 text-white font-mono text-[11px] border border-white/15"
                  >
                    {fw.name}: {isPrivate ? maskBalance(fw.balance) : formatMoney(fw.balance, fw.currency || "VND")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={() => handleOpenTransfer()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-400/40 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer backdrop-blur-xs"
              title="Chuyển tiền qua lại giữa 2 ví"
            >
              <span className="material-symbols-outlined text-[16px]">sync_alt</span>
              <span>{t("wallets.transfer_btn")}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRatesModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer backdrop-blur-xs"
              title="Xem và tùy chỉnh bảng tỷ giá ngoại tệ"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-300">currency_exchange</span>
              <span>{t("wallets.rates_btn")}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>{t("wallets.add_btn")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setCurrentTab("ACTIVE")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentTab === "ACTIVE"
              ? "bg-slate-900 dark:bg-indigo-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span>{t("wallets.tab_active")}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {activeWallets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab("SHARED")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentTab === "SHARED"
              ? "bg-violet-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">family_restroom</span>
          <span>{t("wallets.tab_shared")}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {sharedWallets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab("CREDIT")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentTab === "CREDIT"
              ? "bg-slate-900 dark:bg-indigo-600 text-amber-300 shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">credit_card</span>
          <span>{t("wallets.tab_credit")}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {creditWallets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab("EXCLUDED")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentTab === "EXCLUDED"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span>{t("wallets.tab_excluded")}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {excludedWallets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab("ARCHIVED")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentTab === "ARCHIVED"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">inventory_2</span>
          <span>{t("wallets.tab_archived")}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {archivedWallets.length}
          </span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl border border-rose-200">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Wallets Grid */}
      <div className="space-y-3">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-5 animate-pulse min-h-[200px]" />
            ))}
          </div>
        )}

        {!loading && displayedWallets.length === 0 && !error && (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-4">
              <span className="material-symbols-outlined text-[28px]">
                {currentTab === "ARCHIVED" ? "inventory_2" : "account_balance_wallet"}
              </span>
            </div>
            <h4 className="font-display text-base font-bold text-slate-900 mb-1">
              {currentTab === "ARCHIVED" ? "Không có ví nào đang lưu trữ" : "Chưa có ví trong mục này"}
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mb-5">
              {currentTab === "ARCHIVED"
                ? "Các ví có giao dịch phát sinh khi bị xóa sẽ được đưa vào đây để bảo toàn dữ liệu."
                : "Tạo ví đầu tiên hoặc chọn tab khác để xem danh sách ví của bạn."}
            </p>
            {currentTab !== "ARCHIVED" && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Tạo ví mới
              </button>
            )}
          </div>
        )}

        {!loading && displayedWallets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedWallets.map(wallet => {
              const isCredit = wallet.wallet_type === "CREDIT";
              const theme = getWalletTheme(wallet);

              return (
                <div
                  key={wallet.id}
                  className={`bg-gradient-to-br ${theme.gradient} rounded-3xl p-6 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden min-h-[220px] ${
                    wallet.is_archived ? "opacity-75 grayscale-25" : ""
                  }`}
                >
                  {/* Background radial glow */}
                  <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />

                  {/* Top Row: Chip simulation, Badges & Actions */}
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      {/* EMV Chip simulation */}
                      <div className="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-300/40 via-amber-200/50 to-amber-400/30 border border-amber-300/60 p-1 flex flex-col justify-between shadow-xs">
                        <div className="w-full h-0.5 bg-amber-400/40 rounded-full" />
                        <div className="w-3/4 h-0.5 bg-amber-400/40 rounded-full" />
                        <div className="w-full h-0.5 bg-amber-400/40 rounded-full" />
                      </div>

                      {/* Currency badge */}
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[11px] font-bold border border-white/30 backdrop-blur-xs flex items-center gap-1 shadow-xs">
                        <span>
                          {DEFAULT_CURRENCIES[((wallet.currency || "VND").toUpperCase() as CurrencyCode)]?.flag || "🇻🇳"}
                        </span>
                        <span>{wallet.currency || "VND"}</span>
                      </span>

                      {/* Type Badge */}
                      {isCredit && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-semibold text-[10px] border border-amber-400/40">
                          Thẻ tín dụng
                        </span>
                      )}

                      {wallet.is_shared && (
                        <span
                          className="px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-200 text-[10px] font-semibold border border-violet-400/40 flex items-center gap-1 cursor-pointer"
                          onClick={() => setFamilyWallet(wallet)}
                          title="Quản lý thành viên ví gia đình"
                        >
                          <span className="material-symbols-outlined text-[11px]">family_restroom</span>
                          <span>Gia đình {wallet.members_count ? `(${wallet.members_count + 1})` : ""}</span>
                        </span>
                      )}

                      {!wallet.is_owner && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            wallet.my_role === "EDITOR"
                              ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/30"
                              : "bg-blue-500/30 text-blue-200 border-blue-400/30"
                          }`}
                        >
                          {wallet.my_role === "EDITOR" ? "Biên tập" : "Chỉ xem"}
                        </span>
                      )}

                      {wallet.is_excluded_from_total && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-semibold border border-indigo-400/30" title="Không tính vào tổng tài sản">
                          Quỹ riêng
                        </span>
                      )}

                      {wallet.is_archived && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-500/40 text-slate-200 text-[10px] font-semibold border border-white/20">
                          Đã lưu trữ
                        </span>
                      )}
                    </div>

                    {/* Actions menu */}
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Nút quản lý Ví gia đình */}
                      <button
                        type="button"
                        onClick={() => setFamilyWallet(wallet)}
                        title="Quản lý thành viên & phân quyền ví gia đình"
                        className="w-7 h-7 rounded-lg bg-white/15 hover:bg-violet-600/80 backdrop-blur-xs flex items-center justify-center text-white cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px]">family_restroom</span>
                      </button>

                      {!wallet.is_archived && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenTransfer(wallet.id)}
                            title="Chuyển tiền từ ví này"
                            className="w-7 h-7 rounded-lg bg-white/15 hover:bg-indigo-600/80 backdrop-blur-xs flex items-center justify-center text-white cursor-pointer transition-all"
                          >
                            <span className="material-symbols-outlined text-[15px]">sync_alt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustWallet(wallet)}
                            title="Điều chỉnh số dư thực tế"
                            className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white cursor-pointer transition-all"
                          >
                            <span className="material-symbols-outlined text-[15px]">balance</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditWallet(wallet)}
                        title="Chỉnh sửa ví"
                        className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleArchive(wallet)}
                        title={wallet.is_archived ? "Khôi phục ví" : "Lưu trữ ví"}
                        className="w-7 h-7 rounded-lg bg-white/15 hover:bg-amber-500/80 backdrop-blur-xs flex items-center justify-center text-white cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {wallet.is_archived ? "unarchive" : "archive"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteWallet(wallet)}
                        title="Xoá ví"
                        className="w-7 h-7 rounded-lg bg-white/15 hover:bg-rose-500/80 backdrop-blur-xs flex items-center justify-center text-white cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Middle Row: Balance & Details */}
                  <div className="my-3 relative z-10">
                    <span className="text-[10px] uppercase tracking-widest text-white/60 font-semibold block">
                      {isCredit ? "Dư nợ / Số dư khả dụng" : "Số dư khả dụng"}
                    </span>
                    <div className="mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight font-mono">
                        {isPrivate ? maskBalance(wallet.balance) : formatMoney(wallet.balance, wallet.currency || "VND")}
                      </span>

                      {wallet.currency && wallet.currency.toUpperCase() !== "VND" && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-white/80 font-medium bg-black/25 px-2 py-0.5 rounded-lg w-fit backdrop-blur-xs font-mono">
                          <span className="text-[10px] text-white/60 font-sans">Quy đổi:</span>
                          <span>≈ {isPrivate ? maskBalance(convertToVnd(wallet.balance, wallet.currency)) : fmt(convertToVnd(wallet.balance, wallet.currency))} VNĐ</span>
                        </div>
                      )}

                      {/* Credit Card Details */}
                      {isCredit && (
                        <div className="mt-2.5 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] text-amber-200/90 font-medium">
                          <div>
                            <span className="text-white/60 block text-[10px]">Hạn mức thẻ:</span>
                            <span className="font-mono">
                              {wallet.credit_limit
                                ? (isPrivate ? maskBalance(wallet.credit_limit) : formatMoney(wallet.credit_limit, wallet.currency || "VND"))
                                : "Chưa cài đặt"}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/60 block text-[10px]">Chu kỳ:</span>
                            <span>Sao kê: {wallet.statement_day || 20} | Hạn: {wallet.payment_due_day || 5}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Wallet Name & Type */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                    <div className="min-w-0 pr-2">
                      <h4 className="font-bold text-sm tracking-wide uppercase truncate text-white">
                        {wallet.name}
                      </h4>
                      <p className="text-[10px] text-white/60">
                        {!wallet.is_owner
                          ? `Ví chung • Chủ ví: ${wallet.owner_name || "Thành viên gia đình"}`
                          : isCredit
                          ? "Tài khoản Thẻ Tín Dụng"
                          : wallet.is_shared
                          ? "Ví chung gia đình"
                          : "Tài khoản tiền thông thường"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-white/70">
                        {theme.icon}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
