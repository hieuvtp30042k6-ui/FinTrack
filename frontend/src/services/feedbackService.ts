/**
 * Service quản lý Phản hồi, Khiếu nại, Báo lỗi (Feedback & Bug Report Tickets)
 * và Trung tâm Hỏi đáp (FAQ) giữa Người dùng (User) và Quản trị viên (Admin).
 */

export interface FeedbackTicket {
  id: string;
  userId?: number;
  userName: string;
  userEmail: string;
  category: "bug" | "feature" | "ux" | "other";
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "in_progress" | "resolved" | "closed";
  title: string;
  description: string;
  device: string;
  createdAt: string;
  adminReply?: string;
  repliedAt?: string;
}

export interface FaqItem {
  id: string;
  category: "account" | "wallet" | "report" | "security" | "other";
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  updatedAt: string;
}

const FEEDBACK_STORAGE_KEY = "fintrack_feedbacks";
const FAQ_STORAGE_KEY = "fintrack_faqs";
export const FEEDBACK_CHANGE_EVENT = "fintrack:feedback-changed";

export const INITIAL_FEEDBACKS: FeedbackTicket[] = [
  {
    id: "TKT-104",
    userName: "Trần Minh Hoàng",
    userEmail: "hoang.tm@gmail.com",
    category: "bug",
    severity: "high",
    status: "new",
    title: "Lỗi hiển thị biểu đồ tròn khi chọn khoảng ngày tùy chỉnh",
    description: "Khi chọn xem báo cáo từ ngày 01/09 đến 15/09, biểu đồ cơ cấu danh mục bị đơ và không tải được tỷ lệ phần trăm.",
    device: "Chrome 128 / macOS 15.0",
    createdAt: "2026-10-01 10:15",
  },
  {
    id: "TKT-103",
    userName: "Lê Thị Thảo",
    userEmail: "thaole92@yahoo.com",
    category: "feature",
    severity: "medium",
    status: "in_progress",
    title: "Mong muốn bổ sung tính năng quét hóa đơn mua hàng (OCR)",
    description: "Nếu có thể chụp ảnh hóa đơn siêu thị rồi tự động điền số tiền và danh mục thì sẽ tiện lợi hơn rất nhiều ạ.",
    device: "Safari / iOS 18.0",
    createdAt: "2026-09-30 16:40",
    adminReply: "Cảm ơn bạn! Đội ngũ đang thử nghiệm tính năng OCR hóa đơn và dự kiến ra mắt trong bản 2.5 tới.",
    repliedAt: "2026-10-01 08:30",
  },
  {
    id: "TKT-102",
    userName: "Phạm Quốc Tuấn",
    userEmail: "tuanpq@fpt.edu.vn",
    category: "ux",
    severity: "low",
    status: "resolved",
    title: "Kích thước nút bấm thêm giao dịch hơi nhỏ trên màn hình di động",
    description: "Nút '+' ở góc phải phía dưới hơi khó bấm khi sử dụng một tay trên điện thoại cỡ nhỏ.",
    device: "Samsung Galaxy S23 / Android 14",
    createdAt: "2026-09-28 14:20",
    adminReply: "Đã tối ưu lại padding và hit-area của nút hành động nổi trên thiết bị di động trong bản cập nhật mới nhất.",
    repliedAt: "2026-09-29 11:15",
  },
  {
    id: "TKT-101",
    userName: "Ngô Đức Trọng",
    userEmail: "trong.ngo@outlook.com",
    category: "feature",
    severity: "low",
    status: "resolved",
    title: "Đề xuất thêm chế độ Dark mode cho ứng dụng web",
    description: "Giao diện ban đêm giúp đỡ mỏi mắt khi nhập liệu giao dịch muộn.",
    device: "Edge 129 / Windows 11",
    createdAt: "2026-09-25 09:00",
    adminReply: "Tính năng Dark Mode toàn diện đã được phát hành chính thức ở phiên bản này, bạn có thể bật tại góc trên bên phải!",
    repliedAt: "2026-09-26 15:00",
  },
];

export const INITIAL_FAQS: FaqItem[] = [
  {
    id: "FAQ-1",
    category: "account",
    question: "Làm thế nào để đổi mật khẩu hoặc bảo mật tài khoản 2 lớp?",
    answer: "Bạn có thể vào mục Cài đặt tài khoản > Bảo mật & Mật khẩu để đổi mật khẩu mới hoặc kích hoạt xác thực hai yếu tố (2FA) qua ứng dụng Authenticator.",
    order: 1,
    isActive: true,
    updatedAt: "2026-09-20",
  },
  {
    id: "FAQ-2",
    category: "wallet",
    question: "Tôi có thể tạo tối đa bao nhiêu ví trong FinTrack?",
    answer: "FinTrack hỗ trợ tạo không giới hạn ví tiền (tiền mặt, tài khoản ngân hàng, ví điện tử) hoàn toàn miễn phí.",
    order: 2,
    isActive: true,
    updatedAt: "2026-09-18",
  },
  {
    id: "FAQ-3",
    category: "report",
    question: "Dữ liệu báo cáo có hỗ trợ xuất file Excel hoặc PDF không?",
    answer: "Có! Tại trang Báo cáo, bạn nhấn nút 'Xuất báo cáo' ở góc trên để tải file bảng tính Excel chi tiết hoặc in bản báo cáo PDF.",
    order: 3,
    isActive: true,
    updatedAt: "2026-09-15",
  },
  {
    id: "FAQ-4",
    category: "security",
    question: "Dữ liệu tài chính của tôi có được mã hóa và bảo mật không?",
    answer: "Toàn bộ dữ liệu của bạn được mã hóa an toàn theo tiêu chuẩn ngân hàng AES-256. Chúng tôi tuyệt đối không chia sẻ thông tin tài chính với bên thứ ba.",
    order: 4,
    isActive: true,
    updatedAt: "2026-09-10",
  },
];

