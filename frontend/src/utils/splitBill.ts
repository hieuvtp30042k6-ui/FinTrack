export interface GroupMember {
  id: string;
  name: string;
  avatarColor?: string;
  isCurrentUser?: boolean;
}

export type SplitType = "EQUAL" | "EXACT" | "SHARES";

export interface ExpenseSplit {
  memberId: string;
  amount: number;
  shares?: number;
}

export interface GroupExpense {
  id: string;
  title: string;
  amount: number;
  paidByMemberId: string;
  date: string; // YYYY-MM-DD
  category?: string;
  splitType: SplitType;
  splits: ExpenseSplit[]; // danh sách phân bổ chi phí cho từng member
  note?: string;
}

export interface GroupSettlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  settledAt: string; // YYYY-MM-DD
  note?: string;
}

export interface SplitGroup {
  id: string;
  name: string;
  description?: string;
  icon: string;
  currency: string;
  createdAt: string;
  members: GroupMember[];
  expenses: GroupExpense[];
  settlements: GroupSettlement[];
}

export interface MemberBalance {
  member: GroupMember;
  paidTotal: number;
  owedTotal: number;
  netBalance: number; // > 0: cần nhận lại, < 0: đang nợ, === 0: đã cân bằng
}

export interface SettlementTransfer {
  fromMember: GroupMember;
  toMember: GroupMember;
  amount: number;
}

const STORAGE_KEY = "fintrack_split_groups";

const MEMBER_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-purple-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-teal-600",
];

export function getRandomColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

/**
 * Tính toán số dư ròng (Net Balance) của từng thành viên trong nhóm
 */
export function calculateMemberBalances(group: SplitGroup): MemberBalance[] {
  const map: Record<
    string,
    { paid: number; owed: number }
  > = {};

  // Khởi tạo map cho tất cả members
  for (const m of group.members) {
    map[m.id] = { paid: 0, owed: 0 };
  }

  // 1. Cộng dồn các khoản chi chung
  for (const exp of group.expenses) {
    // Người trả tiền
    if (map[exp.paidByMemberId]) {
      map[exp.paidByMemberId].paid += exp.amount;
    }

    // Những người chịu tiền
    for (const s of exp.splits) {
      if (map[s.memberId]) {
        map[s.memberId].owed += s.amount;
      }
    }
  }

  // 2. Tính đến các khoản tất toán nợ đã thực hiện (Settlements)
  for (const set of group.settlements) {
    // fromMemberId đã trả bớt tiền nợ cho toMemberId
    if (map[set.fromMemberId]) {
      map[set.fromMemberId].paid += set.amount;
    }
    if (map[set.toMemberId]) {
      map[set.toMemberId].owed += set.amount;
    }
  }

  return group.members.map((m) => {
    const data = map[m.id] || { paid: 0, owed: 0 };
    return {
      member: m,
      paidTotal: data.paid,
      owedTotal: data.owed,
      netBalance: Math.round(data.paid - data.owed),
    };
  });
}

/**
 * Thuật toán tối ưu hóa bù trừ nợ (Greedy Debt Simplification Algorithm)
 * Giảm thiểu số giao dịch thanh toán trực tiếp giữa các thành viên
 */
export function calculateOptimalSettlements(group: SplitGroup): SettlementTransfer[] {
  const balances = calculateMemberBalances(group);

  // Tách thành 2 nhóm: Người nợ (netBalance < 0) và Người cần nhận lại (netBalance > 0)
  interface BalanceNode {
    member: GroupMember;
    amount: number;
  }

  const debtors: BalanceNode[] = [];
  const creditors: BalanceNode[] = [];

  for (const b of balances) {
    if (b.netBalance < -1) {
      debtors.push({ member: b.member, amount: -b.netBalance });
    } else if (b.netBalance > 1) {
      creditors.push({ member: b.member, amount: b.netBalance });
    }
  }

  // Sắp xếp giảm dần theo số tiền
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 1) {
      transfers.push({
        fromMember: debtor.member,
        toMember: creditor.member,
        amount: Math.round(settleAmount),
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount <= 1) {
      dIdx++;
    }
    if (creditor.amount <= 1) {
      cIdx++;
    }
  }

  return transfers;
}

/**
 * Tạo văn bản tổng kết chi phí để copy gửi nhóm Zalo / Messenger
 */
