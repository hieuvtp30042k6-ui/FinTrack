import React, { useState, useMemo, useEffect } from "react";
import { User } from "../../types/auth";
import {
  SplitGroup,
  GroupMember,
  GroupExpense,
  calculateMemberBalances,
  calculateOptimalSettlements,
  generateSettlementSummaryText,
  getSavedGroups,
  saveGroups,
  getRandomColor,
} from "../../utils/splitBill";
import { Pagination } from "../../components/Pagination";
import { useTranslation } from "../../utils/i18n";

interface SplitBillViewProps {
  user?: User;
}

export const SplitBillView: React.FC<SplitBillViewProps> = ({ user }) => {
  const { t, lang } = useTranslation();
  const [groups, setGroups] = useState<SplitGroup[]>(() => getSavedGroups());
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    const list = getSavedGroups();
    return list.length > 0 ? list[0].id : "";
  });
  const [activeSubTab, setActiveSubTab] = useState<"expenses" | "balances" | "settlement">("expenses");

  // Modals
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Form states cho tạo nhóm
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupIcon, setNewGroupIcon] = useState("flight_takeoff");
  const [memberInput, setMemberInput] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  // Form states cho thêm khoản chi
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Ăn uống");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // Phân trang & bộ lọc: Danh sách nhóm (Groups)
  const [groupSearch, setGroupSearch] = useState("");
  const [groupPage, setGroupPage] = useState(1);
  const groupPageSize = 4;

  // Phân trang & bộ lọc: Khoản chi chung (Expenses)
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("ALL");
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(5);

  // Phân trang & bộ lọc: Số dư thành viên (Balances)
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceStatusFilter, setBalanceStatusFilter] = useState<"ALL" | "RECEIVE" | "PAY" | "BALANCED">("ALL");
  const [balancePage, setBalancePage] = useState(1);
  const [balancePageSize, setBalancePageSize] = useState(6);

  // Phân trang: Kế hoạch chuyển khoản bù trừ tối ưu (Transfers)
  const [transferPage, setTransferPage] = useState(1);
  const [transferPageSize, setTransferPageSize] = useState(5);

  // Phân trang & bộ lọc: Lịch sử đã tất toán (Settlements)
  const [settlementSearch, setSettlementSearch] = useState("");
  const [settlementPage, setSettlementPage] = useState(1);
  const [settlementPageSize, setSettlementPageSize] = useState(5);

  // Nhóm đang được chọn
  const currentGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId) || groups[0] || null;
  }, [groups, selectedGroupId]);

  // Reset trang con khi chuyển nhóm
  useEffect(() => {
    setExpensePage(1);
    setBalancePage(1);
    setTransferPage(1);
    setSettlementPage(1);
  }, [selectedGroupId]);

  // Dữ liệu tính toán
  const memberBalances = useMemo(() => {
    return currentGroup ? calculateMemberBalances(currentGroup) : [];
  }, [currentGroup]);

  const optimalTransfers = useMemo(() => {
    return currentGroup ? calculateOptimalSettlements(currentGroup) : [];
  }, [currentGroup]);

  const totalExpense = useMemo(() => {
    return currentGroup ? currentGroup.expenses.reduce((s, e) => s + e.amount, 0) : 0;
  }, [currentGroup]);

  const myBalance = useMemo(() => {
    return memberBalances.find((b) => b.member.isCurrentUser)?.netBalance ?? 0;
  }, [memberBalances]);

  // Toast helper
  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  // Lưu nhóm
  const updateGroupsAndSave = (newGroups: SplitGroup[]) => {
    setGroups(newGroups);
    saveGroups(newGroups);
  };

  // === 1. Lọc và phân trang cho Danh sách nhóm (Groups) ===
  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q)
    );
  }, [groups, groupSearch]);

  const paginatedGroups = useMemo(() => {
    const start = (groupPage - 1) * groupPageSize;
    return filteredGroups.slice(start, start + groupPageSize);
  }, [filteredGroups, groupPage, groupPageSize]);

  // === 2. Lọc và phân trang cho Khoản chi chung (Expenses) ===
  const availableCategories = useMemo(() => {
    if (!currentGroup) return [];
    const set = new Set<string>();
    currentGroup.expenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [currentGroup]);

  const filteredExpenses = useMemo(() => {
    if (!currentGroup) return [];
    const q = expenseSearch.trim().toLowerCase();
    return currentGroup.expenses.filter((exp) => {
      const payer = currentGroup.members.find((m) => m.id === exp.paidByMemberId);
      const matchesSearch =
        !q ||
        exp.title.toLowerCase().includes(q) ||
        (payer?.name || "").toLowerCase().includes(q) ||
        (exp.category || "").toLowerCase().includes(q);
      const matchesCategory =
        expenseCategoryFilter === "ALL" || exp.category === expenseCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [currentGroup, expenseSearch, expenseCategoryFilter]);

  const paginatedExpenses = useMemo(() => {
    const start = (expensePage - 1) * expensePageSize;
    return filteredExpenses.slice(start, start + expensePageSize);
  }, [filteredExpenses, expensePage, expensePageSize]);

  // === 3. Lọc và phân trang cho Số dư thành viên (Balances) ===
  const filteredBalances = useMemo(() => {
    const q = balanceSearch.trim().toLowerCase();
    return memberBalances.filter((item) => {
      const matchesSearch = !q || item.member.name.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (balanceStatusFilter === "RECEIVE") return item.netBalance > 0;
      if (balanceStatusFilter === "PAY") return item.netBalance < 0;
      if (balanceStatusFilter === "BALANCED") return item.netBalance === 0;
      return true;
    });
  }, [memberBalances, balanceSearch, balanceStatusFilter]);

  const paginatedBalances = useMemo(() => {
    const start = (balancePage - 1) * balancePageSize;
    return filteredBalances.slice(start, start + balancePageSize);
  }, [filteredBalances, balancePage, balancePageSize]);

  // === 4. Phân trang cho Kế hoạch chuyển khoản (Transfers) ===
  const paginatedTransfers = useMemo(() => {
    const start = (transferPage - 1) * transferPageSize;
    return optimalTransfers.slice(start, start + transferPageSize);
  }, [optimalTransfers, transferPage, transferPageSize]);

  // === 5. Lọc và phân trang cho Lịch sử tất toán (Settlements) ===
  const settlements = useMemo(() => {
    return currentGroup?.settlements || [];
  }, [currentGroup]);

  const filteredSettlements = useMemo(() => {
    if (!currentGroup) return [];
    const q = settlementSearch.trim().toLowerCase();
    if (!q) return settlements;
    return settlements.filter((set) => {
      const fromM = currentGroup.members.find((m) => m.id === set.fromMemberId);
      const toM = currentGroup.members.find((m) => m.id === set.toMemberId);
      return (
        (fromM?.name || "").toLowerCase().includes(q) ||
        (toM?.name || "").toLowerCase().includes(q) ||
        (set.note || "").toLowerCase().includes(q)
      );
    });
  }, [currentGroup, settlements, settlementSearch]);

  const paginatedSettlements = useMemo(() => {
    const start = (settlementPage - 1) * settlementPageSize;
    return filteredSettlements.slice(start, start + settlementPageSize);
  }, [filteredSettlements, settlementPage, settlementPageSize]);

  // Khởi tạo form thêm expense khi mở modal
  const handleOpenAddExpense = () => {
    if (!currentGroup) return;
    setExpenseTitle("");
    setExpenseAmount("");
    setExpensePaidBy(currentGroup.members[0]?.id || "");
    setExpenseCategory("Ăn uống");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setSelectedParticipants(currentGroup.members.map((m) => m.id));
    setShowAddExpenseModal(true);
  };

  // Tạo nhóm mới
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const userMemberName = user?.name || "Bạn";
    const members: GroupMember[] = [
      {
        id: "m_user",
        name: userMemberName,
        isCurrentUser: true,
        avatarColor: "bg-indigo-600",
      },
      ...newGroupMembers.map((name, idx) => ({
        id: `m_${Date.now()}_${idx}`,
        name: name.trim(),
        avatarColor: getRandomColor(idx + 1),
      })),
    ];

    const newGroup: SplitGroup = {
      id: `group_${Date.now()}`,
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || undefined,
      icon: newGroupIcon,
      currency: "VND",
      createdAt: new Date().toISOString().split("T")[0],
      members,
      expenses: [],
      settlements: [],
    };

    const updated = [newGroup, ...groups];
    updateGroupsAndSave(updated);
    setSelectedGroupId(newGroup.id);
    setShowNewGroupModal(false);
    setNewGroupName("");
    setNewGroupDesc("");
    setNewGroupMembers([]);
    triggerToast("Đã tạo nhóm mới thành công!");
  };

  // Thêm thành viên vào danh sách dự thảo
  const handleAddDraftMember = () => {
    if (!memberInput.trim()) return;
    if (newGroupMembers.includes(memberInput.trim())) return;
    setNewGroupMembers([...newGroupMembers, memberInput.trim()]);
    setMemberInput("");
  };

  // Xóa khoản chi
  const handleDeleteExpense = (expId: string) => {
    if (!currentGroup) return;
    const updatedExpenses = currentGroup.expenses.filter((e) => e.id !== expId);
    const updatedGroup = { ...currentGroup, expenses: updatedExpenses };
    const newGroups = groups.map((g) => (g.id === currentGroup.id ? updatedGroup : g));
    updateGroupsAndSave(newGroups);
    triggerToast("Đã xóa khoản chi");
  };

  // Lưu chi tiêu mới
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;

    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Vui lòng nhập số tiền hợp lệ");
      return;
    }
    if (!expenseTitle.trim()) {
      alert("Vui lòng nhập tên khoản chi");
      return;
    }
    if (selectedParticipants.length === 0) {
      alert("Vui lòng chọn ít nhất một người cùng chia sẻ khoản tiền này");
      return;
    }

    const shareAmount = Math.round(amt / selectedParticipants.length);
    const splits = selectedParticipants.map((mId) => ({
      memberId: mId,
      amount: shareAmount,
    }));

    const newExpense: GroupExpense = {
      id: `exp_${Date.now()}`,
      title: expenseTitle.trim(),
      amount: amt,
      paidByMemberId: expensePaidBy,
      date: expenseDate,
      category: expenseCategory,
      splitType: "EQUAL",
      splits,
    };

    const updatedGroup = {
      ...currentGroup,
      expenses: [newExpense, ...currentGroup.expenses],
    };
    const newGroups = groups.map((g) => (g.id === currentGroup.id ? updatedGroup : g));
    updateGroupsAndSave(newGroups);
    setShowAddExpenseModal(false);
    triggerToast("Đã thêm khoản chi thành công!");
  };

  // Đánh dấu đã tất toán giao dịch chuyển khoản
  const handleSettleTransfer = (fromId: string, toId: string, amount: number) => {
    if (!currentGroup) return;
    const newSettlement = {
      id: `set_${Date.now()}`,
      fromMemberId: fromId,
      toMemberId: toId,
      amount,
      settledAt: new Date().toISOString().split("T")[0],
    };

    const updatedGroup = {
      ...currentGroup,
      settlements: [...currentGroup.settlements, newSettlement],
    };
    const newGroups = groups.map((g) => (g.id === currentGroup.id ? updatedGroup : g));
    updateGroupsAndSave(newGroups);
    triggerToast("Đã ghi nhận thanh toán tất toán nợ!");
  };

  // Sao chép tin nhắn tổng kết
  const handleCopySummary = () => {
    if (!currentGroup) return;
    const text = generateSettlementSummaryText(currentGroup);
    navigator.clipboard.writeText(text);
    triggerToast("Đã sao chép tổng kết vào bộ nhớ tạm! Bạn có thể dán vào Zalo/Messenger.");
  };

  // Xóa toàn bộ nhóm
  const handleDeleteGroup = () => {
    if (!currentGroup) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhóm "${currentGroup.name}"? Dữ liệu nhóm sẽ bị xóa khỏi bộ nhớ.`)) {
      return;
    }
    const remaining = groups.filter((g) => g.id !== currentGroup.id);
    updateGroupsAndSave(remaining);
    if (remaining.length > 0) {
      setSelectedGroupId(remaining[0].id);
    } else {
      setSelectedGroupId("");
    }
    triggerToast("Đã xóa nhóm thành công");
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-slideUp">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-xs font-semibold">{showToast}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs shrink-0">
            <span className="material-symbols-outlined text-[26px]">groups</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("split_bill.title", "Chia Tiền Nhóm & Sự Kiện")}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wide">
                {t("split_bill.badge_pro", "Split Bill Pro")}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t("split_bill.subtitle", "Tự động phân bổ chi phí chuyến đi, sự kiện, ăn uống và tối ưu hóa bù trừ nợ thông minh.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewGroupModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{t("split_bill.create_group_btn", "Tạo nhóm mới")}</span>
          </button>
        </div>
      </div>

      {/* Groups Selector Bar with Search and Pagination when many groups exist */}
      {groups.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("split_bill.group_list_title", "DANH SÁCH NHÓM")} ({filteredGroups.length}/{groups.length})
              </span>
            </div>

            {/* Quick group search if more than 3 groups */}
            {groups.length > 3 && (
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  placeholder={t("split_bill.modal_group_name_placeholder", "Tìm nhóm chia tiền...")}
                  value={groupSearch}
                  onChange={(e) => {
                    setGroupSearch(e.target.value);
                    setGroupPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-indigo-500"
                />
                {groupSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupSearch("");
                      setGroupPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {paginatedGroups.map((group) => {
              const isSelected = group.id === selectedGroupId;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                    isSelected
                      ? "bg-slate-900 dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${isSelected ? "text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}>
                    {group.icon || "group"}
                  </span>
                  <span>{group.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {group.members.length} người
                  </span>
                </button>
              );
            })}
          </div>

          {/* Pagination for Groups if groups exceed page size */}
          {filteredGroups.length > groupPageSize && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Trang {groupPage} / {Math.ceil(filteredGroups.length / groupPageSize)} ({filteredGroups.length} nhóm)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={groupPage <= 1}
                  onClick={() => setGroupPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={groupPage >= Math.ceil(filteredGroups.length / groupPageSize)}
                  onClick={() => setGroupPage((p) => p + 1)}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Group Content */}
      {currentGroup ? (
        <div className="space-y-5">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Tổng chi phí nhóm */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("split_bill.total_group_expense", "Tổng chi phí cả nhóm")}
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-mono">
                {totalExpense.toLocaleString("vi-VN")}{" "}
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{currentGroup.currency}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-indigo-600 dark:text-indigo-400">receipt_long</span>
                <span>{currentGroup.expenses.length} {t("split_bill.expenses_recorded", "khoản chi phí đã ghi nhận")}</span>
              </div>
            </div>

            {/* Card 2: Số dư của bạn */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("account.status", "Trạng thái")}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    myBalance > 0
                      ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                      : myBalance < 0
                      ? "bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                      : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {myBalance > 0 ? "arrow_circle_down" : myBalance < 0 ? "arrow_circle_up" : "check_circle"}
                  </span>
                </div>
              </div>
              <div
                className={`text-2xl font-bold tracking-tight font-mono ${
                  myBalance > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : myBalance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {myBalance > 0 ? "+" : ""}
                {myBalance.toLocaleString("vi-VN")}{" "}
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{currentGroup.currency}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                {myBalance > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400">Bạn sẽ nhận lại tiền từ các thành viên</span>
                ) : myBalance < 0 ? (
                  <span className="text-rose-700 dark:text-rose-400">Bạn cần chuyển khoản trả cho nhóm</span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">Bạn đã cân bằng xong các khoản nợ</span>
                )}
              </div>
            </div>

            {/* Card 3: Giao dịch tối ưu cần tất toán */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("split_bill.optimal_settlement", "BÙ TRỪ NỢ TỐI ƯU")}
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">auto_mode</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-mono">
                {optimalTransfers.length}{" "}
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("split_bill.transfer_count", "lần chuyển khoản")}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  <span>{t("split_bill.copy_zalo", "Sao chép gửi Zalo/Mess")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Group Header & Actions Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{currentGroup.name}</h2>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">Tạo ngày {currentGroup.createdAt}</span>
              </div>
              {currentGroup.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentGroup.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Sao chép tóm tắt để gửi Zalo hoặc Messenger"
              >
                <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">share</span>
                <span>{t("split_bill.export_zalo", "Xuất tin nhắn Zalo")}</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-400 text-xs font-semibold transition-all cursor-pointer"
                title={t("split_bill.delete_group", "Xóa nhóm")}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>{t("split_bill.delete_group", "Xóa nhóm")}</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit flex-wrap">
            <button
              type="button"
              onClick={() => setActiveSubTab("expenses")}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "expenses"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>{t("split_bill.tab_shared_expenses", "Khoản chi chung")} ({currentGroup.expenses.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("balances")}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "balances"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              <span>{t("split_bill.tab_balances", "Cân đối công nợ")} ({memberBalances.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("settlement")}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === "settlement"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">sync_alt</span>
              <span>{t("split_bill.tab_settlements", "Hướng dẫn hoàn tất nợ")} ({optimalTransfers.length})</span>
            </button>
          </div>

          {/* TAB 1: KHOẢN CHI CHUNG (VỚI TÌM KIẾM, LỌC & PHÂN TRANG) */}
          {activeSubTab === "expenses" && (
            <div className="space-y-4">
              {/* Header Actions & Filter Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                  {/* Search box */}
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder={t("split_bill.search_expense_placeholder", "Tìm khoản chi theo tên, người trả, danh mục...")}
                      value={expenseSearch}
                      onChange={(e) => {
                        setExpenseSearch(e.target.value);
                        setExpensePage(1);
                      }}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-indigo-500"
                    />
                    {expenseSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setExpenseSearch("");
                          setExpensePage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Category Filter */}
                  <select
                    value={expenseCategoryFilter}
                    onChange={(e) => {
                      setExpenseCategoryFilter(e.target.value);
                      setExpensePage(1);
                    }}
                    className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">{t("split_bill.filter_all_cat", "Tất cả danh mục")}</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddExpense}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>{t("split_bill.add_expense_btn", "Thêm chi tiêu mới")}</span>
                </button>
              </div>

              {/* Expenses List */}
              {currentGroup.expenses.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-[28px]">receipt_long</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Chưa có khoản chi tiêu nào</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    Bắt đầu ghi nhận các hóa đơn ăn uống, khách sạn hoặc vé tham quan để FinTrack tự động phân bổ chi phí.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddExpense}
                    className="mt-4 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Thêm khoản chi đầu tiên</span>
                  </button>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                  <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2">search_off</span>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Không tìm thấy khoản chi phù hợp</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Thử đổi từ khóa tìm kiếm hoặc bỏ chọn danh mục đang lọc.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseSearch("");
                      setExpenseCategoryFilter("ALL");
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedExpenses.map((exp) => {
                      const payer = currentGroup.members.find((m) => m.id === exp.paidByMemberId);
                      return (
                        <div
                          key={exp.id}
                          className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                              <span className="material-symbols-outlined text-[20px]">
                                {exp.category === "Ăn uống"
                                  ? "restaurant"
                                  : exp.category === "Nhà ở"
                                  ? "hotel"
                                  : exp.category === "Đi lại"
                                  ? "directions_car"
                                  : exp.category === "Mua sắm"
                                  ? "shopping_bag"
                                  : "receipt"}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{exp.title}</h4>
                                {exp.category && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                                    {exp.category}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>📅 {exp.date}</span>
                                <span>
                                  💳 Trả trước bởi:{" "}
                                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                                    {payer?.name || "Thành viên"}
                                  </strong>
                                </span>
                                <span>👥 Chia cho {exp.splits.length} người</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                            <div className="text-right">
                              <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
                                {exp.amount.toLocaleString("vi-VN")}{" "}
                                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                  {currentGroup.currency}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                ~{Math.round(exp.amount / exp.splits.length).toLocaleString("vi-VN")} đ / người
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                              title="Xóa khoản chi"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Component */}
                  <Pagination
                    currentPage={expensePage}
                    totalItems={filteredExpenses.length}
                    pageSize={expensePageSize}
                    onPageChange={setExpensePage}
                    onPageSizeChange={setExpensePageSize}
                    pageSizeOptions={[5, 10, 20, 50]}
                    itemName="khoản chi"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SỐ DƯ THÀNH VIÊN (VỚI TÌM KIẾM, LỌC TRẠNG THÁI & PHÂN TRANG) */}
          {activeSubTab === "balances" && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo tên thành viên..."
                    value={balanceSearch}
                    onChange={(e) => {
                      setBalanceSearch(e.target.value);
                      setBalancePage(1);
                    }}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-indigo-500"
                  />
                  {balanceSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setBalanceSearch("");
                        setBalancePage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  value={balanceStatusFilter}
                  onChange={(e) => {
                    setBalanceStatusFilter(e.target.value as any);
                    setBalancePage(1);
                  }}
                  className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="RECEIVE">Cần nhận lại (+)</option>
                  <option value="PAY">Cần trả thêm (-)</option>
                  <option value="BALANCED">Đã cân bằng (0đ)</option>
                </select>
              </div>

              {filteredBalances.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                  <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2">person_search</span>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Không tìm thấy thành viên phù hợp</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Thử đổi từ khóa hoặc bộ lọc trạng thái số dư.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {paginatedBalances.map((item) => {
                      const isPositive = item.netBalance > 0;
                      const isNegative = item.netBalance < 0;
                      return (
                        <div
                          key={item.member.id}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs p-4 flex items-center justify-between transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl ${
                                item.member.avatarColor || "bg-indigo-600"
                              } text-white flex items-center justify-center font-bold text-sm shadow-xs`}
                            >
                              {item.member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{item.member.name}</span>
                                {item.member.isCurrentUser && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                                    BẠN
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                Đã chi: {item.paidTotal.toLocaleString("vi-VN")} đ • Phải chịu:{" "}
                                {item.owedTotal.toLocaleString("vi-VN")} đ
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className={`text-base font-bold font-mono ${
                                isPositive
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : isNegative
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {item.netBalance.toLocaleString("vi-VN")}{" "}
                              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                                {currentGroup.currency}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold mt-0.5">
                              {isPositive ? (
                                <span className="text-emerald-700 dark:text-emerald-400">Cần nhận lại</span>
                              ) : isNegative ? (
                                <span className="text-rose-700 dark:text-rose-400">Cần trả thêm</span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">Đã cân bằng</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination for Member Balances */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                    <Pagination
                      currentPage={balancePage}
                      totalItems={filteredBalances.length}
                      pageSize={balancePageSize}
                      onPageChange={setBalancePage}
                      onPageSizeChange={setBalancePageSize}
                      pageSizeOptions={[6, 12, 24]}
                      itemName="thành viên"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TẤT TOÁN NỢ TỐI ƯU & LỊCH SỬ (CÓ PHÂN TRANG) */}
          {activeSubTab === "settlement" && (
            <div className="space-y-6">
              {/* Section 1: Kế hoạch chuyển khoản tối thiểu */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-400">route</span>
                      Kế hoạch chuyển khoản tối thiểu
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Áp dụng thuật toán Greedy Debt Simplification để tối thiểu số lần chuyển tiền giữa các thành viên.
                    </p>
                  </div>
                </div>

                {optimalTransfers.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                      <span className="material-symbols-outlined text-[24px]">task_alt</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Tất cả nợ đã được thanh toán!</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Số dư của mọi người trong nhóm đã hoàn toàn cân bằng 0đ.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      {paginatedTransfers.map((transfer, index) => (
                        <div
                          key={index}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>{transfer.fromMember.name}</span>
                              </div>
                              <span className="material-symbols-outlined text-slate-400 text-[18px]">
                                trending_flat
                              </span>
                              <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>{transfer.toMember.name}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-right">
                              <span className="text-xs text-slate-500 dark:text-slate-400">Số tiền: </span>
                              <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                                {transfer.amount.toLocaleString("vi-VN")} {currentGroup.currency}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleSettleTransfer(
                                  transfer.fromMember.id,
                                  transfer.toMember.id,
                                  transfer.amount
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                              <span>Đã chuyển khoản</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination for Transfers if optimal transfers > 5 */}
                    {optimalTransfers.length > 5 && (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                        <Pagination
                          currentPage={transferPage}
                          totalItems={optimalTransfers.length}
                          pageSize={transferPageSize}
                          onPageChange={setTransferPage}
                          onPageSizeChange={setTransferPageSize}
                          pageSizeOptions={[5, 10, 20]}
                          itemName="giao dịch bù trừ"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Lịch sử các đợt đã tất toán nợ (Có tìm kiếm & phân trang) */}
              {currentGroup.settlements.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">history</span>
                      <span>Lịch sử các đợt đã tất toán nợ ({currentGroup.settlements.length})</span>
                    </h4>

                    {currentGroup.settlements.length > 3 && (
                      <div className="relative w-full sm:w-60">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                          search
                        </span>
                        <input
                          type="text"
                          placeholder="Tìm người chuyển / nhận..."
                          value={settlementSearch}
                          onChange={(e) => {
                            setSettlementSearch(e.target.value);
                            setSettlementPage(1);
                          }}
                          className="w-full pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedSettlements.map((set) => {
                        const fromM = currentGroup.members.find((m) => m.id === set.fromMemberId);
                        const toM = currentGroup.members.find((m) => m.id === set.toMemberId);
                        return (
                          <div
                            key={set.id}
                            className="px-4 py-3 text-xs flex items-center justify-between text-slate-600 dark:text-slate-300 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[14px]">check</span>
                              </span>
                              <span>
                                <strong className="text-slate-800 dark:text-white font-semibold">
                                  {fromM?.name}
                                </strong>{" "}
                                đã thanh toán cho{" "}
                                <strong className="text-slate-800 dark:text-white font-semibold">
                                  {toM?.name}
                                </strong>{" "}
                                <span className="text-slate-400 font-mono text-[11px]">({set.settledAt})</span>
                              </span>
                            </div>
                            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {set.amount.toLocaleString("vi-VN")} {currentGroup.currency}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination for Settlement History */}
                    <Pagination
                      currentPage={settlementPage}
                      totalItems={filteredSettlements.length}
                      pageSize={settlementPageSize}
                      onPageChange={setSettlementPage}
                      onPageSizeChange={setSettlementPageSize}
                      pageSizeOptions={[5, 10, 20]}
                      itemName="lần tất toán"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Chưa có nhóm chia tiền nào</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Tạo nhóm cho chuyến du lịch sắp tới, hội bạn thân ăn trưa, hoặc tiền phòng trọ cùng chia sẻ.
          </p>
          <button
            type="button"
            onClick={() => setShowNewGroupModal(true)}
            className="mt-4 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Tạo nhóm đầu tiên ngay</span>
          </button>
        </div>
      )}

      {/* MODAL 1: TẠO NHÓM MỚI */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-scaleUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">group_add</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t("split_bill.modal_new_group_title", "Tạo nhóm chia tiền mới")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t("split_bill.modal_group_subtitle", "Chuyến đi, sự kiện, phòng trọ, ăn uống")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGroupModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("split_bill.modal_group_name", "Tên nhóm")} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("split_bill.modal_group_name_placeholder", "Ví dụ: Du lịch Vũng Tàu, Tiền trọ Tháng 10...")}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("split_bill.modal_group_desc", "Mô tả (tùy chọn)")}
                </label>
                <input
                  type="text"
                  placeholder={t("split_bill.modal_group_desc_placeholder", "Ghi chú thêm về chuyến đi...")}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("split_bill.modal_choose_icon", "Chọn biểu tượng")}
                </label>
                <div className="flex items-center gap-2">
                  {[
                    "flight_takeoff",
                    "restaurant",
                    "hotel",
                    "celebration",
                    "shopping_bag",
                    "directions_car",
                  ].map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewGroupIcon(ic)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                        newGroupIcon === ic
                          ? "bg-slate-900 dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{ic}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("split_bill.modal_add_members", "Thêm thành viên vào nhóm")}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={t("split_bill.modal_member_name_placeholder", "Tên thành viên (ví dụ: Hoàng Nam, Khánh Linh...)")}
                    value={memberInput}
                    onChange={(e) => setMemberInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDraftMember();
                      }
                    }}
                    className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftMember}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    {t("split_bill.modal_add_member_btn", "Thêm")}
                  </button>
                </div>

                {/* Danh sách thành viên */}
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto">
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {user?.name || (lang === 'en' ? "You (Creator)" : "Bạn (Người tạo)")}
                  </span>
                  {newGroupMembers.map((name, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() =>
                          setNewGroupMembers(newGroupMembers.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewGroupModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  {t("action.cancel", "Hủy")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow-sm cursor-pointer transition-all"
                >
                  {t("split_bill.modal_create_group_btn", "Tạo nhóm")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: THÊM KHOẢN CHI TIÊU */}
      {showAddExpenseModal && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-scaleUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t("split_bill.modal_add_expense_title", "Thêm chi tiêu cho nhóm")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t("split_bill.modal_expense_subtitle", "Ghi nhận ai đã trả và phân chia cho các thành viên")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("split_bill.modal_expense_name", "Tên khoản chi *")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("split_bill.modal_expense_name_placeholder", "Ví dụ: Bữa tối lẩu nướng, Tiền grab ra sân bay...")}
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t("split_bill.modal_expense_amount", "Số tiền (VND) *")}
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    placeholder="500000"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t("split_bill.modal_expense_category", "Danh mục")}
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all cursor-pointer font-medium"
                  >
                    <option value="Ăn uống">{lang === 'en' ? "Food & Beverage" : "Ăn uống"}</option>
                    <option value="Đi lại">{lang === 'en' ? "Transportation" : "Đi lại"}</option>
                    <option value="Nhà ở">{lang === 'en' ? "Accommodation" : "Nhà ở"}</option>
                    <option value="Giải trí">{lang === 'en' ? "Entertainment" : "Giải trí"}</option>
                    <option value="Mua sắm">{lang === 'en' ? "Shopping" : "Mua sắm"}</option>
                    <option value="Khác">{lang === 'en' ? "Other" : "Khác"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t("split_bill.modal_expense_paid_by", "Người đã trả tiền trước *")}
                  </label>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all cursor-pointer font-medium"
                  >
                    {currentGroup.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.isCurrentUser ? (lang === 'en' ? "(You)" : "(Bạn)") : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t("split_bill.modal_expense_date", "Ngày chi")}
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t("split_bill.modal_expense_participants", "Thành viên cùng chia khoản này")} ({selectedParticipants.length}/
                    {currentGroup.members.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedParticipants.length === currentGroup.members.length) {
                        setSelectedParticipants([]);
                      } else {
                        setSelectedParticipants(currentGroup.members.map((m) => m.id));
                      }
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
                  >
                    {selectedParticipants.length === currentGroup.members.length
                      ? t("split_bill.modal_expense_deselect_all", "Bỏ chọn tất cả")
                      : t("split_bill.modal_expense_select_all", "Chọn tất cả")}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  {currentGroup.members.map((m) => {
                    const isChecked = selectedParticipants.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 shadow-2xs font-semibold"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400 border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParticipants([...selectedParticipants, m.id]);
                            } else {
                              setSelectedParticipants(
                                selectedParticipants.filter((id) => id !== m.id)
                              );
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-indigo-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="truncate">{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  {t("action.cancel", "Hủy")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow-sm cursor-pointer transition-all"
                >
                  {t("split_bill.modal_expense_save_btn", "Lưu khoản chi")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
