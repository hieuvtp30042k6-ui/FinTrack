import { User, isValidRole } from "../types/auth";

const TOKEN_KEY = "fintrack_token";
const USER_KEY = "fintrack_user";

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string, remember = false): void => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
};

export const getUser = (): User | null => {
  const data = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    const user = JSON.parse(data) as User;
    // Section 13: Invalid role check (must be 'user' or 'admin')
    if (!user || !isValidRole(user.role)) {
      clearAuth();
      return null;
    }
    return user;
  } catch {
    clearAuth();
    return null;
  }
};

export const setUser = (user: User, remember?: boolean): void => {
  const data = JSON.stringify(user);
  if (remember !== undefined) {
    if (remember) {
      localStorage.setItem(USER_KEY, data);
    } else {
      sessionStorage.setItem(USER_KEY, data);
    }
  } else {
    if (localStorage.getItem(USER_KEY)) {
      localStorage.setItem(USER_KEY, data);
    } else {
      sessionStorage.setItem(USER_KEY, data);
    }
  }
};

export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};
