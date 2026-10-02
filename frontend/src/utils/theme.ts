import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "fintrack_theme";
const THEME_EVENT = "fintrack_theme_changed";

/**
 * Lấy theme hiện tại từ localStorage (mặc định là 'light' hoặc theo system nếu đã lưu)
 */
export const getStoredTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") {
    return stored;
  }
  return "light";
};

/**
 * Kiểm tra xem theme thực tế hiện tại có phải là Dark hay không
 */
export const isEffectiveDark = (theme: ThemeMode): boolean => {
  if (typeof window === "undefined") return false;
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/**
 * Áp dụng class `dark` lên thẻ <html>
 */
export const applyThemeToDocument = (theme: ThemeMode): void => {
  if (typeof window === "undefined") return;
  const dark = isEffectiveDark(theme);
  const root = document.documentElement;
  if (dark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

/**
 * Lưu theme mới và phát event toàn hệ thống
 */
export const setTheme = (newTheme: ThemeMode): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  applyThemeToDocument(newTheme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: newTheme } }));
};

/**
 * Toggle nhanh giữa Sáng (Light) và Tối (Dark)
 */
export const toggleTheme = (): ThemeMode => {
  const current = getStoredTheme();
  const next: ThemeMode = isEffectiveDark(current) ? "light" : "dark";
  setTheme(next);
  return next;
};

/**
 * Hook React quản lý và lắng nghe sự thay đổi của Theme
 */
export const useTheme = (): {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
} => {
  const [theme, setLocalTheme] = useState<ThemeMode>(getStoredTheme);
  const [isDark, setIsDark] = useState<boolean>(() => isEffectiveDark(getStoredTheme()));

  const handleUpdate = useCallback((t: ThemeMode) => {
    setLocalTheme(t);
    setIsDark(isEffectiveDark(t));
    applyThemeToDocument(t);
  }, []);

  useEffect(() => {
    // Áp dụng theme ngay khi mount
    applyThemeToDocument(theme);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        const val = (e.newValue as ThemeMode) || "light";
        handleUpdate(val);
      }
    };

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeMode }>;
      if (customEvent.detail?.theme) {
        handleUpdate(customEvent.detail.theme);
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (getStoredTheme() === "system") {
        handleUpdate("system");
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_EVENT, handleCustom);
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_EVENT, handleCustom);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [handleUpdate, theme]);

  return {
    theme,
    isDark,
    setTheme: (t: ThemeMode) => setTheme(t),
    toggleTheme: () => toggleTheme(),
  };
};
