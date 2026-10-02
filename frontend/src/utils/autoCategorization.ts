import { CategoryModel } from "../services/api";

export interface CustomRule {
  id: string;
  keyword: string;
  categoryName: string;
  type?: "EXPENSE" | "INCOME";
}

// Bảng từ khóa mặc định phân theo nhóm danh mục phổ biến
const DEFAULT_KEYWORD_MAP: Record<string, string[]> = {
  // 1. Di chuyển / Đi lại
  "Di chuyển": [
    "grab", "be", "gojek", "xanh sm", "taxi", "xăng", "petrolimex", "pvoil",
    "gửi xe", "giữ xe", "vé xe", "vé tàu", "vé máy bay", "vietnam airlines",
    "vietjet", "bamboo", "bến xe", "cầu đường", "bot", "rửa xe", "bảo dưỡng xe",
    "thay nhớt", "đạp xe", "đi lại", "xe bus", "xe buýt"
  ],
  // 2. Ăn uống
  "Ăn uống": [
    "highlands", "phúc long", "phuclong", "starbucks", "the coffee house", "tch",
    "cơm", "phở", "bún", "bánh mì", "trà sữa", "gong cha", "koi thé", "mixue",
    "kfc", "lotteria", "jollibee", "mcdonald", "pizza", "pizza hut", "domino",
    "ăn trưa", "ăn tối", "ăn sáng", "nhà hàng", "buffet", "lẩu", "nướng", "haidilao",
    "manwah", "kichi", "gogi", "cafe", "cà phê", "nước ép", "sinh tố", "ăn vặt",
    "tiệm bánh", "bánh ngọt", "nhậu", "quán ăn", "đi chợ", "thực phẩm"
  ],
  // 3. Mua sắm
  "Mua sắm": [
    "shopee", "tiki", "lazada", "sendo", "tiktok shop", "siêu thị", "winmart",
    "coopmart", "co.opmart", "bách hóa xanh", "bachhoaxanh", "big c", "go!",
    "lotte mart", "aeon", "quần áo", "áo", "quần", "váy", "giày", "dép",
    "túi xách", "mỹ phẩm", "zara", "uniqlo", "h&m", "routine", "yame",
    "mua sắm", "shopping", "tạp hóa", "phụ kiện", "đồng hồ", "điện thoại"
  ],
  // 4. Hóa đơn & Tiện ích
  "Hóa đơn & Tiện ích": [
    "tiền điện", "evn", "tiền nước", "sawaco", "internet", "wifi", "viettel",
    "fpt", "vnpt", "cước điện thoại", "4g", "5g", "nạp thẻ", "nạp tiền đt",
    "hóa đơn", "rác", "vệ sinh", "tiện ích"
  ],
  // 5. Giải trí
  "Giải trí": [
    "netflix", "spotify", "youtube", "apple music", "cgv", "lotte cinema",
    "bhd", "galaxy cinema", "vé xem phim", "rạp chiếu phim", "game", "steam",
    "playstation", "nintendo", "du lịch", "khách sạn", "resort", "homestay",
    "booking", "agoda", "traveloka", "karaoke", "billiards", "bida", "sách",
    "truyện", "hội chợ", "concert", "vé ca nhạc"
  ],
  // 6. Nhà ở
  "Nhà ở": [
    "tiền nhà", "tiền phòng", "tiền thuê", "chung cư", "phí quản lý", "sửa nhà",
    "nội thất", "ikea", "điện gia dụng", "đồ gia dụng", "máy giặt", "tủ lạnh",
    "bếp", "bảo trì nhà"
  ],
  // 7. Sức khỏe & Y tế
  "Sức khỏe & Y tế": [
    "thuốc", "nhà thuốc", "pharmacity", "long châu", "an khang", "bệnh viện",
    "khám bệnh", "nha khoa", "khám răng", "niềng răng", "tiêm vắc xin", "bảo hiểm",
    "phòng gym", "gym", "yoga", "fitness", "thể thao", "vitamin", "thực phẩm chức năng"
  ],
  // 8. Tiền lương (INCOME)
  "Tiền lương": [
    "lương", "salary", "chuyển lương", "nhận lương", "lương tháng", "lương cứng",
    "công ty trả", "thu nhập chính"
  ],
  // 9. Tiền thưởng (INCOME)
  "Tiền thưởng": [
    "thưởng", "bonus", "thưởng dự án", "thưởng tết", "thưởng nóng", "khen thưởng",
    "hoa hồng", "commission"
  ],
  // 10. Đầu tư & Tiết kiệm (INCOME)
  "Đầu tư & Tiết kiệm": [
    "cổ tức", "lãi tiết kiệm", "lãi suất", "chứng khoán", "tiền lãi", "lợi nhuận",
    "đầu tư", "sinh lời", "bán tài sản"
  ],
};

