import { RegisterRequest, LoginRequest, AuthResponse, User } from "../types/auth";
import { getToken, clearAuth } from "../utils/storage";

const API_BASE = "/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = "Đã có lỗi xảy ra. Vui lòng thử lại.";
    try {
      const errorData = await res.json();
      if (typeof errorData.detail === "string") {
        errorMsg = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMsg = errorData.detail.map((d: { msg: string }) => d.msg).join(", ");
      }
    } catch {
      errorMsg = res.statusText || errorMsg;
    }

    const isLocked =
      res.status === 403 &&
      (errorMsg.toLowerCase().includes("khóa") ||
        errorMsg.toLowerCase().includes("kích hoạt") ||
        errorMsg.toLowerCase().includes("locked"));

    if (res.status === 401 || isLocked) {
      // Clear expired/locked authentication state and notify App to redirect to Login
      clearAuth();
      window.dispatchEvent(
        new CustomEvent("fintrack:auth-expired", {
          detail: { message: errorMsg, isLocked },
        })
      );
    }

    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

export const registerApi = async (data: RegisterRequest): Promise<User> => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<User>(res);
};

export const loginApi = async (data: LoginRequest): Promise<AuthResponse> => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<AuthResponse>(res);
};

export const googleAuthApi = async (credential: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  return handleResponse<AuthResponse>(res);
};

export const getMyProfileApi = async (): Promise<User> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<User>(res);
};

export const updateProfileApi = async (data: {
  name?: string;
  email?: string;
  avatar_url?: string | null;
}): Promise<User> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<User>(res);
};

export const uploadAvatarApi = async (file: File): Promise<User> => {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/users/me/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
    body: formData,
  });
  return handleResponse<User>(res);
};

export const deleteAvatarApi = async (): Promise<User> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me/avatar`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<User>(res);
};

export const changePasswordApi = async (data: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ message: string }>(res);
};

export const getAdminUsersApi = async (): Promise<User[]> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<User[]>(res);
};

export const getAdminDashboardStatsApi = async (): Promise<import("../types/admin").AdminDashboardStatsResponse> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/dashboard/stats`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<import("../types/admin").AdminDashboardStatsResponse>(res);
};

export const updateAdminUserStatusApi = async (userId: number, status: "active" | "inactive"): Promise<User> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse<User>(res);
};

export const updateAdminUserRoleApi = async (
  userId: number,
  role: "super_admin" | "admin" | "user"
): Promise<User> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify({ role }),
  });
  return handleResponse<User>(res);
};

// ─── Admin System Overview API ────────────────────────────────────────────────

export interface SystemOverviewResponse {
  users: {
    total: number;
    active: number;
    locked: number;
    admin_count: number;
    google_oauth_users: number;
    new_last_30d: number;
  };
  transactions: {
    total: number;
    expense_count: number;
    income_count: number;
    total_expense: number;
    total_income: number;
    net_balance: number;
    new_last_30d: number;
  };
  wallets: {
    total: number;
    total_balance: number;
  };
  categories: {
    total: number;
    system_categories: number;
    user_categories: number;
  };
  top_active_users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    transaction_count: number;
    transaction_volume: number;
  }>;
  monthly_stats: Array<{
    month: string;
    label: string;
    income: number;
    expense: number;
    transaction_count: number;
    new_users: number;
  }>;
  timeline_stats?: Array<{
    label: string;
    income: number;
    expense: number;
    net: number;
    transaction_count: number;
    new_users: number;
  }>;
  period_summary?: {
    period: string;
    from_date: string | null;
    to_date: string | null;
    income: number;
    expense: number;
    net: number;
    transaction_count: number;
    new_users: number;
  };
  server_info: {
    python_version: string;
    platform: string;
    framework: string;
    database: string;
    api_version: string;
    environment: string;
    uptime: string;
    server_time: string;
  };
}

