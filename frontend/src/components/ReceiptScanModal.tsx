import React, { useState, useRef } from "react";
import { CategoryModel } from "../services/api";
import {
  ParsedReceipt,
  parseReceiptText,
  performReceiptOcr,
  SAMPLE_RECEIPTS,
  SampleReceipt,
} from "../utils/receiptOcr";

interface ReceiptScanModalProps {
  categories: CategoryModel[];
  onClose: () => void;
  onApplyReceipt: (data: {
    amount: number;
    description: string;
    date: string;
    categoryId?: number;
  }) => void;
}

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  categories,
  onClose,
  onApplyReceipt,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  // Form edit states sau khi OCR
  const [merchantInput, setMerchantInput] = useState("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [dateInput, setDateInput] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý khi người dùng chọn file ảnh từ máy tính
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP).");
      return;
    }

    setError(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setSelectedImage(objectUrl);
    startOcrProcess(file);
  };

  // Xử lý khi chọn mẫu thử nghiệm nhanh (Sample Receipts)
  const handleSelectSample = (sample: SampleReceipt) => {
    setError(null);
    setSelectedFile(null);
    setSelectedImage(`data:image/svg+xml;utf8,${encodeURIComponent(sample.previewImageSvg)}`);

    setIsScanning(true);
    setScanProgress(15);
    setScanStatusText("Đang phân tích cấu trúc hóa đơn...");

    // Giả lập hiệu ứng quét laser sinh động
    const timer1 = setTimeout(() => {
      setScanProgress(60);
      setScanStatusText("Đang nhận diện số tiền và ngày giờ...");
    }, 600);

    const timer2 = setTimeout(() => {
      setScanProgress(100);
      setIsScanning(false);

      const parsed = parseReceiptText(sample.simulatedText, categories);
      // Gán kết quả mẫu
      parsed.merchant = sample.merchant;
      parsed.amount = sample.amount;
      parsed.date = sample.date;

      setParsedResult(parsed);
      setMerchantInput(parsed.merchant);
      setAmountInput(String(parsed.amount));
      setDateInput(parsed.date);
      if (parsed.suggestedCategory) {
        setSelectedCatId(String(parsed.suggestedCategory.id));
      }
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  // Chạy OCR thật bằng Tesseract.js
  const startOcrProcess = async (file: File) => {
    setIsScanning(true);
    setScanProgress(5);
    setScanStatusText("Đang khởi tạo bộ máy quang học OCR...");
    setError(null);

    try {
      const { rawText } = await performReceiptOcr(file, (p, status) => {
        setScanProgress(p);
        setScanStatusText(status);
      });

      const parsed = parseReceiptText(rawText, categories);
      setParsedResult(parsed);
      setMerchantInput(parsed.merchant);
      setAmountInput(parsed.amount > 0 ? String(parsed.amount) : "");
      setDateInput(parsed.date);
      if (parsed.suggestedCategory) {
        setSelectedCatId(String(parsed.suggestedCategory.id));
      }
    } catch (err) {
      console.warn("Lỗi OCR trực tiếp, chuyển sang phân tích cục bộ:", err);
      // Fallback: nếu mạng chậm hoặc lỗi web worker, vẫn cho phép người dùng nhập thủ công trên ảnh
      const fallbackParsed: ParsedReceipt = {
        merchant: "Hóa đơn mua sắm",
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        rawText: "Không nhận dạng được văn bản tự động từ ảnh mờ hoặc mạng chậm.",
        suggestedCategory: null,
        items: [],
      };
      setParsedResult(fallbackParsed);
      setMerchantInput(fallbackParsed.merchant);
      setAmountInput("");
      setDateInput(fallbackParsed.date);
      setError("Không thể nhận diện tự động toàn bộ chữ. Bạn có thể xem ảnh và chỉnh sửa nhanh thông tin bên dưới.");
    } finally {
      setIsScanning(false);
    }
  };

  // Bấm Áp dụng vào biểu mẫu giao dịch
  const handleApply = () => {
    const finalAmount = parseFloat(amountInput);
    if (!amountInput || isNaN(finalAmount) || finalAmount <= 0) {
      setError("Vui lòng nhập số tiền hợp lệ lớn hơn 0.");
      return;
    }

    onApplyReceipt({
      amount: finalAmount,
      description: merchantInput.trim() || "Chi tiêu hóa đơn",
      date: dateInput || new Date().toISOString().slice(0, 10),
      categoryId: selectedCatId ? Number(selectedCatId) : undefined,
    });
    onClose();
  };

  const handleResetScan = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setParsedResult(null);
    setError(null);
    setScanProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-[19px] text-cyan-300">
                document_scanner
              </span>
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base leading-tight">
                Quét Hóa Đơn Tự Động (OCR Receipt)
              </h3>
              <p className="text-[11px] text-slate-300">
                Tự động bóc tách số tiền, ngày giao dịch và tên cửa hàng từ ảnh chụp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: CHƯA CÓ ẢNH -> MÀN HÌNH CHỌN ẢNH & TEMPLATES */}
          {!selectedImage && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/40 rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all group bg-slate-50/50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <span className="material-symbols-outlined text-[32px]">
                    add_photo_alternate
                  </span>
                </div>
                <h4 className="font-display font-bold text-slate-900 text-base mb-1">
                  Chọn ảnh hóa đơn hoặc kéo thả vào đây
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Hỗ trợ định dạng JPG, PNG hoặc WebP. Hệ thống sẽ tự động nhận diện chữ tiếng Việt &amp; các con số.
                </p>
                <span className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs group-hover:bg-indigo-600 transition-colors">
                  Tải ảnh từ máy tính
                </span>
              </div>

              {/* Mẫu hóa đơn thử nghiệm nhanh (Quick Demo) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">
                    electric_bolt
                  </span>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Hoặc thử nghiệm nhanh với hóa đơn mẫu có sẵn:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SAMPLE_RECEIPTS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 transition-all text-left flex flex-col justify-between group shadow-2xs cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            Mẫu thử
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-indigo-600 transition-colors">
                            arrow_forward
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-900 text-xs truncate">
                          {sample.name}
                        </h5>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {sample.merchant}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between text-xs">
                        <span className="text-slate-400 text-[10px]">Số tiền:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {sample.amount.toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ĐÃ CHỌN ẢNH -> HIỂN THỊ PREVIEW VÀ TIẾN TRÌNH QUÉT OCR */}
          {selectedImage && isScanning && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              {/* Laser scan animation container */}
              <div className="relative w-64 h-80 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-xl bg-slate-950 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Receipt Preview"
                  className="w-full h-full object-contain opacity-70"
                />
                {/* Laser Line */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-300 to-cyan-400 shadow-[0_0_15px_#22d3ee] animate-bounce" />
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-cyan-950/20 pointer-events-none" />
              </div>

              {/* Progress Bar & Status */}
              <div className="w-full max-w-sm space-y-2 text-center">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{scanStatusText || "Đang bóc tách thông tin hóa đơn..."}</span>
                  <span className="font-mono text-indigo-600">{scanProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HOÀN THÀNH QUÉT -> HIỂN THỊ KẾT QUẢ VÀ FORM ĐIỀN */}
          {selectedImage && !isScanning && parsedResult && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Cột trái: Ảnh hóa đơn Preview */}
              <div className="md:col-span-5 space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm max-h-[360px] flex items-center justify-center">
                  <img
                    src={selectedImage}
                    alt="Receipt"
                    className="w-full h-full object-contain max-h-[360px]"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold backdrop-blur-xs shadow-xs">
                      Đã quét OCR
                    </span>
                  </div>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70 truncate">
                    <span className="material-symbols-outlined text-[14px] text-slate-400">image</span>
                    <span className="truncate font-medium">{selectedFile.name}</span>
                    <span className="shrink-0 text-slate-400">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">refresh</span>
                    <span>Quét ảnh khác</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                    title="Xem văn bản thô bóc tách được"
                  >
                    <span className="material-symbols-outlined text-[15px]">notes</span>
                    <span>Text thô</span>
                  </button>
                </div>

                {showRawText && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed animate-in fade-in duration-150">
                    {parsedResult.rawText || "Không có văn bản thô."}
                  </div>
                )}
              </div>

              {/* Cột phải: Thông tin bóc tách được (có thể chỉnh sửa) */}
              <div className="md:col-span-7 space-y-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px] text-indigo-600">
                      check_circle
                    </span>
                    <span>Dữ Liệu Đã Bóc Tách</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Vui lòng kiểm tra lại trước khi lưu
                  </span>
                </div>

                {/* Tên cửa hàng / Ghi chú */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Cửa hàng / Mô tả giao dịch <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={merchantInput}
                    onChange={(e) => setMerchantInput(e.target.value)}
                    placeholder="Ví dụ: Highlands Coffee, WinMart..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Số tiền thanh toán */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Tổng số tiền (VNĐ) <span className="text-rose-500">*</span>
                    </label>
                    {amountInput && !isNaN(parseFloat(amountInput)) && (
                      <span className="text-[11px] font-bold text-emerald-600 font-mono">
                        {parseFloat(amountInput).toLocaleString("vi-VN")} đ
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="Nhập số tiền..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Ngày giao dịch */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Ngày trên hóa đơn <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Danh mục tự động đề xuất */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Danh mục chi tiêu
                    </label>
                    {parsedResult.suggestedCategory && (
                      <span className="text-[10px] text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                        ✨ Tự động nhận diện
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Chọn danh mục phù hợp --</option>
                    {categories
                      .filter((c) => c.type === "EXPENSE")
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      post_add
                    </span>
                    <span>Điền vào biểu mẫu giao dịch</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
