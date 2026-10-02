import React, { useState, useEffect, useMemo } from "react";
import { User } from "../types/auth";
import {
  FeedbackTicket,
  FaqItem,
  getStoredFaqs,
  getUserTickets,
  submitUserTicket,
  FEEDBACK_CHANGE_EVENT,
} from "../services/feedbackService";
import { useTranslation } from "../utils/i18n";

interface SupportFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  initialTab?: "submit" | "history" | "faq";
}

export const SupportFeedbackModal: React.FC<SupportFeedbackModalProps> = ({
  isOpen,
  onClose,
  user,
  initialTab = "submit",
}) => {
  const { lang } = useTranslation();
  const [activeTab, setActiveTab] = useState<"submit" | "history" | "faq">(initialTab);

  // Form states
  const [category, setCategory] = useState<FeedbackTicket["category"]>("bug");
  const [severity, setSeverity] = useState<FeedbackTicket["severity"]>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User tickets list
  const [myTickets, setMyTickets] = useState<FeedbackTicket[]>([]);

  // FAQ state
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqCategory, setFaqCategory] = useState<string>("all");
  const [faqSearch, setFaqSearch] = useState("");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Reset tab when modal opens with new initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadTickets();
      setFaqs(getStoredFaqs());
    }
  }, [isOpen, initialTab]);

  const loadTickets = () => {
    const list = getUserTickets(user.email, user.id);
    setMyTickets(list);
  };

  // Lắng nghe sự kiện đồng bộ khi Admin trả lời hoặc có cập nhật
  useEffect(() => {
    const handleSync = () => {
      loadTickets();
    };

    window.addEventListener(FEEDBACK_CHANGE_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGE_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [user.email, user.id]);

  // Đếm số ticket đã được Admin giải quyết / phản hồi
  const resolvedCount = useMemo(() => {
    return myTickets.filter((t) => t.adminReply || t.status === "resolved").length;
  }, [myTickets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(lang === "en" ? "Please enter a subject / title." : "Vui lòng nhập tiêu đề phản ánh.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setErrorMsg(
        lang === "en"
          ? "Please provide a detailed description (at least 10 characters)."
          : "Vui lòng mô tả chi tiết sự cố hoặc đóng góp (tối thiểu 10 ký tự)."
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      submitUserTicket({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        category,
        severity,
        title,
        description,
      });

      setSubmitting(false);
      setTitle("");
      setDescription("");
      setSuccessMsg(
        lang === "en"
          ? "Thank you! Your feedback has been sent to the FinTrack Admin team."
          : "Cảm ơn bạn! Yêu cầu phản ánh đã được gửi thành công đến Quản trị viên FinTrack."
      );
      loadTickets();

      // Chuyển sang xem lịch sử sau 1.2s
      setTimeout(() => {
        setSuccessMsg(null);
        setActiveTab("history");
      }, 1500);
    } catch {
      setSubmitting(false);
      setErrorMsg(
        lang === "en"
          ? "Failed to submit ticket. Please try again."
          : "Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau."
      );
    }
  };

  // Lọc FAQs
  const filteredFaqs = useMemo(() => {
    return faqs.filter((f) => {
      if (!f.isActive) return false;
      const matchCat = faqCategory === "all" || f.category === faqCategory;
      const matchSearch =
        !faqSearch.trim() ||
        f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
        f.answer.toLowerCase().includes(faqSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [faqs, faqCategory, faqSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden transition-colors">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
              <span className="material-symbols-outlined text-[22px]">support_agent</span>
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight">
                {lang === "en" ? "Help & Support Center" : "Trung tâm Trợ giúp & Khiếu nại"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "en"
                  ? "Report bugs, request features, and get responses from Admin"
                  : "Báo lỗi hệ thống, đóng góp ý kiến và nhận phản hồi trực tiếp từ Admin"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("submit")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "submit"
                ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">report</span>
            <span>{lang === "en" ? "Send Report / Feedback" : "Gửi Báo lỗi & Khiếu nại"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "history"
                ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">history</span>
            <span>{lang === "en" ? "My Requests" : "Yêu cầu của tôi"}</span>
            {myTickets.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {myTickets.length}
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950" title="Có phản hồi từ Admin" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("faq")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "faq"
                ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">help</span>
            <span>{lang === "en" ? "FAQ" : "Hỏi đáp & Hướng dẫn"}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: FORM GỬI BÁO LỖI / KHIẾU NẠI */}
          {activeTab === "submit" && (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto">
              {successMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">check_circle</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[18px]">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Thông tin người gửi */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">account_circle</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{user.name}</span>
                  <span className="text-slate-400">({user.email})</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                  {lang === "en" ? "Verified" : "Đã xác thực"}
                </span>
              </div>

              {/* Chọn danh mục */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "en" ? "Category" : "Loại vấn đề phản ánh"} *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "bug", label: lang === "en" ? "Bug Report" : "Báo lỗi hệ thống", icon: "bug_report", color: "rose" },
                    { id: "feature", label: lang === "en" ? "Feature Request" : "Đề xuất tính năng", icon: "auto_awesome", color: "purple" },
                    { id: "ux", label: lang === "en" ? "UI / UX" : "Giao diện & Tiện ích", icon: "palette", color: "blue" },
                    { id: "other", label: lang === "en" ? "Other" : "Góp ý khác", icon: "chat_bubble", color: "emerald" },
                  ].map((c) => {
                    const isSelected = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id as FeedbackTicket["category"])}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 shadow-2xs font-semibold ring-1 ring-emerald-500"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px] text-emerald-600 dark:text-emerald-400">
                          {c.icon}
                        </span>
                        <span className="text-xs">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mức độ ưu tiên / nghiêm trọng */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "en" ? "Severity Level" : "Mức độ ảnh hưởng"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "low", label: lang === "en" ? "Low (Minor)" : "Thấp (Góp ý nhỏ)" },
                    { id: "medium", label: lang === "en" ? "Medium (Normal)" : "Vừa (Ảnh hưởng thao tác)" },
                    { id: "high", label: lang === "en" ? "High (Feature blocked)" : "Cao (Không dùng được tính năng)" },
                    { id: "critical", label: lang === "en" ? "Critical (Data error)" : "Nghiêm trọng (Mất dữ liệu)" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id as FeedbackTicket["severity"])}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                        severity === s.id
                          ? "bg-slate-900 dark:bg-emerald-600 text-white border-transparent shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tiêu đề */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "en" ? "Subject / Title" : "Tiêu đề yêu cầu"} *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    lang === "en"
                      ? "Brief summary of the issue (e.g. Cannot export PDF report)"
                      : "Tóm tắt ngắn gọn vấn đề (ví dụ: Không xuất được báo cáo PDF trên mobile)"
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Mô tả chi tiết */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "en" ? "Detailed Description" : "Nội dung mô tả chi tiết"} *
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    lang === "en"
                      ? "Please describe what happened, steps to reproduce, or what you suggest..."
                      : "Vui lòng mô tả các bước gặp lỗi, dữ liệu bị ảnh hưởng hoặc giải pháp bạn mong đợi từ FinTrack..."
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              {/* Tự động thu thập thiết bị */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-[16px]">devices</span>
                <span>
                  {lang === "en" ? "Device info will be attached automatically to help diagnose the bug." : "Thông tin thiết bị & trình duyệt sẽ được gửi kèm để hỗ trợ xử lý kỹ thuật."}
                </span>
              </div>

              {/* Nút gửi */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "Hủy bỏ"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>{submitting ? (lang === "en" ? "Sending..." : "Đang gửi...") : (lang === "en" ? "Send Ticket" : "Gửi yêu cầu hỗ trợ")}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: LỊCH SỬ YÊU CẦU & PHẢN HỒI TỪ ADMIN */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {lang === "en" ? "Submitted Requests" : "Các phản ánh & khiếu nại đã gửi"} ({myTickets.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("submit")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>{lang === "en" ? "New Ticket" : "Gửi phản ánh mới"}</span>
                </button>
              </div>

              {myTickets.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-2">
                    inbox
                  </span>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {lang === "en" ? "You haven't submitted any feedback or reports yet." : "Bạn chưa gửi khiếu nại hoặc báo lỗi nào."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("submit")}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>{lang === "en" ? "Submit your first report" : "Gửi yêu cầu đầu tiên"}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-slate-400">
                            #{ticket.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ticket.category === "bug"
                                ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300"
                                : ticket.category === "feature"
                                ? "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300"
                                : "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            {ticket.category === "bug"
                              ? lang === "en" ? "Bug" : "Báo lỗi"
                              : ticket.category === "feature"
                              ? lang === "en" ? "Feature" : "Tính năng"
                              : lang === "en" ? "UI/UX" : "Trải nghiệm UX"}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                            ticket.status === "new"
                              ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                              : ticket.status === "in_progress"
                              ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300"
                              : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ticket.status === "new"
                                ? "bg-amber-500 animate-pulse"
                                : ticket.status === "in_progress"
                                ? "bg-blue-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span>
                            {ticket.status === "new"
                              ? lang === "en" ? "Received" : "Mới tiếp nhận"
                              : ticket.status === "in_progress"
                              ? lang === "en" ? "Processing" : "Đang xử lý"
                              : lang === "en" ? "Resolved" : "Đã giải quyết"}
                          </span>
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {ticket.title}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">
                          {ticket.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                        <span>{ticket.createdAt}</span>
                        <span>{ticket.device}</span>
                      </div>

                      {/* ADMIN REPLY BOX */}
                      {ticket.adminReply ? (
                        <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
                                A
                              </span>
                              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                                {lang === "en" ? "FinTrack Support Team" : "Ban Quản trị FinTrack"}
                              </span>
                              <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">
                                verified
                              </span>
                            </div>
                            {ticket.repliedAt && (
                              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                                {ticket.repliedAt}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed font-medium pl-6">
                            {ticket.adminReply}
                          </p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 italic flex items-center gap-1.5 pt-1">
                          <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                          <span>
                            {lang === "en"
                              ? "Waiting for response from Admin. You will receive an in-app alert when resolved."
                              : "Đang chờ Ban Quản trị phản hồi. Bạn sẽ nhận được thông báo khi yêu cầu được xử lý."}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRUNG TÂM HỎI ĐÁP (FAQ) */}
          {activeTab === "faq" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={faqSearch}
                    onChange={(e) => setFaqSearch(e.target.value)}
                    placeholder={lang === "en" ? "Search questions..." : "Tìm kiếm câu hỏi trợ giúp..."}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: "all", label: lang === "en" ? "All" : "Tất cả" },
                    { id: "account", label: lang === "en" ? "Account" : "Tài khoản" },
                    { id: "wallet", label: lang === "en" ? "Wallet" : "Ví tiền" },
                    { id: "report", label: lang === "en" ? "Report" : "Báo cáo" },
                    { id: "security", label: lang === "en" ? "Security" : "Bảo mật" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFaqCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        faqCategory === cat.id
                          ? "bg-slate-900 dark:bg-emerald-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredFaqs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {lang === "en" ? "No matching questions found." : "Không tìm thấy câu hỏi phù hợp."}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredFaqs.map((faq) => {
                    const isExpanded = expandedFaqId === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 overflow-hidden transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                          className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex-1">
                            {faq.question}
                          </span>
                          <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0 transition-transform">
                            {isExpanded ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 leading-relaxed bg-slate-50/50 dark:bg-slate-800/30">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
