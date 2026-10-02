import React from "react";
import { User } from "../../types/auth";
import { AccountView } from "../user/AccountView";

interface AdminAccountViewProps {
  user: User;
  onUserUpdated: (updated: User) => void;
  onLogout?: () => void;
}

export const AdminAccountView: React.FC<AdminAccountViewProps> = ({
  user,
  onUserUpdated,
  onLogout,
}) => {
  return (
    <AccountView
      user={user}
      onUserUpdate={onUserUpdated}
      onUserUpdated={onUserUpdated}
      onLogout={onLogout}
    />
  );
};