const STORAGE_CUSTOM_RULES_KEY = "fintrack_custom_category_rules";

/**
 * Xóa dấu tiếng Việt và chuẩn hóa về chữ thường để so sánh không phân biệt dấu
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/**
 * Lấy danh sách quy tắc tùy chỉnh từ localStorage
 */
export function getCustomRules(): CustomRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_RULES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Lưu danh sách quy tắc tùy chỉnh vào localStorage
 */
export function saveCustomRules(rules: CustomRule[]): void {
  try {
    localStorage.setItem(STORAGE_CUSTOM_RULES_KEY, JSON.stringify(rules));
  } catch {
    // ignore
  }
}

export interface MatchResult {
  category: CategoryModel;
  matchedKeyword: string;
  ruleType: "custom" | "builtin";
}

/**
 * Tìm danh mục phù hợp nhất dựa trên từ khóa trong ghi chú (description)
 */
export function detectCategoryFromNote(
  note: string,
  categories: CategoryModel[],
  currentType?: "income" | "expense"
): MatchResult | null {
  if (!note || !note.trim() || categories.length === 0) return null;

  const normalizedNote = removeVietnameseTones(note);
  const words = normalizedNote.split(/\s+/);

  // 1. Kiểm tra Custom Rules của người dùng trước (Ưu tiên cao nhất)
  const customRules = getCustomRules();
  for (const rule of customRules) {
    const normKeyword = removeVietnameseTones(rule.keyword);
    if (normalizedNote.includes(normKeyword)) {
      // Tìm category khớp tên trong danh mục người dùng
      const matchedCat = categories.find((c) => {
        const sameName =
          removeVietnameseTones(c.name) === removeVietnameseTones(rule.categoryName) ||
          c.name.toLowerCase() === rule.categoryName.toLowerCase();
        const sameType = !currentType || c.type.toLowerCase() === currentType.toLowerCase();
        return sameName && sameType;
      });

      if (matchedCat) {
        return {
          category: matchedCat,
          matchedKeyword: rule.keyword,
          ruleType: "custom",
        };
      }
    }
  }

  // 2. Kiểm tra Default Keyword Map
  // Duyệt qua từng danh mục hệ thống/người dùng đang có
  for (const cat of categories) {
    if (currentType && cat.type.toLowerCase() !== currentType.toLowerCase()) {
      continue;
    }

    const normCatName = removeVietnameseTones(cat.name);

    // Tìm xem danh mục này có map với nhóm từ khóa nào không
    for (const [groupName, keywords] of Object.entries(DEFAULT_KEYWORD_MAP)) {
      const normGroupName = removeVietnameseTones(groupName);

      // Nếu tên danh mục khớp hoặc tương đương với nhóm (ví dụ: "Di chuyển" vs "Đi lại", "Ăn uống" vs "Nhà hàng")
      const isGroupMatch =
        normCatName.includes(normGroupName) ||
        normGroupName.includes(normCatName) ||
        (normCatName.includes("di chuyen") && normGroupName.includes("di chuyen")) ||
        (normCatName.includes("di lai") && normGroupName.includes("di chuyen")) ||
        (normCatName.includes("an uong") && normGroupName.includes("an uong")) ||
        (normCatName.includes("mua sam") && normGroupName.includes("mua sam")) ||
        (normCatName.includes("hoa don") && normGroupName.includes("hoa don")) ||
        (normCatName.includes("giai tri") && normGroupName.includes("giai tri")) ||
        (normCatName.includes("nha o") && normGroupName.includes("nha o")) ||
        (normCatName.includes("suc khoe") && normGroupName.includes("suc khoe")) ||
        (normCatName.includes("luong") && normGroupName.includes("luong")) ||
        (normCatName.includes("thuong") && normGroupName.includes("thuong")) ||
        (normCatName.includes("tiet kiem") && normGroupName.includes("tiet kiem"));

      if (isGroupMatch) {
        // Tìm từ khóa dài nhất khớp với note để độ chính xác cao nhất
        const matchedKw = keywords
          .filter((kw) => {
            const normKw = removeVietnameseTones(kw);
            // So khớp cụm từ hoặc từ đơn nguyên vẹn
            if (normKw.includes(" ")) {
              return normalizedNote.includes(normKw);
            }
            return (
              words.includes(normKw) ||
              normalizedNote.includes(` ${normKw} `) ||
              normalizedNote.startsWith(`${normKw} `) ||
              normalizedNote.endsWith(` ${normKw}`) ||
              normalizedNote === normKw
            );
          })
          .sort((a, b) => b.length - a.length)[0];

        if (matchedKw) {
          return {
            category: cat,
            matchedKeyword: matchedKw,
            ruleType: "builtin",
          };
        }
      }
    }
  }

  return null;
}