export const getAdminSystemOverviewApi = async (params?: {
  period?: string;
  from_date?: string;
  to_date?: string;
}): Promise<SystemOverviewResponse> => {
  const token = getToken();
  const query = new URLSearchParams();
  if (params?.period) query.append("period", params.period);
  if (params?.from_date) query.append("from_date", params.from_date);
  if (params?.to_date) query.append("to_date", params.to_date);

  const qs = query.toString();
  const res = await fetch(`${API_BASE}/admin/system/overview${qs ? `?${qs}` : ""}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<SystemOverviewResponse>(res);
};

// ─── Admin Security Audit Log API ─────────────────────────────────────────────

export interface AuditEvent {
  event_id: string;
  event_type: "USER_REGISTERED" | "ACCOUNT_LOCKED" | "PRIVILEGED_ACCOUNT";
  severity: "info" | "warning" | "critical";
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  user_status: string;
  auth_method: "google_oauth" | "email_password";
  timestamp: string;
  description: string;
}

export interface SecurityAuditLogResponse {
  summary: {
    total_accounts: number;
    active_accounts: number;
    locked_accounts: number;
    google_oauth_accounts: number;
    admin_accounts: number;
    new_registrations_7d: number;
    lock_rate: number;
    oauth_adoption_rate: number;
    generated_at: string;
  };
  registration_events: AuditEvent[];
  lock_events: AuditEvent[];
  admin_events: AuditEvent[];
}

export const getAdminSecurityAuditLogApi = async (): Promise<SecurityAuditLogResponse> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/security/audit-log`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<SecurityAuditLogResponse>(res);
};



export const forgotPasswordApi = async (email: string): Promise<{ message: string }> => {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse<{ message: string }>(res);
};

export const resetPasswordApi = async (data: {
  token: string;
  new_password: string;
  confirm_password: string;
}): Promise<{ message: string }> => {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<{ message: string }>(res);
};

export interface CategoryModel {
  id: number;
  user_id?: number | null;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon?: string | null;
  description?: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export const getCategoriesApi = async (type?: "income" | "expense"): Promise<CategoryModel[]> => {
  const token = getToken();
  const query = type ? `?type=${type}` : "";
  const res = await fetch(`${API_BASE}/categories${query}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<CategoryModel[]>(res);
};

export const createCategoryApi = async (data: {
  name: string;
  type: string;
  icon?: string;
  description?: string;
}): Promise<CategoryModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<CategoryModel>(res);
};

export const updateCategoryApi = async (
  id: number,
  data: { name?: string; type?: string; icon?: string; description?: string }
): Promise<CategoryModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<CategoryModel>(res);
};

export const deleteCategoryApi = async (id: number): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<{ message: string }>(res);
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface WalletModel {
  id: number;
  user_id: number;
  name: string;
  balance: number;
  currency?: string;
  is_excluded_from_total?: boolean;
  is_archived?: boolean;
  is_shared?: boolean;
  is_owner?: boolean;
  my_role?: "OWNER" | "EDITOR" | "VIEWER";
  owner_name?: string | null;
  owner_email?: string | null;
  members_count?: number;
  wallet_type?: "STANDARD" | "CREDIT";
  credit_limit?: number | null;
  statement_day?: number | null;
  payment_due_day?: number | null;
  created_at: string;
  updated_at: string;
}

export interface WalletMemberModel {
  id: number;
  wallet_id: number;
  user_id?: number | null;
  email: string;
  name?: string | null;
  role: "VIEWER" | "EDITOR";
  status: "ACCEPTED" | "PENDING";
  created_at: string;
}

export const getWalletsApi = async (includeArchived: boolean = true): Promise<WalletModel[]> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets?include_archived=${includeArchived}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<WalletModel[]>(res);
};

export const createWalletApi = async (data: {
  name: string;
  balance?: number;
  currency?: string;
  is_excluded_from_total?: boolean;
  wallet_type?: "STANDARD" | "CREDIT";
  credit_limit?: number | null;
  statement_day?: number | null;
  payment_due_day?: number | null;
}): Promise<WalletModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<WalletModel>(res);
};

export const updateWalletApi = async (
  id: number,
  data: {
    name?: string;
    currency?: string;
    is_excluded_from_total?: boolean;
    is_archived?: boolean;
    wallet_type?: "STANDARD" | "CREDIT";
    credit_limit?: number | null;
    statement_day?: number | null;
    payment_due_day?: number | null;
  }
): Promise<WalletModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<WalletModel>(res);
};

export const archiveWalletApi = async (id: number): Promise<WalletModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${id}/archive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<WalletModel>(res);
};

export const unarchiveWalletApi = async (id: number): Promise<WalletModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${id}/unarchive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<WalletModel>(res);
};

export interface TransferRequestData {
  from_wallet_id: number;
  to_wallet_id: number;
  amount: number;
  transfer_date?: string;
  description?: string;
  fee?: number;
  to_amount?: number;
}

export interface TransferResponseData {
  message: string;
  from_wallet: WalletModel;
  to_wallet: WalletModel;
  amount: number;
  received_amount: number;
  fee: number;
  transfer_date: string;
  description?: string | null;
}

export const transferFundsApi = async (data: TransferRequestData): Promise<TransferResponseData> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<TransferResponseData>(res);
};

export interface AdjustBalanceData {
  wallet_id: number;
  target_balance: number;
  adjustment_date?: string;
  description?: string;
}

export const adjustBalanceApi = async (data: AdjustBalanceData): Promise<{
  message: string;
  wallet: WalletModel;
  previous_balance: number;
  new_balance: number;
  difference: number;
  adjustment_date: string;
}> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/adjust-balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const deleteWalletApi = async (id: number): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<{ message: string }>(res);
};

export const getWalletMembersApi = async (walletId: number): Promise<WalletMemberModel[]> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${walletId}/members`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<WalletMemberModel[]>(res);
};

export const inviteWalletMemberApi = async (
  walletId: number,
  data: { email: string; role: "VIEWER" | "EDITOR" }
): Promise<WalletMemberModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${walletId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<WalletMemberModel>(res);
};

export const updateWalletMemberRoleApi = async (
  walletId: number,
  memberId: number,
  role: "VIEWER" | "EDITOR"
): Promise<WalletMemberModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${walletId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify({ role }),
  });
  return handleResponse<WalletMemberModel>(res);
};

export const removeWalletMemberApi = async (
  walletId: number,
  memberId: number
): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${walletId}/members/${memberId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<{ message: string }>(res);
};

export const leaveWalletApi = async (walletId: number): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/wallets/${walletId}/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<{ message: string }>(res);
};