export function generateSettlementSummaryText(group: SplitGroup): string {
  const totalExpense = group.expenses.reduce((s, e) => s + e.amount, 0);
  const settlements = calculateOptimalSettlements(group);
  const balances = calculateMemberBalances(group);

  let text = `📊 TỔNG KẾT CHI TIÊU NHÓM: ${group.name.toUpperCase()}\n`;
  if (group.description) text += `📌 Mô tả: ${group.description}\n`;
  text += `💰 Tổng chi phí cả nhóm: ${totalExpense.toLocaleString("vi-VN")} ${group.currency}\n`;
  text += `👥 Số thành viên: ${group.members.length} người\n`;
  text += `----------------------------------------\n`;
  text += `👤 CHI TIẾT TỪNG THÀNH VIÊN:\n`;

  for (const b of balances) {
    const statusText =
      b.netBalance > 0
        ? `cần nhận lại +${b.netBalance.toLocaleString("vi-VN")} ${group.currency}`
        : b.netBalance < 0
        ? `cần trả -${Math.abs(b.netBalance).toLocaleString("vi-VN")} ${group.currency}`
        : `đã cân bằng`;
    text += `- ${b.member.name}: Đã chi ${b.paidTotal.toLocaleString("vi-VN")} đ ➔ ${statusText}\n`;
  }

  text += `----------------------------------------\n`;
  text += `💸 HƯỚNG DẪN CHUYỂN KHOẢN TẤT TOÁN:\n`;

  if (settlements.length === 0) {
    text += `✅ Tất cả các thành viên đã thanh toán cân bằng! Không còn khoản nợ nào.\n`;
  } else {
    for (const s of settlements) {
      text += `👉 ${s.fromMember.name} chuyển cho ${s.toMember.name}: ${s.amount.toLocaleString("vi-VN")} ${group.currency}\n`;
    }
  }

  text += `----------------------------------------\n`;
  text += `✨ Được tính toán tự động bởi FinTrack Split Bill`;

  return text;
}

/**
 * Đọc danh sách nhóm từ localStorage
 */
export function getSavedGroups(): SplitGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSampleGroups();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultSampleGroups();
  } catch {
    return getDefaultSampleGroups();
  }
}

/**
 * Lưu danh sách nhóm vào localStorage
 */
export function saveGroups(groups: SplitGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (err) {
    console.error("Không thể lưu split groups vào localStorage:", err);
  }
}

/**
 * Dữ liệu mẫu sinh động ban đầu cho người dùng trải nghiệm ngay
 */
