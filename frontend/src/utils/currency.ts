export type CurrencyCode = "VND" | "USD" | "EUR" | "JPY" | "GBP";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  symbolPosition: "before" | "after";
  decimals: number;
  rateToVnd: number; // 1 đơn vị ngoại tệ = X VND
}

export const DEFAULT_CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  VND: {
    code: "VND",
    symbol: "đ",
    name: "Việt Nam Đồng",
    flag: "🇻🇳",
    symbolPosition: "after",
    decimals: 0,
    rateToVnd: 1,
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "Đô la Mỹ",
    flag: "🇺🇸",
    symbolPosition: "before",
    decimals: 2,
    rateToVnd: 25450,
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Đồng Euro",
    flag: "🇪🇺",
    symbolPosition: "before",
    decimals: 2,
    rateToVnd: 27600,
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    name: "Yên Nhật",
    flag: "🇯🇵",
    symbolPosition: "before",
    decimals: 0,
    rateToVnd: 168,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "Bảng Anh",
    flag: "🇬🇧",
    symbolPosition: "before",
    decimals: 2,
    rateToVnd: 32800,
  },
};

const STORAGE_RATES_KEY = "fintrack_currency_rates";

/**
 * Lấy danh sách tỷ giá hiện hành (kết hợp localStorage nếu người dùng tùy chỉnh)
 */
export function getActiveCurrencies(): Record<CurrencyCode, CurrencyInfo> {
  try {
    const raw = localStorage.getItem(STORAGE_RATES_KEY);
    if (!raw) return DEFAULT_CURRENCIES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CURRENCIES, ...parsed };
  } catch {
    return DEFAULT_CURRENCIES;
  }
}

/**
 * Lưu cập nhật tỷ giá vào localStorage
 */
export function saveCurrencyRates(rates: Record<CurrencyCode, CurrencyInfo>): void {
  try {
    localStorage.setItem(STORAGE_RATES_KEY, JSON.stringify(rates));
  } catch {
    // ignore
  }
}

/**
 * Quy đổi từ bất kỳ loại tiền tệ nào về VND
 */
export function convertToVnd(amount: number, fromCurrency: string = "VND"): number {
  if (!amount || isNaN(amount)) return 0;
  const rates = getActiveCurrencies();
  const code = (fromCurrency.toUpperCase() as CurrencyCode) || "VND";
  const info = rates[code] || DEFAULT_CURRENCIES.VND;
  return amount * info.rateToVnd;
}

/**
 * Quy đổi giữa 2 đồng tiền bất kỳ
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string = "VND",
  toCurrency: string = "VND"
): number {
  if (!amount || isNaN(amount)) return 0;
  const rates = getActiveCurrencies();
  const fromCode = (fromCurrency.toUpperCase() as CurrencyCode) || "VND";
  const toCode = (toCurrency.toUpperCase() as CurrencyCode) || "VND";

  const amountInVnd = amount * (rates[fromCode]?.rateToVnd ?? 1);
  const targetRate = rates[toCode]?.rateToVnd ?? 1;
  return targetRate > 0 ? amountInVnd / targetRate : amountInVnd;
}

/**
 * Format số tiền đẹp theo quy chuẩn từng quốc gia
 * Ví dụ:
 * - VND: 25.000.000 đ
 * - USD: $1,250.50
 * - EUR: €1,250.50
 * - JPY: ¥50,000
 */
export function formatMoney(
  amount: number,
  currencyCode: string = "VND",
  showEquivalentVnd: boolean = false
): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "0 đ";

  const rates = getActiveCurrencies();
  const code = (currencyCode.toUpperCase() as CurrencyCode) || "VND";
  const info = rates[code] || DEFAULT_CURRENCIES.VND;

  // Use en-US for foreign currencies (USD, EUR, GBP, JPY) to output commas for thousands and dots for decimals
  const numLocale = code === "VND" ? "vi-VN" : "en-US";
  const formattedNum = amount.toLocaleString(numLocale, {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  });

  let result = "";
  if (info.symbolPosition === "before") {
    result = `${info.symbol}${formattedNum}`;
  } else {
    result = `${formattedNum} ${info.symbol}`;
  }

  if (showEquivalentVnd && code !== "VND") {
    const vndVal = convertToVnd(amount, code);
    const vndFormatted = vndVal.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
    result += ` (≈ ${vndFormatted} đ)`;
  }

  return result;
}
