import React, { useState, useEffect } from "react";
import { User } from "../types/auth";
import { UserLayout } from "../layouts/UserLayout";
import { UserTabId, DEFAULT_USER_TAB, isUserTabId } from "../config/userNavigation";
import { DashboardView } from "./user/DashboardView";
import { ExpensesView } from "./user/ExpensesView";
import { CategoriesView } from "./user/CategoriesView";
import { WalletsView } from "./user/WalletsView";
import { BudgetsView } from "./user/BudgetsView";
import { SplitBillView } from "./user/SplitBillView";
import { ReportsView } from "./user/ReportsView";
import { AccountView } from "./user/AccountView";

interface UserDashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate?: (user: User) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, onLogout, onUserUpdate }) => {
  // 1. Khởi tạo activeTab từ URL hash (nếu hợp lệ) hoặc tab mặc định
  const getInitialTab = (): UserTabId => {
    const hash = window.location.hash.replace("#", "").trim();
    if (isUserTabId(hash)) {
      return hash;
    }
    return DEFAULT_USER_TAB;
  };

  const [activeTab, setActiveTab] = useState<UserTabId>(getInitialTab);
  const [expensesInitialCategoryId, setExpensesInitialCategoryId] = useState<number | null>(null);
  const [budgetsInitialCategoryId, setBudgetsInitialCategoryId] = useState<number | null>(null);

  // 2. Lắng nghe thay đổi hash (Back/Forward của trình duyệt)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "").trim();
      if (isUserTabId(hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // 3. Đồng bộ khi người dùng click đổi tab
  const handleTabChange = (tabId: UserTabId) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };

  const handleNavigateToExpenses = (categoryId?: number) => {
    if (categoryId !== undefined) {
      setExpensesInitialCategoryId(categoryId);
    }
    handleTabChange("expenses");
  };

  const handleNavigateToBudgets = (categoryId?: number) => {
    if (categoryId !== undefined) {
      setBudgetsInitialCategoryId(categoryId);
    }
    handleTabChange("budgets");
  };

  return (
    <UserLayout
      user={user}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onLogout={onLogout}
    >
      {activeTab === "dashboard" && (
        <DashboardView
          user={user}
          onNavigateTab={(tab) => {
            if (isUserTabId(tab)) {
              handleTabChange(tab);
            }
          }}
        />
      )}
      {activeTab === "expenses" && (
        <ExpensesView
          initialCategoryId={expensesInitialCategoryId}
          onClearInitialCategory={() => setExpensesInitialCategoryId(null)}
        />
      )}
      {activeTab === "categories" && (
        <CategoriesView
          onNavigateToExpenses={handleNavigateToExpenses}
          onNavigateToBudgets={handleNavigateToBudgets}
          onNavigateTab={(tab) => {
            if (isUserTabId(tab)) {
              handleTabChange(tab);
            }
          }}
        />
      )}
      {activeTab === "wallets" && <WalletsView />}
      {activeTab === "budgets" && (
        <BudgetsView
          initialCategoryId={budgetsInitialCategoryId}
          onClearInitialCategory={() => setBudgetsInitialCategoryId(null)}
        />
      )}
      {activeTab === "split-bill" && <SplitBillView user={user} />}
      {activeTab === "reports" && <ReportsView />}
      {activeTab === "account" && (
        <AccountView user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
      )}
    </UserLayout>
  );
};
