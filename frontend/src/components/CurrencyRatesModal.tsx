import React, { useState } from "react";
import {
  CurrencyCode,
  CurrencyInfo,
  DEFAULT_CURRENCIES,
  getActiveCurrencies,
  saveCurrencyRates,
  convertCurrency,
  formatMoney,
} from "../utils/currency";

interface CurrencyRatesModalProps {
  onClose: () => void;
  onRatesUpdated?: () => void;
}

export const CurrencyRatesModal: React.FC<CurrencyRatesModalProps> = ({
  onClose,
  onRatesUpdated,
}) => {
  const [rates, setRates] = useState<Record<CurrencyCode, CurrencyInfo>>(() =>
    getActiveCurrencies()
  );
  const [editingCode, setEditingCode] = useState<CurrencyCode | null>(null);
  const [editRateValue, setEditRateValue] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Converter tool
  const [calcAmount, setCalcAmount] = useState<string>("100");
  const [fromCode, setFromCode] = useState<CurrencyCode>("USD");
  const [toCode, setToCode] = useState<CurrencyCode>("VND");

  const handleStartEdit = (code: CurrencyCode) => {
    setEditingCode(code);
    setEditRateValue(String(rates[code].rateToVnd));
  };

  const handleSaveRate = (code: CurrencyCode) => {
    const val = parseFloat(editRateValue);
    if (isNaN(val) || val <= 0) return;

    const updated = {
      ...rates,
      [code]: {
        ...rates[code],
        rateToVnd: val,
      },
    };
    setRates(updated);
    saveCurrencyRates(updated);
    setEditingCode(null);
    setSuccessMsg(`Đã cập nhật tỷ giá cho 1 ${code} = ${val.toLocaleString("vi-VN")} VND`);
    if (onRatesUpdated) onRatesUpdated();

    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleResetDefaults = () => {
    setRates(DEFAULT_CURRENCIES);
    saveCurrencyRates(DEFAULT_CURRENCIES);
    setEditingCode(null);
    setSuccessMsg("Đã khôi phục toàn bộ tỷ giá chuẩn quốc tế ban đầu.");
    if (onRatesUpdated) onRatesUpdated();

    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const convertedResult = convertCurrency(
    parseFloat(calcAmount) || 0,
    fromCode,
    toCode
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">currency_exchange</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Bảng Tỷ Giá &amp; Quy Đổi Ngoại Tệ
              </h3>
              <p className="text-[11px] text-slate-500">
                Tự động quy đổi tất cả ví ngoại tệ về VND trên Dashboard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successMsg && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3 animate-in fade-in">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                check_circle
              </span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Công cụ Quy đổi nhanh */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-600 text-[16px]">
                swap_horiz
              </span>
              <span>Công cụ quy đổi ngoại tệ nhanh</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Số tiền:
                </label>
                <input
                  type="number"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Từ đồng tiền:
                </label>
                <select
                  value={fromCode}
                  onChange={(e) => setFromCode(e.target.value as CurrencyCode)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
                >
                  {Object.values(rates).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Sang đồng tiền:
                </label>
                <select
                  value={toCode}
                  onChange={(e) => setToCode(e.target.value as CurrencyCode)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
                >
                  {Object.values(rates).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Kết quả quy đổi:</span>
              <span className="font-display text-sm font-bold text-slate-900">
                {formatMoney(convertedResult, toCode)}
              </span>
            </div>
          </div>

          {/* Bảng tỷ giá chi tiết */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Tỷ giá quy đổi chuẩn theo VND
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Khôi phục mặc định
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
              {Object.values(rates).map((c) => {
                const isBase = c.code === "VND";
                const isEditing = editingCode === c.code;

                return (
                  <div
                    key={c.code}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl select-none">{c.flag}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900">
                            {c.code}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            ({c.name})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Ký hiệu: {c.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isBase ? (
                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                          Đồng tiền cơ sở (1:1)
                        </span>
                      ) : isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 font-medium">1 {c.code} =</span>
                          <input
                            type="number"
                            value={editRateValue}
                            onChange={(e) => setEditRateValue(e.target.value)}
                            className="w-24 px-2 py-1 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRate(c.code)}
                            className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            title="Lưu"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCode(null)}
                            className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                            title="Hủy"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-900 font-mono">
                              1 {c.code} = {c.rateToVnd.toLocaleString("vi-VN")} đ
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(c.code)}
                            title="Sửa tỷ giá"
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <span className="text-[11px] text-slate-400">
            Hỗ trợ 5 loại ngoại tệ phổ biến nhất
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
};