function getDefaultSampleGroups(): SplitGroup[] {
  return [
    {
      id: "group_dalat_trip",
      name: "Chuyến đi Đà Lạt 3N2Đ",
      description: "Chuyến du lịch nghỉ dưỡng cùng nhóm bạn đại học",
      icon: "flight_takeoff",
      currency: "VND",
      createdAt: "2026-09-28",
      members: [
        { id: "m_user", name: "Bạn", isCurrentUser: true, avatarColor: "bg-blue-600" },
        { id: "m_nam", name: "Hoàng Nam", avatarColor: "bg-emerald-600" },
        { id: "m_linh", name: "Khánh Linh", avatarColor: "bg-purple-600" },
        { id: "m_tuan", name: "Anh Tuấn", avatarColor: "bg-amber-600" },
      ],
      expenses: [
        {
          id: "exp_1",
          title: "Homestay đồi thông 2 đêm",
          amount: 2400000,
          paidByMemberId: "m_user", // Bạn trả
          date: "2026-09-28",
          category: "Nhà ở",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 600000 },
            { memberId: "m_nam", amount: 600000 },
            { memberId: "m_linh", amount: 600000 },
            { memberId: "m_tuan", amount: 600000 },
          ],
        },
        {
          id: "exp_2",
          title: "Bữa tối lẩu gà lá é & đồ nướng BBQ",
          amount: 1200000,
          paidByMemberId: "m_nam", // Hoàng Nam trả
          date: "2026-09-29",
          category: "Ăn uống",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 300000 },
            { memberId: "m_nam", amount: 300000 },
            { memberId: "m_linh", amount: 300000 },
            { memberId: "m_tuan", amount: 300000 },
          ],
        },
        {
          id: "exp_3",
          title: "Vé tham quan & Cà phê Mây",
          amount: 600000,
          paidByMemberId: "m_linh", // Khánh Linh trả
          date: "2026-09-30",
          category: "Giải trí",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 150000 },
            { memberId: "m_nam", amount: 150000 },
            { memberId: "m_linh", amount: 150000 },
            { memberId: "m_tuan", amount: 150000 },
          ],
        },
        {
          id: "exp_4",
          title: "Thuê xe máy 3 ngày di chuyển",
          amount: 900000,
          paidByMemberId: "m_tuan", // Anh Tuấn trả
          date: "2026-09-28",
          category: "Đi lại",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 225000 },
            { memberId: "m_nam", amount: 225000 },
            { memberId: "m_linh", amount: 225000 },
            { memberId: "m_tuan", amount: 225000 },
          ],
        },
        {
          id: "exp_5",
          title: "Mua quà đặc sản Đà Lạt (Atiso, mứt dâu)",
          amount: 800000,
          paidByMemberId: "m_user",
          date: "2026-09-30",
          category: "Mua sắm",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 200000 },
            { memberId: "m_nam", amount: 200000 },
            { memberId: "m_linh", amount: 200000 },
            { memberId: "m_tuan", amount: 200000 },
          ],
        },
        {
          id: "exp_6",
          title: "Bữa trưa cơm niêu Như Ngọc",
          amount: 520000,
          paidByMemberId: "m_nam",
          date: "2026-09-29",
          category: "Ăn uống",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 130000 },
            { memberId: "m_nam", amount: 130000 },
            { memberId: "m_linh", amount: 130000 },
            { memberId: "m_tuan", amount: 130000 },
          ],
        },
        {
          id: "exp_7",
          title: "Xăng xe và phụ phí cầu đường",
          amount: 280000,
          paidByMemberId: "m_tuan",
          date: "2026-09-28",
          category: "Đi lại",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 70000 },
            { memberId: "m_nam", amount: 70000 },
            { memberId: "m_linh", amount: 70000 },
            { memberId: "m_tuan", amount: 70000 },
          ],
        },
      ],
      settlements: [
        {
          id: "set_sample_1",
          fromMemberId: "m_tuan",
          toMemberId: "m_user",
          amount: 250000,
          settledAt: "2026-09-30",
          note: "Chuyển khoản tiền cọc homestay",
        },
      ],
    },
    {
      id: "group_lunch_club",
      name: "Ăn Trưa & Coffee Văn Phòng",
      description: "Quỹ ăn trưa đồng nghiệp công ty hàng tuần",
      icon: "restaurant",
      currency: "VND",
      createdAt: "2026-10-01",
      members: [
        { id: "m_user", name: "Bạn", isCurrentUser: true, avatarColor: "bg-blue-600" },
        { id: "m_mai", name: "Thanh Mai", avatarColor: "bg-rose-600" },
        { id: "m_huy", name: "Quốc Huy", avatarColor: "bg-cyan-600" },
        { id: "m_lan", name: "Ngọc Lan", avatarColor: "bg-emerald-600" },
        { id: "m_duc", name: "Minh Đức", avatarColor: "bg-amber-600" },
        { id: "m_hoa", name: "Bích Hoa", avatarColor: "bg-purple-600" },
      ],
      expenses: [
        {
          id: "exp_lunch_1",
          title: "Cơm tấm sườn bì chả Kim Sa",
          amount: 360000,
          paidByMemberId: "m_mai",
          date: "2026-10-01",
          category: "Ăn uống",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 60000 },
            { memberId: "m_mai", amount: 60000 },
            { memberId: "m_huy", amount: 60000 },
            { memberId: "m_lan", amount: 60000 },
            { memberId: "m_duc", amount: 60000 },
            { memberId: "m_hoa", amount: 60000 },
          ],
        },
        {
          id: "exp_lunch_2",
          title: "Highlands Coffee buổi chiều",
          amount: 275000,
          paidByMemberId: "m_user",
          date: "2026-10-01",
          category: "Ăn uống",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 55000 },
            { memberId: "m_mai", amount: 55000 },
            { memberId: "m_huy", amount: 55000 },
            { memberId: "m_lan", amount: 55000 },
            { memberId: "m_duc", amount: 55000 },
          ],
        },
        {
          id: "exp_lunch_3",
          title: "Bún chả Hà Nội trưa thứ Tư",
          amount: 330000,
          paidByMemberId: "m_huy",
          date: "2026-10-02",
          category: "Ăn uống",
          splitType: "EQUAL",
          splits: [
            { memberId: "m_user", amount: 55000 },
            { memberId: "m_mai", amount: 55000 },
            { memberId: "m_huy", amount: 55000 },
            { memberId: "m_lan", amount: 55000 },
            { memberId: "m_duc", amount: 55000 },
            { memberId: "m_hoa", amount: 55000 },
          ],
        },
      ],
      settlements: [],
    },
  ];
}
