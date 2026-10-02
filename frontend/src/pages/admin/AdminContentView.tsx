import React, { useState, useMemo, useEffect } from "react";
import { Pagination } from "../../components/Pagination";
import {
  FeedbackTicket,
  FaqItem,
  getStoredFeedbacks,
  replyToTicket,
  updateTicketStatus as updateFeedbackStatus,
  cleanupResolvedTickets,
  getStoredFaqs,
  saveStoredFaqs,
  FEEDBACK_CHANGE_EVENT,
} from "../../services/feedbackService";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "banner" | "modal" | "push";
  target: "all" | "new_users" | "active_users";
  priority: "normal" | "important" | "urgent";
  status: "active" | "scheduled" | "draft" | "expired";
  createdAt: string;
  expiresAt?: string;
  scheduledAt?: string;
  clicksCount: number;
}

interface PolicyVersion {
  version: string;
  title: string;
  effectiveDate: string;
  status: "published" | "draft" | "archived";
  requireReconsent: boolean;
  changeLog: string;
  content: string;
  updatedAt: string;
}

// ─── INITIAL MOCK DATA ───────────────────────────────────────────────────────

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ANN-001",
    title: "Bảo trì nâng cấp hạ tầng máy chủ định kỳ",
    content: "Hệ thống sẽ tiến hành bảo trì tối ưu cơ sở dữ liệu vào lúc 02:00 - 03:00 Chủ Nhật. Các giao dịch offline vẫn được lưu trữ bình thường.",
    type: "banner",
    target: "all",
    priority: "important",
    status: "active",
    createdAt: "2026-09-28",
    expiresAt: "2026-10-15",
    clicksCount: 342,
  },
  {
    id: "ANN-002",
    title: "Ra mắt tính năng Xuất báo cáo Excel nâng cao",
    content: "Người dùng giờ đây có thể tùy chỉnh phạm vi ngày và danh mục chi tiêu khi xuất báo cáo tài chính hàng tháng.",
    type: "modal",
    target: "active_users",
    priority: "normal",
    status: "active",
    createdAt: "2026-09-25",
    expiresAt: "2026-10-20",
    clicksCount: 890,
  },
  {
    id: "ANN-003",
    title: "Cập nhật ứng dụng phiên bản 2.5 với nhiều cải tiến",
    content: "Trải nghiệm giao diện mới mượt mà hơn, hỗ trợ quản lý ngân sách thông minh.",
    type: "push",
    target: "all",
    priority: "normal",
    status: "scheduled",
    scheduledAt: "2026-10-05 09:00",
    createdAt: "2026-10-01",
    expiresAt: "2026-11-01",
    clicksCount: 0,
  },
  {
    id: "ANN-004",
    title: "Khảo sát ý kiến đóng góp tính năng tài chính Quý 3",
    content: "Chương trình thu thập ý kiến người dùng về trải nghiệm phân loại danh mục tự động.",
    type: "modal",
    target: "all",
    priority: "normal",
    status: "expired",
    createdAt: "2026-08-01",
    expiresAt: "2026-08-31",
    clicksCount: 512,
  },
  {
    id: "ANN-005",
    title: "Cảnh báo bảo mật: Không chia sẻ mã OTP cho người lạ",
    content: "Khuyến cáo an toàn thông tin định kỳ bảo vệ tài khoản người dùng trước các hình thức lừa đảo.",
    type: "banner",
    target: "all",
    priority: "urgent",
    status: "expired",
    createdAt: "2026-07-15",
    expiresAt: "2026-08-15",
    clicksCount: 1420,
  },
];

