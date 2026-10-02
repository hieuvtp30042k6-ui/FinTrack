import { CategoryModel } from "../services/api";
import { detectCategoryFromNote } from "./autoCategorization";

export interface ParsedReceipt {
  merchant: string;
  amount: number;
  date: string; // YYYY-MM-DD
  rawText: string;
  suggestedCategory: CategoryModel | null;
  items: string[];
}

/**
 * Xóa dấu tiếng Việt và chuẩn hóa
 */
function normalizeText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Các thương hiệu phổ biến tại Việt Nam để ưu tiên nhận diện Merchant
 */
const KNOWN_MERCHANTS: { name: string; aliases: string[] }[] = [
  { name: "Highlands Coffee", aliases: ["highlands", "highland coffee"] },
  { name: "Phúc Long Tea & Coffee", aliases: ["phuc long", "phuclong"] },
  { name: "Starbucks Coffee", aliases: ["starbucks"] },
  { name: "The Coffee House", aliases: ["the coffee house", "tch"] },
  { name: "WinMart / WinMart+", aliases: ["winmart", "vinmart"] },
  { name: "Co.opmart", aliases: ["coopmart", "co.opmart", "coop mart"] },
  { name: "Bách Hóa Xanh", aliases: ["bach hoa xanh", "bachhoaxanh"] },
  { name: "Circle K", aliases: ["circle k", "circlek"] },
  { name: "7-Eleven", aliases: ["7-eleven", "7 eleven"] },
  { name: "FamilyMart", aliases: ["familymart", "family mart"] },
  { name: "Grab", aliases: ["grab", "grabcar", "grabbike", "grabfood"] },
  { name: "Be Group", aliases: ["be group", "be car", "be bike"] },
  { name: "Xanh SM", aliases: ["xanh sm", "vinfast taxi"] },
  { name: "Shopee", aliases: ["shopee"] },
  { name: "Tiki", aliases: ["tiki"] },
  { name: "Lazada", aliases: ["lazada"] },
  { name: "KFC Vietnam", aliases: ["kfc"] },
  { name: "Lotteria", aliases: ["lotteria"] },
  { name: "Jollibee", aliases: ["jollibee"] },
  { name: "Pizza Hut", aliases: ["pizza hut"] },
  { name: "Haidilao Hotpot", aliases: ["haidilao"] },
  { name: "Gogi House", aliases: ["gogi"] },
  { name: "Kichi Kichi", aliases: ["kichi"] },
  { name: "Pharmacity", aliases: ["pharmacity"] },
  { name: "Nhà thuốc Long Châu", aliases: ["long chau"] },
  { name: "EVN - Tiền điện", aliases: ["evn", "dien luc", "tong cong ty dien luc"] },
  { name: "Sawaco - Tiền nước", aliases: ["sawaco", "cap nuoc"] },
  { name: "Viettel Telecom", aliases: ["viettel"] },
  { name: "FPT Telecom", aliases: ["fpt telecom", "fpt"] },
];

/**
 * Phân tích nội dung thô (OCR raw text) để bóc tách thông tin hóa đơn
 */