/**
 * Lấy danh sách toàn bộ Ticket từ LocalStorage (hoặc fallback INITIAL_FEEDBACKS)
 */
export function getStoredFeedbacks(): FeedbackTicket[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(INITIAL_FEEDBACKS));
      return INITIAL_FEEDBACKS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_FEEDBACKS;
  }
}

/**
 * Lưu danh sách Ticket vào LocalStorage và dispatch event đồng bộ
 */
export function saveStoredFeedbacks(feedbacks: FeedbackTicket[]): void {
  try {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedbacks));
    window.dispatchEvent(new CustomEvent(FEEDBACK_CHANGE_EVENT, { detail: feedbacks }));
  } catch (err) {
    console.error("Lỗi khi lưu feedback tickets:", err);
  }
}

/**
 * Lấy danh sách ticket của 1 người dùng cụ thể (theo email hoặc userId)
 */
export function getUserTickets(userEmail: string, userId?: number): FeedbackTicket[] {
  const all = getStoredFeedbacks();
  const normalizedEmail = userEmail.toLowerCase().trim();
  return all.filter((t) => {
    if (t.userEmail && t.userEmail.toLowerCase().trim() === normalizedEmail) return true;
    if (userId && t.userId === userId) return true;
    return false;
  });
}

/**
 * Người dùng tạo ticket mới
 */
export function submitUserTicket(payload: {
  userId?: number;
  userName: string;
  userEmail: string;
  category: "bug" | "feature" | "ux" | "other";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  device?: string;
}): FeedbackTicket {
  const all = getStoredFeedbacks();
  
  // Tự động nhận diện thiết bị người dùng
  const defaultDevice = (() => {
    if (typeof window === "undefined") return "Web Browser";
    const ua = navigator.userAgent;
    let browser = "Trình duyệt";
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Edg")) browser = "Edge";

    let os = "Desktop";
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return `${browser} / ${os}`;
  })();

  const newTicket: FeedbackTicket = {
    id: `TKT-${Math.floor(100 + Math.random() * 900)}`,
    userId: payload.userId,
    userName: payload.userName,
    userEmail: payload.userEmail,
    category: payload.category,
    severity: payload.severity,
    status: "new",
    title: payload.title.trim(),
    description: payload.description.trim(),
    device: payload.device || defaultDevice,
    createdAt: new Date().toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  const updated = [newTicket, ...all];
  saveStoredFeedbacks(updated);
  return newTicket;
}

/**
 * Admin trả lời ticket và đổi trạng thái sang resolved
 */
export function replyToTicket(ticketId: string, replyContent: string): FeedbackTicket | null {
  const all = getStoredFeedbacks();
  let updatedTicket: FeedbackTicket | null = null;

  const nextList = all.map((t) => {
    if (t.id === ticketId) {
      updatedTicket = {
        ...t,
        status: "resolved",
        adminReply: replyContent.trim(),
        repliedAt: new Date().toLocaleString("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      return updatedTicket;
    }
    return t;
  });

  if (updatedTicket) {
    saveStoredFeedbacks(nextList);
  }
  return updatedTicket;
}

/**
 * Cập nhật trạng thái ticket
 */
export function updateTicketStatus(
  ticketId: string,
  newStatus: FeedbackTicket["status"]
): FeedbackTicket | null {
  const all = getStoredFeedbacks();
  let updatedTicket: FeedbackTicket | null = null;

  const nextList = all.map((t) => {
    if (t.id === ticketId) {
      updatedTicket = { ...t, status: newStatus };
      return updatedTicket;
    }
    return t;
  });

  if (updatedTicket) {
    saveStoredFeedbacks(nextList);
  }
  return updatedTicket;
}

/**
 * Dọn dẹp ticket đã resolved/closed
 */
export function cleanupResolvedTickets(): number {
  const all = getStoredFeedbacks();
  const remaining = all.filter((t) => t.status !== "resolved" && t.status !== "closed");
  const countRemoved = all.length - remaining.length;
  if (countRemoved > 0) {
    saveStoredFeedbacks(remaining);
  }
  return countRemoved;
}

/**
 * Lấy danh sách FAQs
 */
export function getStoredFaqs(): FaqItem[] {
  try {
    const raw = localStorage.getItem(FAQ_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(INITIAL_FAQS));
      return INITIAL_FAQS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_FAQS;
  }
}

/**
 * Lưu danh sách FAQs
 */
export function saveStoredFaqs(faqs: FaqItem[]): void {
  try {
    localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(faqs));
  } catch (err) {
    console.error("Lỗi khi lưu FAQs:", err);
  }
}