// ─── Transaction ──────────────────────────────────────────────────────────────

export interface TransactionModel {
  id: number;
  user_id: number;
  wallet_id: number;
  category_id?: number | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  amount: number;
  description?: string | null;
  transaction_date: string; // "YYYY-MM-DD"
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  wallet_name?: string | null;
  wallet_balance?: number | null;
}

export interface TransactionFilter {
  type?: "income" | "expense" | "transfer" | "adjustment";
  category_id?: number;
  wallet_id?: number;
  from_date?: string;
  to_date?: string;
}

export const getTransactionsApi = async (filter?: TransactionFilter): Promise<TransactionModel[]> => {
  const token = getToken();
  const params = new URLSearchParams();
  if (filter?.type) params.append("type", filter.type);
  if (filter?.category_id) params.append("category_id", String(filter.category_id));
  if (filter?.wallet_id) params.append("wallet_id", String(filter.wallet_id));
  if (filter?.from_date) params.append("from_date", filter.from_date);
  if (filter?.to_date) params.append("to_date", filter.to_date);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/transactions${query}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<TransactionModel[]>(res);
};

export const createTransactionApi = async (data: {
  wallet_id: number;
  category_id: number;
  type: string;
  amount: number;
  description?: string;
  transaction_date: string;
}): Promise<TransactionModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<TransactionModel>(res);
};

export const updateTransactionApi = async (
  id: number,
  data: {
    wallet_id?: number;
    category_id?: number;
    type?: string;
    amount?: number;
    description?: string;
    transaction_date?: string;
  }
): Promise<TransactionModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<TransactionModel>(res);
};

export const deleteTransactionApi = async (id: number): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<{ message: string }>(res);
};

// ─── Budget ───────────────────────────────────────────────────────────────────

export interface BudgetModel {
  id: number;
  user_id: number;
  category_id?: number | null;
  category_name?: string | null;
  category?: string | null;
  category_icon?: string | null;
  icon?: string | null;
  amount: number;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: "normal" | "warning" | "exceeded";
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetFilter {
  category_id?: number;
  month?: number;
  year?: number;
}

export const getBudgetsApi = async (filter?: BudgetFilter): Promise<BudgetModel[]> => {
  const token = getToken();
  const params = new URLSearchParams();
  if (filter?.category_id) params.append("category_id", String(filter.category_id));
  if (filter?.month) params.append("month", String(filter.month));
  if (filter?.year) params.append("year", String(filter.year));
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/budgets${query}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<BudgetModel[]>(res);
};

export const getBudgetDetailApi = async (id: number): Promise<BudgetModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/budgets/${id}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<BudgetModel>(res);
};

export const createBudgetApi = async (data: {
  category_id?: number | null;
  amount: number;
  start_date?: string;
  end_date?: string;
  month?: number;
  year?: number;
}): Promise<BudgetModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/budgets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<BudgetModel>(res);
};