const INITIAL_POLICIES: PolicyVersion[] = [
  {
    version: "v2.0",
    title: "Chính sách Bảo mật & Điều khoản Dịch vụ FinTrack 2026",
    effectiveDate: "2026-10-01",
    status: "published",
    requireReconsent: true,
    changeLog: "Cập nhật cam kết bảo vệ dữ liệu cá nhân, bổ sung quy định về lưu trữ mã hóa điện toán đám mây và quyền riêng tư giao dịch.",
    content: "1. Mục đích thu thập dữ liệu: FinTrack chỉ lưu trữ thông tin cần thiết phục vụ quản lý tài chính cá nhân người dùng...\n2. Bảo mật thông tin: Mọi thông tin nhạy cảm và mật khẩu được băm bằng thuật toán an toàn bcrypt...\n3. Quyền của người dùng: Người dùng có quyền xuất hoặc yêu cầu xóa toàn bộ dữ liệu tài khoản bất kỳ lúc nào...",
    updatedAt: "2026-10-01 09:00",
  },
  {
    version: "v1.2",
    title: "Điều khoản Dịch vụ FinTrack phiên bản 2025",
    effectiveDate: "2025-11-15",
    status: "archived",
    requireReconsent: false,
    changeLog: "Bổ sung điều khoản về tính năng chia sẻ ví gia đình.",
    content: "Nội dung phiên bản 1.2 lưu trữ lịch sử...",
    updatedAt: "2025-11-15 10:00",
  },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export const AdminContentView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"broadcast" | "faq" | "feedback" | "policy">("broadcast");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Broadcast state
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [isAddAnnModalOpen, setIsAddAnnModalOpen] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnContent, setNewAnnContent] = useState("");
  const [newAnnType, setNewAnnType] = useState<"banner" | "modal" | "push">("banner");
  const [newAnnTarget, setNewAnnTarget] = useState<"all" | "new_users" | "active_users">("all");
  const [newAnnPriority, setNewAnnPriority] = useState<"normal" | "important" | "urgent">("normal");

  // FAQ state
  const [faqs, setFaqs] = useState<FaqItem[]>(() => getStoredFaqs());
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>("all");
  const [faqSearch, setFaqSearch] = useState("");
  const [isAddFaqModalOpen, setIsAddFaqModalOpen] = useState(false);
  const [newFaqQuestion, setNewFaqQuestion] = useState("");
  const [newFaqAnswer, setNewFaqAnswer] = useState("");
  const [newFaqCategory, setNewFaqCategory] = useState<"account" | "wallet" | "report" | "security">("account");

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<FeedbackTicket[]>(() => getStoredFeedbacks());
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("all");
  const [feedbackSeverityFilter, setFeedbackSeverityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null);
  const [replyText, setReplyText] = useState("");

  // Đồng bộ feedback tickets theo thời gian thực (khi User gửi từ tab/trang khác)
  useEffect(() => {
    const handleFeedbackUpdate = () => {
      setFeedbacks(getStoredFeedbacks());
    };
    window.addEventListener(FEEDBACK_CHANGE_EVENT, handleFeedbackUpdate);
    window.addEventListener("storage", handleFeedbackUpdate);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGE_EVENT, handleFeedbackUpdate);
      window.removeEventListener("storage", handleFeedbackUpdate);
    };
  }, []);

  // Broadcast pagination & cleanup state
  const [annStatusFilter, setAnnStatusFilter] = useState<string>("all");
  const [annCurrentPage, setAnnCurrentPage] = useState<number>(1);
  const [annPageSize, setAnnPageSize] = useState<number>(6);
  const [newAnnExpiresAt, setNewAnnExpiresAt] = useState<string>("");

  // Feedback pagination state
  const [feedbackCurrentPage, setFeedbackCurrentPage] = useState<number>(1);
  const [feedbackPageSize, setFeedbackPageSize] = useState<number>(5);

  // Policy state
  const [policies, setPolicies] = useState<PolicyVersion[]>(INITIAL_POLICIES);
  const [editingPolicy, setEditingPolicy] = useState<PolicyVersion>(policies[0]);
  const [isPolicySaved, setIsPolicySaved] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Tự động về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setAnnCurrentPage(1);
  }, [annStatusFilter]);

  useEffect(() => {
    setFeedbackCurrentPage(1);
  }, [feedbackStatusFilter, feedbackSeverityFilter]);

  // ── Broadcast Handlers ──
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;

    const newAnn: Announcement = {
      id: `ANN-${String(announcements.length + 1).padStart(3, "0")}`,
      title: newAnnTitle.trim(),
      content: newAnnContent.trim(),
      type: newAnnType,
      target: newAnnTarget,
      priority: newAnnPriority,
      status: "active",
      createdAt: new Date().toISOString().slice(0, 10),
      expiresAt: newAnnExpiresAt || undefined,
      clicksCount: 0,
    };

    setAnnouncements([newAnn, ...announcements]);
    setIsAddAnnModalOpen(false);
    setNewAnnTitle("");
    setNewAnnContent("");
    setNewAnnExpiresAt("");
    showToast(`Đã phát hành thông báo "${newAnn.title}" tới người dùng!`);
  };

  const handleDeleteAnnouncement = (id: string) => {
    setAnnouncements(announcements.filter((a) => a.id !== id));
    showToast("Đã thu hồi và xóa thông báo thành công.");
  };

  const handleToggleAnnStatus = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === "active" ? "expired" : "active" } : a
      )
    );
    showToast("Đã cập nhật trạng thái phát thông báo.");
  };

  const handleCleanupExpiredAnnouncements = () => {
    const expiredList = announcements.filter((a) => a.status === "expired");
    if (expiredList.length === 0) {
      showToast("Không có thông báo hết hạn nào cần dọn dẹp.");
      return;
    }
    setAnnouncements((prev) => prev.filter((a) => a.status !== "expired"));
    showToast(`Đã dọn dẹp ${expiredList.length} thông báo hết hạn, giải phóng dung lượng CSDL thành công!`);
  };

  // ── FAQ Handlers ──
  const handleCreateFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;

    const newFaq: FaqItem = {
      id: `FAQ-${faqs.length + 1}`,
      category: newFaqCategory,
      question: newFaqQuestion.trim(),
      answer: newFaqAnswer.trim(),
      order: faqs.length + 1,
      isActive: true,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    const nextFaqs = [...faqs, newFaq];
    setFaqs(nextFaqs);
    saveStoredFaqs(nextFaqs);
    setIsAddFaqModalOpen(false);
    setNewFaqQuestion("");
    setNewFaqAnswer("");
    showToast("Đã thêm câu hỏi thường gặp mới!");
  };

  const handleDeleteFaq = (id: string) => {
    const nextFaqs = faqs.filter((f) => f.id !== id);
    setFaqs(nextFaqs);
    saveStoredFaqs(nextFaqs);
    showToast("Đã xóa câu hỏi thường gặp.");
  };

  const handleToggleFaqActive = (id: string) => {
    const nextFaqs = faqs.map((f) => (f.id === id ? { ...f, isActive: !f.isActive } : f));
    setFaqs(nextFaqs);
    saveStoredFaqs(nextFaqs);
  };

  // ── Feedback Handlers ──
  const handleSendReply = (ticketId: string) => {
    if (!replyText.trim()) return;
    const updated = replyToTicket(ticketId, replyText.trim());
    if (updated) {
      setFeedbacks(getStoredFeedbacks());
    }
    setSelectedTicket(null);
    setReplyText("");
    showToast(`Đã gửi phản hồi cho người dùng qua email và đánh dấu Đã giải quyết.`);
  };

  const handleUpdateTicketStatus = (ticketId: string, newStatus: FeedbackTicket["status"]) => {
    updateFeedbackStatus(ticketId, newStatus);
    setFeedbacks(getStoredFeedbacks());
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    showToast("Đã cập nhật trạng thái yêu cầu hỗ trợ.");
  };

  const handleCleanupResolvedFeedbacks = () => {
    const removedCount = cleanupResolvedTickets();
    if (removedCount === 0) {
      showToast("Không có phản hồi đã xử lý nào cần dọn dẹp.");
      return;
    }
    setFeedbacks(getStoredFeedbacks());
    showToast(`Đã dọn dẹp ${removedCount} phản hồi đã hoàn tất, giải phóng dung lượng CSDL thành công!`);
  };

  // ── Policy Handlers ──
  const handleSavePolicy = () => {
    setPolicies((prev) =>
      prev.map((p) => (p.version === editingPolicy.version ? { ...editingPolicy, updatedAt: new Date().toLocaleString("vi-VN") } : p))
    );
    setIsPolicySaved(true);
    showToast(`Đã lưu phiên bản điều khoản & chính sách [${editingPolicy.version}]!`);
    setTimeout(() => setIsPolicySaved(false), 3000);
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      if (annStatusFilter === "all") return true;
      if (annStatusFilter === "active") return a.status === "active";
      if (annStatusFilter === "expired") return a.status === "expired";
      if (annStatusFilter === "scheduled") return a.status === "scheduled";
      return true;
    });
  }, [announcements, annStatusFilter]);

  const paginatedAnnouncements = useMemo(() => {
    const start = (annCurrentPage - 1) * annPageSize;
    return filteredAnnouncements.slice(start, start + annPageSize);
  }, [filteredAnnouncements, annCurrentPage, annPageSize]);

  const filteredFaqs = faqs.filter((f) => {
    const matchCat = faqCategoryFilter === "all" || f.category === faqCategoryFilter;
    const matchSearch =
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.answer.toLowerCase().includes(faqSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((t) => {
      const matchStatus = feedbackStatusFilter === "all" || t.status === feedbackStatusFilter;
      const matchSev = feedbackSeverityFilter === "all" || t.severity === feedbackSeverityFilter;
      return matchStatus && matchSev;
    });
  }, [feedbacks, feedbackStatusFilter, feedbackSeverityFilter]);

  const paginatedFeedbacks = useMemo(() => {
    const start = (feedbackCurrentPage - 1) * feedbackPageSize;
    return filteredFeedbacks.slice(start, start + feedbackPageSize);
  }, [filteredFeedbacks, feedbackCurrentPage, feedbackPageSize]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab("broadcast")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "broadcast"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">campaign</span>
            <span>Thông báo hệ thống</span>
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded-full">
              {announcements.filter((a) => a.status === "active").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("faq")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "faq"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">quiz</span>
            <span>Câu hỏi thường gặp (FAQ)</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full">
              {faqs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("feedback")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "feedback"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">support_agent</span>
            <span>Phản hồi & Báo lỗi</span>
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded-full font-bold">
              {feedbacks.filter((t) => t.status === "new").length} mới
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("policy")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === "policy"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">policy</span>
            <span>Điều khoản & Bảo mật</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: THÔNG BÁO HỆ THỐNG (BROADCAST)                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "broadcast" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-800">campaign</span>
                Kênh thông báo & Truyền thông toàn hệ thống
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Gửi thông điệp, cảnh báo bảo trì hoặc tin tức tính năng mới đến toàn bộ người dùng app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddAnnModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Tạo thông báo mới</span>
            </button>
          </div>

          {/* Banner Chính Sách Lưu Trữ & Nút Dọn Dẹp CSDL */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900">
              <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0">auto_delete</span>
              <div>
                <span className="font-bold">Chính sách lưu trữ & giải phóng CSDL:</span>
                <span className="text-amber-800 ml-1">
                  Thông báo sau khi hết thời gian phát hành được lưu giữ <strong>30 ngày</strong> để tra cứu lịch sử, sau 30 ngày hệ thống sẽ tự động xóa vĩnh viễn để giải phóng dung lượng.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCleanupExpiredAnnouncements}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[15px]">cleaning_services</span>
              <span>Dọn dẹp thông báo hết hạn</span>
            </button>
          </div>

          {/* Bộ lọc trạng thái thông báo */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
            {(["all", "active", "expired", "scheduled"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setAnnStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  annStatusFilter === st
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st === "all"
                  ? `Tất cả (${announcements.length})`
                  : st === "active"
                  ? `Đang phát (${announcements.filter((a) => a.status === "active").length})`
                  : st === "expired"
                  ? `Hết hạn (${announcements.filter((a) => a.status === "expired").length})`
                  : `Lên lịch (${announcements.filter((a) => a.status === "scheduled").length})`}
              </button>
            ))}
          </div>

          {paginatedAnnouncements.length === 0 ? (
            <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300">notifications_off</span>
              Không có thông báo nào trong danh mục này.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {paginatedAnnouncements.map((ann) => {
                const isActive = ann.status === "active";
                return (
                  <div
                    key={ann.id}
                    className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                      isActive
                        ? "border-slate-200/90 shadow-xs hover:border-slate-300"
                        : "border-slate-200/50 bg-slate-50/50 opacity-80"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            ann.priority === "urgent"
                              ? "bg-rose-100 text-rose-700"
                              : ann.priority === "important"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {ann.priority === "urgent" ? "Khẩn cấp" : ann.priority === "important" ? "Quan trọng" : "Bình thường"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            isActive
                              ? "text-emerald-600"
                              : ann.status === "expired"
                              ? "text-rose-500"
                              : "text-slate-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-emerald-500" : ann.status === "expired" ? "bg-rose-500" : "bg-slate-400"
                            }`}
                          ></span>
                          <span>{isActive ? "Đang phát" : ann.status === "expired" ? "Hết hạn" : "Đã dừng"}</span>
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-sm font-display leading-snug">
                          {ann.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-3">
                          {ann.content}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                          <span className="material-symbols-outlined text-[12px]">
                            {ann.type === "banner" ? "view_headline" : ann.type === "modal" ? "wysiwyg" : "notifications"}
                          </span>
                          <span>{ann.type === "banner" ? "Banner trên cùng" : ann.type === "modal" ? "Popup In-app" : "Push Noti"}</span>
                        </span>

                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                          <span className="material-symbols-outlined text-[12px]">group</span>
                          <span>{ann.target === "all" ? "Tất cả user" : ann.target === "new_users" ? "User mới" : "Active users"}</span>
                        </span>

                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                          <span className="material-symbols-outlined text-[12px]">visibility</span>
                          <span>{ann.clicksCount} lượt xem</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400">
                      <div>
                        <p>Tạo: {ann.createdAt}</p>
                        {ann.expiresAt && <p className="text-amber-700 font-medium">Hạn: {ann.expiresAt}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAnnStatus(ann.id)}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={isActive ? "Tạm dừng phát" : "Kích hoạt phát lại"}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isActive ? "pause_circle" : "play_circle"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa thông báo"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Phân trang thông báo */}
          {filteredAnnouncements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <Pagination
                currentPage={annCurrentPage}
                totalItems={filteredAnnouncements.length}
                pageSize={annPageSize}
                onPageChange={setAnnCurrentPage}
                onPageSizeChange={setAnnPageSize}
                pageSizeOptions={[3, 6, 12, 24]}
                itemName="thông báo"
              />
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: CÂU HỎI THƯỜNG GẶP (FAQ)                                         */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "faq" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-800">quiz</span>
                  Trung tâm trợ giúp & Quản lý FAQ
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Biên soạn câu hỏi và giải đáp xuất hiện trên trang Trợ giúp / Hướng dẫn của người dùng.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddFaqModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Thêm câu hỏi mới</span>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm câu hỏi hoặc nội dung giải đáp..."
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <select
                value={faqCategoryFilter}
                onChange={(e) => setFaqCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden text-slate-700 font-medium"
              >
                <option value="all">Chủ đề: Tất cả danh mục</option>
                <option value="account">Tài khoản & Đăng nhập</option>
                <option value="wallet">Ví tiền & Giao dịch</option>
                <option value="report">Báo cáo & Phân tích</option>
                <option value="security">Bảo mật & Quyền riêng tư</option>
              </select>
            </div>
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {faq.category === "account"
                        ? "Tài khoản"
                        : faq.category === "wallet"
                        ? "Ví & Giao dịch"
                        : faq.category === "report"
                        ? "Báo cáo"
                        : "Bảo mật"}
                    </span>
                    <span className="text-[11px] text-slate-400">Thứ tự #{faq.order}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        faq.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {faq.isActive ? "Hiển thị" : "Đang ẩn"}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm font-display">
                    {faq.question}
                  </h4>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {faq.answer}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleFaqActive(faq.id)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title={faq.isActive ? "Ẩn khỏi danh sách" : "Bật hiển thị"}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {faq.isActive ? "visibility" : "visibility_off"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteFaq(faq.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Xóa câu hỏi"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PHẢN HỒI & BÁO LỖI (FEEDBACK & TICKETS)                          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "feedback" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-800">support_agent</span>
                  Tiếp nhận & Xử lý phản hồi từ người dùng
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Hộp thư tiếp nhận góp ý tính năng, báo cáo sự cố và khiếu nại tài khoản.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={feedbackStatusFilter}
                  onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden text-slate-700 font-medium"
                >
                  <option value="all">Trạng thái: Tất cả</option>
                  <option value="new">Mới tiếp nhận</option>
                  <option value="in_progress">Đang xử lý</option>
                  <option value="resolved">Đã giải quyết</option>
                </select>

                <select
                  value={feedbackSeverityFilter}
                  onChange={(e) => setFeedbackSeverityFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden text-slate-700 font-medium"
                >
                  <option value="all">Mức độ: Tất cả</option>
                  <option value="critical">Khẩn cấp</option>
                  <option value="high">Cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </div>
            </div>

            {/* Banner Chính Sách Lưu Trữ Phản Hồi & Giải Phóng CSDL */}
            <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-5">
              <div className="flex items-center gap-2.5 text-blue-900">
                <span className="material-symbols-outlined text-[20px] text-blue-600 shrink-0">cleaning_services</span>
                <div>
                  <span className="font-bold">Chính sách lưu trữ phản hồi đã giải quyết:</span>
                  <span className="text-blue-800 ml-1">
                    Phản hồi sau khi giải quyết xong được lưu giữ <strong>60 ngày</strong> để đối chiếu khi có khiếu nại, sau 60 ngày hệ thống sẽ tự động xóa vĩnh viễn để giải phóng dung lượng CSDL.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCleanupResolvedFeedbacks}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px]">auto_delete</span>
                <span>Dọn dẹp phản hồi đã xong</span>
              </button>
            </div>

            {/* Feedback Tickets List */}
            {paginatedFeedbacks.length === 0 ? (
              <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300">inbox</span>
                Không có phản hồi nào trong bộ lọc này.
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedFeedbacks.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-500">
                          #{ticket.id}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ticket.category === "bug"
                              ? "bg-rose-100 text-rose-700"
                              : ticket.category === "feature"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {ticket.category === "bug" ? "Báo lỗi" : ticket.category === "feature" ? "Góp ý tính năng" : "Trải nghiệm UX"}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ticket.severity === "high" || ticket.severity === "critical"
                              ? "bg-rose-50 text-rose-600 border border-rose-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          Mức: {ticket.severity}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            ticket.status === "new"
                              ? "bg-amber-100 text-amber-800"
                              : ticket.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ticket.status === "new" ? "bg-amber-500" : ticket.status === "in_progress" ? "bg-blue-500" : "bg-emerald-500"
                            }`}
                          ></span>
                          <span>{ticket.status === "new" ? "Mới tiếp nhận" : ticket.status === "in_progress" ? "Đang xử lý" : "Đã giải quyết"}</span>
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm font-display">
                        {ticket.title}
                      </h4>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        {ticket.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>Người gửi: <strong>{ticket.userName}</strong> ({ticket.userEmail})</span>
                        <span>•</span>
                        <span>Thiết bị: {ticket.device}</span>
                        <span>•</span>
                        <span>Thời gian: {ticket.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setReplyText(ticket.adminReply || "");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">reply</span>
                        <span>Xem & Trả lời</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Phân trang phản hồi */}
            {filteredFeedbacks.length > 0 && (
              <div className="pt-4 mt-2 border-t border-slate-100">
                <Pagination
                  currentPage={feedbackCurrentPage}
                  totalItems={filteredFeedbacks.length}
                  pageSize={feedbackPageSize}
                  onPageChange={setFeedbackCurrentPage}
                  onPageSizeChange={setFeedbackPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  itemName="phản hồi"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: ĐIỀU KHOẢN SỬ DỤNG & CHÍNH SÁCH BẢO MẬT                          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "policy" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-800">gavel</span>
                  Quản lý Điều khoản Sử dụng & Chính sách Bảo mật
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Định cấu hình các phiên bản điều khoản pháp lý và quy định chấp thuận của người dùng.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSavePolicy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{isPolicySaved ? "Đã lưu thành công!" : "Lưu phiên bản chính sách"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cột trái: Thông số phiên bản */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông tin phiên bản</h4>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã phiên bản (Version)</label>
                    <input
                      type="text"
                      value={editingPolicy.version}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, version: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Ngày bắt đầu hiệu lực</label>
                    <input
                      type="date"
                      value={editingPolicy.effectiveDate}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, effectiveDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Trạng thái công bố</label>
                    <select
                      value={editingPolicy.status}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, status: e.target.value as any })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden font-medium"
                    >
                      <option value="published">Đang áp dụng (Published)</option>
                      <option value="draft">Bản nháp (Draft)</option>
                      <option value="archived">Lưu trữ (Archived)</option>
                    </select>
                  </div>
                </div>

                {/* Switch Yêu cầu đồng ý lại (Critical requirement) */}
                <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-700 text-base">verified_user</span>
                      Yêu cầu đồng ý lại
                    </span>
                    <input
                      type="checkbox"
                      checked={editingPolicy.requireReconsent}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, requireReconsent: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Khi bật tùy chọn này, <strong>toàn bộ người dùng sẽ nhận thông báo popup</strong> yêu cầu xác nhận lại đồng ý với chính sách mới ở lần đăng nhập kế tiếp để tiếp tục sử dụng ứng dụng.
                  </p>
                </div>

                {/* Changelog tóm tắt */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tóm tắt thay đổi (Changelog)</label>
                  <textarea
                    rows={3}
                    value={editingPolicy.changeLog}
                    onChange={(e) => setEditingPolicy({ ...editingPolicy, changeLog: e.target.value })}
                    className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden leading-relaxed"
                  />
                </div>
              </div>

              {/* Cột phải: Soạn thảo văn bản điều khoản */}
              <div className="lg:col-span-2 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Nội dung chi tiết Điều khoản & Cam kết bảo mật
                </label>
                <textarea
                  rows={16}
                  value={editingPolicy.content}
                  onChange={(e) => setEditingPolicy({ ...editingPolicy, content: e.target.value })}
                  className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  Văn bản này được hiển thị công khai tại đường dẫn <code>/privacy-policy</code> và trong cửa sổ đăng ký tài khoản mới.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL TẠO THÔNG BÁO MỚI (BROADCAST)                                      */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isAddAnnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setIsAddAnnModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">campaign</span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">Phát hành thông báo mới</h3>
                <p className="text-xs text-slate-500">Gửi thông điệp đến người dùng hệ thống</p>
              </div>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="my-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề thông báo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lịch bảo trì hệ thống..."
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung chi tiết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Nhập nội dung thông điệp gửi tới người dùng..."
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Kênh hiển thị</label>
                  <select
                    value={newAnnType}
                    onChange={(e) => setNewAnnType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden font-medium"
                  >
                    <option value="banner">Banner trên cùng</option>
                    <option value="modal">Popup In-App</option>
                    <option value="push">Push Notification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Đối tượng nhận</label>
                  <select
                    value={newAnnTarget}
                    onChange={(e) => setNewAnnTarget(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden font-medium"
                  >
                    <option value="all">Tất cả người dùng</option>
                    <option value="new_users">Người dùng mới</option>
                    <option value="active_users">Người dùng tích cực</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mức độ ưu tiên</label>
                  <select
                    value={newAnnPriority}
                    onChange={(e) => setNewAnnPriority(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden font-medium"
                  >
                    <option value="normal">Bình thường</option>
                    <option value="important">Quan trọng</option>
                    <option value="urgent">Khẩn cấp</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddAnnModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Phát hành ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL THÊM CÂU HỎI FAQ MỚI                                              */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isAddFaqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setIsAddFaqModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">quiz</span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">Thêm câu hỏi thường gặp</h3>
                <p className="text-xs text-slate-500">Bổ sung vào cơ sở tri thức người dùng</p>
              </div>
            </div>

            <form onSubmit={handleCreateFaq} className="my-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chủ đề câu hỏi</label>
                <select
                  value={newFaqCategory}
                  onChange={(e) => setNewFaqCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium"
                >
                  <option value="account">Tài khoản & Đăng nhập</option>
                  <option value="wallet">Ví tiền & Giao dịch</option>
                  <option value="report">Báo cáo & Phân tích</option>
                  <option value="security">Bảo mật & Quyền riêng tư</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Câu hỏi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Làm sao để xuất dữ liệu ra file Excel?"
                  value={newFaqQuestion}
                  onChange={(e) => setNewFaqQuestion(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung trả lời hướng dẫn <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Nhập câu trả lời giải đáp chi tiết..."
                  value={newFaqAnswer}
                  onChange={(e) => setNewFaqAnswer(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddFaqModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Thêm câu hỏi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL XỬ LÝ PHẢN HỒI / TICKETS                                          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">contact_support</span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Xử lý yêu cầu #{selectedTicket.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Từ: {selectedTicket.userName} ({selectedTicket.userEmail})
                </p>
              </div>
            </div>

            <div className="my-5 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs">{selectedTicket.title}</h4>
                  <span className="text-[10px] text-slate-400">{selectedTicket.createdAt}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {selectedTicket.description}
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  Môi trường: {selectedTicket.device}
                </div>
              </div>

              {/* Cập nhật trạng thái */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chuyển trạng thái xử lý
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateTicketStatus(selectedTicket.id, "in_progress")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedTicket.status === "in_progress"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Đang xử lý
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateTicketStatus(selectedTicket.id, "resolved")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedTicket.status === "resolved"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Đã giải quyết
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateTicketStatus(selectedTicket.id, "closed")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedTicket.status === "closed"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Đóng yêu cầu
                  </button>
                </div>
              </div>

              {/* Form phản hồi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nội dung phản hồi người dùng (Gửi qua Email & In-App)
                </label>
                <textarea
                  rows={4}
                  placeholder="Nhập nội dung giải đáp hoặc thông báo khắc phục sự cố..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleSendReply(selectedTicket.id)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Gửi phản hồi cho người dùng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
