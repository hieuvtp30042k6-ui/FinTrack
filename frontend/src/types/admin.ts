export interface AdminStatsSummary {
  total_users: number;
  active_users: number;
  new_users_7d: number;
  total_transactions: number;
  total_volume: number;
  total_expense: number;
  total_income: number;
  system_categories_count: number;
  total_wallets: number;
}

export interface DayGrowthData {
  date: string;
  display_date: string;
  day_name: string; // T2, T3...
  new_users: number;
  transactions_count: number;
  expense_volume: number;
  income_volume: number;
}

export interface TopCategoryData {
  name: string;
  icon: string;
  type: string;
  count: number;
  amount: number;
}

export interface RecentTransactionData {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  category_name: string;
  category_icon: string;
  wallet_name: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export interface RecentUserData {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export interface SystemStatusData {
  database_connected: boolean;
  api_status: string;
  uptime_rate: string;
  environment: string;
}

export interface AdminDashboardStatsResponse {
  summary: AdminStatsSummary;
  growth_chart: DayGrowthData[];
  top_categories: TopCategoryData[];
  recent_transactions: RecentTransactionData[];
  recent_users: RecentUserData[];
  system_status: SystemStatusData;
}