export const updateBudgetApi = async (
  id: number,
  data: {
    category_id?: number | null;
    amount?: number;
    start_date?: string;
    end_date?: string;
  }
): Promise<BudgetModel> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/budgets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify(data),
  });
  return handleResponse<BudgetModel>(res);
};

export const deleteBudgetApi = async (id: number): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/budgets/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  return handleResponse<{ message: string }>(res);
};

// ─── Reports API ─────────────────────────────────────────────────────────────

export interface ReportSummaryModel {
  from_date: string;
  to_date: string;
  total_income: number;
  total_expense: number;
  balance: number;
  net_balance: number;
  savings_rate: number;
  transaction_count: number;
}

export interface CategoryExpenseItemModel {
  category_id: number;
  category_name: string;
  category_icon?: string | null;
  icon?: string | null;
  total_expense: number;
  percentage: number;
  transaction_count: number;
}

export interface CategoryReportModel {
  from_date: string;
  to_date: string;
  total_expense: number;
  categories: CategoryExpenseItemModel[];
}

export interface BudgetReportItemModel {
  budget_id: number;
  category_id?: number | null;
  category_name?: string | null;
  category_icon?: string | null;
  budget_amount: number;
  spent_amount: number;
  remaining_amount: number;
  usage_percent: number;
  start_date: string;
  end_date: string;
}

export interface BudgetReportModel {
  from_date: string;
  to_date: string;
  budgets: BudgetReportItemModel[];
}

export const getReportSummaryApi = async (
  from_date?: string,
  to_date?: string
): Promise<ReportSummaryModel> => {
  const token = getToken();
  const params = new URLSearchParams();
  if (from_date) params.append("from_date", from_date);
  if (to_date) params.append("to_date", to_date);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/reports/summary${query}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<ReportSummaryModel>(res);
};

export const getReportCategoriesApi = async (
  from_date?: string,
  to_date?: string
): Promise<CategoryReportModel> => {
  const token = getToken();
  const params = new URLSearchParams();
  if (from_date) params.append("from_date", from_date);
  if (to_date) params.append("to_date", to_date);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/reports/categories${query}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<CategoryReportModel>(res);
};

export const getReportBudgetsApi = async (
  from_date?: string,
  to_date?: string
): Promise<BudgetReportModel> => {
  const token = getToken();
  const params = new URLSearchParams();
  if (from_date) params.append("from_date", from_date);
  if (to_date) params.append("to_date", to_date);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/reports/budgets${query}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<BudgetReportModel>(res);
};

// ─── Privacy & Danger Zone ───────────────────────────────────────────────────

export interface ConnectedAppItem {
  provider: string;
  name: string;
  connected: boolean;
  email?: string | null;
  icon?: string | null;
}

export interface ConnectedAppsResponse {
  apps: ConnectedAppItem[];
}

export const getConnectedAppsApi = async (): Promise<ConnectedAppsResponse> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me/connected-apps`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<ConnectedAppsResponse>(res);
};

export const revokeConnectedAppApi = async (provider: string): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me/connected-apps/${provider}/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<{ message: string }>(res);
};

export const resetUserDataApi = async (data: {
  password?: string;
  confirmation_text: string;
}): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me/reset-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ message: string }>(res);
};

export const deleteAccountApi = async (data: {
  password?: string;
  confirmation_text: string;
}): Promise<{ message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/me/delete-account`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ message: string }>(res);
};

// ─── System Configuration (Cấu hình hệ thống) ─────────────────────────────────

export interface FeatureFlag {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  group: string;
}

export interface SmtpConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
}

export interface GeneralConfig {
  app_name: string;
  tagline: string;
  default_language: string;
  timezone: string;
  date_format: string;
  currency: string;
  max_wallets: string;
  max_categories: string;
  max_file_size_mb: string;
}

export interface ApiIntegration {
  id: string;
  name: string;
  provider: string;
  key: string;
  status: string;
  last_check: string;
}

export interface SystemConfigData {
  general: GeneralConfig;
  smtp: SmtpConfig;
  flags: FeatureFlag[];
  apis: ApiIntegration[];
}

export const getAdminConfigApi = async (): Promise<SystemConfigData> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/config`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
  });
  return handleResponse<SystemConfigData>(res);
};

export const updateAdminConfigApi = async (data: SystemConfigData): Promise<SystemConfigData> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<SystemConfigData>(res);
};

export const testEmailConfigApi = async (
  smtp: SmtpConfig,
  recipient_email?: string
): Promise<{ status: string; message: string }> => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/config/test-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify({ smtp, recipient_email }),
  });
  return handleResponse<{ status: string; message: string }>(res);
};