export function parseReceiptText(
  rawText: string,
  categories: CategoryModel[] = []
): ParsedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let merchant = "";
  let amount = 0;
  let date = new Date().toISOString().slice(0, 10);
  const detectedItems: string[] = [];

  // 1. Nhận diện Tên cửa hàng (Merchant)
  for (const known of KNOWN_MERCHANTS) {
    for (const alias of known.aliases) {
      if (normalizeText(rawText).includes(normalizeText(alias))) {
        merchant = known.name;
        break;
      }
    }
    if (merchant) break;
  }

  // Nếu không khớp thương hiệu có sẵn, lấy dòng đầu tiên có chữ có ý nghĩa
  if (!merchant && lines.length > 0) {
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const candidate = lines[i];
      if (
        candidate.length >= 3 &&
        !/\d{6,}/.test(candidate) &&
        !normalizeText(candidate).includes("hoa don") &&
        !normalizeText(candidate).includes("phieu thanh toan") &&
        !normalizeText(candidate).includes("receipt")
      ) {
        merchant = candidate;
        break;
      }
    }
  }
  if (!merchant) {
    merchant = "Hóa đơn chi tiêu";
  }

  // 2. Nhận diện Ngày tháng (Date)
  // Các mẫu: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD/MM/YY
  const datePatterns = [
    /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](20\d{2})/, // 25/12/2026
    /(20\d{2})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/, // 2026-12-25
  ];

  for (const line of lines) {
    let matched = false;
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        if (match[3].length === 4) {
          // DD/MM/YYYY
          const d = match[1].padStart(2, "0");
          const m = match[2].padStart(2, "0");
          const y = match[3];
          date = `${y}-${m}-${d}`;
        } else {
          // YYYY/MM/DD
          const y = match[1];
          const m = match[2].padStart(2, "0");
          const d = match[3].padStart(2, "0");
          date = `${y}-${m}-${d}`;
        }
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  // 3. Nhận diện Số tiền thanh toán (Amount)
  // Tìm các dòng chứa từ khóa tổng tiền
  const totalKeywords = [
    "tong tien",
    "tong cong",
    "thanh toan",
    "total",
    "amount",
    "can thanh toan",
    "tien mat",
    "tien mat / cash",
    "thanh tien",
    "cong tien hang",
  ];

  let foundAmounts: { val: number; isTotalLine: boolean }[] = [];

  for (const line of lines) {
    const norm = normalizeText(line);
    const isTotal = totalKeywords.some((kw) => norm.includes(kw));

    // Tìm các cụm số có dạng: 150.000, 150,000, 150000, 150.000d, 150.000VND
    const numMatches = line.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d{4,})/g);
    if (numMatches) {
      for (const rawNum of numMatches) {
        // Chuẩn hóa: loại bỏ dấu chấm/phẩy ngăn cách hàng nghìn
        const clean = rawNum.replace(/[.,]/g, "");
        const val = parseFloat(clean);
        // Lọc các số vô lý (quá nhỏ < 1000 hoặc mã số điện thoại/mã vạch > 500 triệu)
        if (!isNaN(val) && val >= 1000 && val <= 500_000_000) {
          foundAmounts.push({ val, isTotalLine: isTotal });
        }
      }
    }
  }

  // Ưu tiên số tiền trên dòng có chữ "tổng tiền / thanh toán"
  const totalLineAmounts = foundAmounts.filter((a) => a.isTotalLine);
  if (totalLineAmounts.length > 0) {
    // Lấy số lớn nhất trên dòng tổng tiền
    amount = Math.max(...totalLineAmounts.map((a) => a.val));
  } else if (foundAmounts.length > 0) {
    // Nếu không tìm thấy dòng tổng tiền cụ thể, lấy số tiền lớn nhất
    amount = Math.max(...foundAmounts.map((a) => a.val));
  }

  // 4. Gợi ý Danh mục dựa trên Merchant hoặc nội dung hóa đơn
  const searchNote = `${merchant} ${rawText.slice(0, 300)}`;
  const matchCat = detectCategoryFromNote(searchNote, categories, "expense");

  return {
    merchant,
    amount,
    date,
    rawText,
    suggestedCategory: matchCat?.category || null,
    items: detectedItems,
  };
}

/**
 * Thực hiện nhận diện OCR ảnh bằng Tesseract.js
 */
export async function performReceiptOcr(
  imageSource: string | File,
  onProgress?: (progress: number, status: string) => void
): Promise<{ rawText: string }> {
  try {
    const Tesseract = await import("tesseract.js");

    const worker = await Tesseract.createWorker("vie+eng", 1, {
      logger: (m) => {
        if (onProgress && m.status) {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress(pct, m.status === "recognizing text" ? "Đang nhận diện ký tự..." : "Đang tải mô hình ngôn ngữ...");
        }
      },
    });

    const ret = await worker.recognize(imageSource);
    await worker.terminate();

    return { rawText: ret.data.text || "" };
  } catch (err) {
    console.error("OCR Error, falling back to local text parser:", err);
    throw new Error(err instanceof Error ? err.message : "Nhận diện ảnh thất bại.");
  }
}

/**
 * Hóa đơn mẫu để trải nghiệm nhanh một chạm
 */
export interface SampleReceipt {
  id: string;
  name: string;
  merchant: string;
  amount: number;
  date: string;
  categoryKeyword: string;
  previewImageSvg: string;
  simulatedText: string;
}

