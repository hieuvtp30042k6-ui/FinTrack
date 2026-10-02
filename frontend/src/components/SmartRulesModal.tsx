import React, { useState, useEffect } from "react";
import { CategoryModel } from "../services/api";
import {
  CustomRule,
  getCustomRules,
  saveCustomRules,
} from "../utils/autoCategorization";

interface SmartRulesModalProps {
  categories: CategoryModel[];
  onClose: () => void;
  onRulesChanged?: () => void;
}

export const SmartRulesModal: React.FC<SmartRulesModalProps> = ({
  categories,
  onClose,
  onRulesChanged,
}) => {
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [activeTab, setActiveTab] = useState<"custom" | "builtin">("custom");
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchBuiltin, setSearchBuiltin] = useState("");

  useEffect(() => {
    setCustomRules(getCustomRules());
    if (categories.length > 0 && !newCategoryName) {
      setNewCategoryName(categories[0].name);
    }
  }, [categories, newCategoryName]);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const kw = newKeyword.trim().toLowerCase();
    if (!kw) {
      setError("Vui lòng nhập từ khóa nhận diện.");
      return;
    }
    if (!newCategoryName) {
      setError("Vui lòng chọn danh mục.");
      return;
    }

    if (customRules.some((r) => r.keyword.toLowerCase() === kw)) {
      setError(`Từ khóa "${kw}" đã tồn tại trong quy tắc.`);
      return;
    }

    const newRule: CustomRule = {
      id: "rule_" + Date.now(),
      keyword: kw,
      categoryName: newCategoryName,
    };

    const updated = [newRule, ...customRules];
    setCustomRules(updated);
    saveCustomRules(updated);
    setNewKeyword("");
    setSuccess(`Đã thêm quy tắc: "${kw}" ➔ ${newCategoryName}`);
    if (onRulesChanged) onRulesChanged();

    setTimeout(() => setSuccess(""), 3000);
  };

  const handleDeleteRule = (id: string) => {
    const updated = customRules.filter((r) => r.id !== id);
    setCustomRules(updated);
    saveCustomRules(updated);
    if (onRulesChanged) onRulesChanged();
  };

  // Danh mục mặc định hệ thống để hiển thị tham khảo
  const BUILTIN_CATEGORIES = [
    {
      name: "Di chuyển",
      icon: "directions_car",
      keywords: ["grab", "be", "gojek", "xanh sm", "taxi", "xăng", "petrolimex", "gửi xe", "vé xe", "vé máy bay", "vietnam airlines", "vietjet", "bến xe", "bot"],
    },
    {
      name: "Ăn uống",
      icon: "restaurant",
      keywords: ["highlands", "phúc long", "starbucks", "the coffee house", "cơm", "phở", "bún", "bánh mì", "trà sữa", "gong cha", "kfc", "lotteria", "pizza", "lẩu", "nướng", "haidilao", "cà phê"],
    },
    {
      name: "Mua sắm",
      icon: "shopping_bag",
      keywords: ["shopee", "tiki", "lazada", "tiktok shop", "siêu thị", "winmart", "coopmart", "bách hóa xanh", "quần áo", "giày", "zara", "uniqlo", "tạp hóa"],
    },
    {
      name: "Hóa đơn & Tiện ích",
      icon: "receipt_long",
      keywords: ["tiền điện", "evn", "tiền nước", "sawaco", "internet", "viettel", "fpt", "vnpt", "cước điện thoại", "4g", "5g", "nạp thẻ"],
    },
    {
      name: "Giải trí",
      icon: "sports_esports",
      keywords: ["netflix", "spotify", "youtube", "cgv", "lotte cinema", "vé xem phim", "game", "steam", "du lịch", "khách sạn", "booking", "karaoke"],
    },
    {
      name: "Nhà ở",
      icon: "home",
      keywords: ["tiền nhà", "tiền phòng", "tiền thuê", "chung cư", "phí quản lý", "sửa nhà", "nội thất", "đồ gia dụng"],
    },
    {
      name: "Sức khỏe & Y tế",
      icon: "medical_services",
      keywords: ["thuốc", "nhà thuốc", "pharmacity", "long châu", "bệnh viện", "khám bệnh", "nha khoa", "gym", "yoga", "fitness"],
    },
    {
      name: "Tiền lương & Thưởng",
      icon: "payments",
      keywords: ["lương", "salary", "chuyển lương", "lương tháng", "thưởng", "bonus", "thưởng tết", "hoa hồng"],
    },
  ];

  const filteredBuiltin = BUILTIN_CATEGORIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchBuiltin.toLowerCase()) ||
      c.keywords.some((kw) => kw.toLowerCase().includes(searchBuiltin.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">auto_awesome</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Quy Tắc Tự Động Gán Danh Mục
              </h3>
              <p className="text-[11px] text-slate-500">
                Tự động nhận diện danh mục từ từ khóa trong ghi chú giao dịch
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

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "custom"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            <span>Quy tắc của bạn ({customRules.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("builtin")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "builtin"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">menu_book</span>
            <span>Từ điển có sẵn (100+ từ khóa)</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === "custom" ? (
            <>
              {/* Form thêm quy tắc */}
              <form
                onSubmit={handleAddRule}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 text-[16px]">
                      add_circle
                    </span>
                    Thêm từ khóa mới
                  </span>
                  <span className="text-[10px] text-slate-400">Không phân biệt hoa/thường</span>
                </div>

                {error && (
                  <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    {success}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Từ khóa trong ghi chú:
                    </label>
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="Ví dụ: cơm tấm, grab..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Gán vào danh mục:
                    </label>
                    <select
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.type === "INCOME" ? "Thu" : "Chi"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">save</span>
                    <span>Lưu quy tắc</span>
                  </button>
                </div>
              </form>

              {/* Danh sách quy tắc tùy chỉnh */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Danh sách quy tắc tùy chỉnh của bạn</span>
                  <span>{customRules.length} quy tắc</span>
                </div>

                {customRules.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <span className="material-symbols-outlined text-slate-300 text-3xl mb-1">
                      rule
                    </span>
                    <p className="text-xs text-slate-500">Chưa có quy tắc tùy chỉnh nào.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hệ thống vẫn đang sử dụng hơn 100 từ khóa thông minh có sẵn!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                    {customRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200/70 text-indigo-700 font-mono font-semibold truncate">
                            "{rule.keyword}"
                          </span>
                          <span className="text-slate-400">➔</span>
                          <span className="font-semibold text-slate-800 truncate">
                            {rule.categoryName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Xóa quy tắc này"
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Built-in rules dictionary */}
              <div className="space-y-4">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchBuiltin}
                    onChange={(e) => setSearchBuiltin(e.target.value)}
                    placeholder="Tìm kiếm từ khóa trong từ điển (vd: grab, netflix, cơm...)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-3">
                  {filteredBuiltin.map((catGroup) => (
                    <div
                      key={catGroup.name}
                      className="border border-slate-200/80 rounded-2xl p-3.5 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-indigo-600">
                          {catGroup.icon}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{catGroup.name}</h4>
                        <span className="text-[10px] text-slate-400">
                          ({catGroup.keywords.length} từ khóa)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {catGroup.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-block px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700 shadow-2xs font-medium"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
            Tự động kích hoạt khi gõ Ghi chú
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