export const SAMPLE_RECEIPTS: SampleReceipt[] = [
  {
    id: "sample_highlands",
    name: "Highlands Coffee",
    merchant: "Highlands Coffee - Vincom",
    amount: 115000,
    date: "2026-10-01",
    categoryKeyword: "Highlands",
    previewImageSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420" fill="none">
      <rect width="300" height="420" rx="16" fill="#FFFDF8" stroke="#E2D9C8" stroke-width="2"/>
      <rect x="20" y="24" width="260" height="40" rx="8" fill="#B91C1C"/>
      <text x="150" y="49" fill="white" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">HIGHLANDS COFFEE</text>
      <text x="150" y="85" fill="#475569" font-family="monospace" font-size="11" text-anchor="middle">VINCOM CENTER - Q.1, TP.HCM</text>
      <text x="150" y="105" fill="#64748B" font-family="monospace" font-size="10" text-anchor="middle">Ngày: 01/10/2026 - Giờ: 09:30</text>
      <line x1="20" y1="125" x2="280" y2="125" stroke="#CBD5E1" stroke-dasharray="4 4"/>
      <text x="25" y="155" fill="#1E293B" font-family="monospace" font-size="11">1x Phin Sữa Đá (L)</text>
      <text x="275" y="155" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">45.000</text>
      <text x="25" y="185" fill="#1E293B" font-family="monospace" font-size="11">1x Trà Sen Vàng (L)</text>
      <text x="275" y="185" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">55.000</text>
      <text x="25" y="215" fill="#1E293B" font-family="monospace" font-size="11">1x Bánh Chuối</text>
      <text x="275" y="215" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">15.000</text>
      <line x1="20" y1="245" x2="280" y2="245" stroke="#CBD5E1" stroke-width="1.5"/>
      <text x="25" y="280" fill="#0F172A" font-family="sans-serif" font-size="13" font-weight="bold">TỔNG THANH TOÁN:</text>
      <text x="275" y="280" fill="#B91C1C" font-family="monospace" font-size="16" font-weight="bold" text-anchor="end">115.000 đ</text>
      <rect x="40" y="325" width="220" height="24" rx="4" fill="#F1F5F9"/>
      <text x="150" y="341" fill="#64748B" font-family="monospace" font-size="9" text-anchor="middle">MÃ GD: HLC-20261001-9821</text>
      <text x="150" y="380" fill="#94A3B8" font-family="sans-serif" font-size="10" text-anchor="middle">Cảm ơn quý khách và hẹn gặp lại!</text>
    </svg>`,
    simulatedText: `HIGHLANDS COFFEE
VINCOM CENTER - Q.1, TP.HCM
HÓA ĐƠN BÁN HÀNG
Ngày: 01/10/2026 - Giờ: 09:30
1x Phin Sữa Đá (L): 45.000
1x Trà Sen Vàng (L): 55.000
1x Bánh Chuối: 15.000
TỔNG CỘNG: 115.000 VNĐ
THANH TOÁN TIỀN MẶT: 115.000 VNĐ
CẢM ƠN QUÝ KHÁCH!`,
  },
  {
    id: "sample_winmart",
    name: "Siêu thị WinMart",
    merchant: "Siêu thị WinMart+",
    amount: 348000,
    date: "2026-10-01",
    categoryKeyword: "WinMart",
    previewImageSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420" fill="none">
      <rect width="300" height="420" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
      <rect x="20" y="24" width="260" height="40" rx="8" fill="#DC2626"/>
      <text x="150" y="49" fill="white" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">WINMART+ TIỆN LỢI</text>
      <text x="150" y="85" fill="#475569" font-family="monospace" font-size="11" text-anchor="middle">CỬA HÀNG 124 NGUYỄN HUỆ</text>
      <text x="150" y="105" fill="#64748B" font-family="monospace" font-size="10" text-anchor="middle">01/10/2026 18:45 - Thu ngân: 02</text>
      <line x1="20" y1="125" x2="280" y2="125" stroke="#CBD5E1" stroke-dasharray="4 4"/>
      <text x="25" y="155" fill="#1E293B" font-family="monospace" font-size="11">Sữa tươi TH True Milk 1L</text>
      <text x="275" y="155" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">38.000</text>
      <text x="25" y="180" fill="#1E293B" font-family="monospace" font-size="11">Dầu ăn Simply 1L</text>
      <text x="275" y="180" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">65.000</text>
      <text x="25" y="205" fill="#1E293B" font-family="monospace" font-size="11">Thịt heo xay 500g</text>
      <text x="275" y="205" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">85.000</text>
      <text x="25" y="230" fill="#1E293B" font-family="monospace" font-size="11">Gạo thơm ST25 5kg</text>
      <text x="275" y="230" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">160.000</text>
      <line x1="20" y1="255" x2="280" y2="255" stroke="#CBD5E1" stroke-width="1.5"/>
      <text x="25" y="285" fill="#0F172A" font-family="sans-serif" font-size="13" font-weight="bold">TỔNG TIỀN PHẢI TRẢ:</text>
      <text x="275" y="285" fill="#DC2626" font-family="monospace" font-size="16" font-weight="bold" text-anchor="end">348.000 đ</text>
      <rect x="40" y="325" width="220" height="24" rx="4" fill="#F1F5F9"/>
      <text x="150" y="341" fill="#64748B" font-family="monospace" font-size="9" text-anchor="middle">QUẸT THẺ TÍN DỤNG THÀNH CÔNG</text>
      <text x="150" y="380" fill="#94A3B8" font-family="sans-serif" font-size="10" text-anchor="middle">Hotline CSKH: 1800 6968</text>
    </svg>`,
    simulatedText: `SIÊU THỊ WINMART+
Đ/C: 124 NGUYỄN HUỆ, TP.HCM
HÓA ĐƠN THANH TOÁN
Ngày: 01/10/2026 - Giờ: 18:45
- Sữa tươi TH True Milk 1L: 38.000
- Dầu ăn Simply 1L: 65.000
- Thịt heo xay 500g: 85.000
- Gạo thơm ST25 5kg: 160.000
TỔNG CỘNG TIỀN HÀNG: 348.000
TỔNG THANH TOÁN: 348.000 VNĐ
THANH TOÁN THẺ VISA/MASTER: 348.000 VNĐ`,
  },
  {
    id: "sample_grab",
    name: "Chuyến đi GrabCar",
    merchant: "Grab Taxi / GrabCar",
    amount: 82000,
    date: "2026-10-01",
    categoryKeyword: "Grab",
    previewImageSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420" fill="none">
      <rect width="300" height="420" rx="16" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="2"/>
      <rect x="20" y="24" width="260" height="40" rx="8" fill="#16A34A"/>
      <text x="150" y="49" fill="white" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">GRAB E-RECEIPT</text>
      <text x="150" y="85" fill="#15803D" font-family="monospace" font-size="11" text-anchor="middle">CHUYẾN ĐI GRABCAR 4 CHỖ</text>
      <text x="150" y="105" fill="#64748B" font-family="monospace" font-size="10" text-anchor="middle">Thời gian: 01/10/2026 08:15</text>
      <line x1="20" y1="125" x2="280" y2="125" stroke="#CBD5E1" stroke-dasharray="4 4"/>
      <text x="25" y="155" fill="#1E293B" font-family="monospace" font-size="11">Cước phí di chuyển (6.8 km)</text>
      <text x="275" y="155" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">72.000</text>
      <text x="25" y="185" fill="#1E293B" font-family="monospace" font-size="11">Phí cầu đường / sân bay</text>
      <text x="275" y="185" fill="#1E293B" font-family="monospace" font-size="11" text-anchor="end">10.000</text>
      <line x1="20" y1="225" x2="280" y2="225" stroke="#CBD5E1" stroke-width="1.5"/>
      <text x="25" y="260" fill="#0F172A" font-family="sans-serif" font-size="13" font-weight="bold">TỔNG CƯỚC PHÍ:</text>
      <text x="275" y="260" fill="#16A34A" font-family="monospace" font-size="17" font-weight="bold" text-anchor="end">82.000 đ</text>
      <rect x="40" y="305" width="220" height="24" rx="4" fill="#DCFCE7"/>
      <text x="150" y="321" fill="#15803D" font-family="monospace" font-size="9" text-anchor="middle">ĐÃ TRỪ VÍ ĐIỆN TỬ MOCA/GRABPAY</text>
      <text x="150" y="375" fill="#94A3B8" font-family="sans-serif" font-size="10" text-anchor="middle">Cảm ơn bạn đã lựa chọn Grab!</text>
    </svg>`,
    simulatedText: `GRAB VIETNAM
BIÊN NHẬN ĐIỆN TỬ - GRABCAR
Ngày đi: 01/10/2026 08:15
Quãng đường: 6.8 km
- Cước phí chuyến đi: 72.000 VNĐ
- Phí phụ thu cầu đường: 10.000 VNĐ
TỔNG CƯỚC THANH TOÁN: 82.000 VNĐ
PHƯƠNG THỨC: VÍ ĐIỆN TỬ GRABPAY
TRẠNG THÁI: HOÀN TẤT`,
  },
];
