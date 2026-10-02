import { useState, useEffect, useCallback } from "react";

const PRIVACY_STORAGE_KEY = "fintrack_privacy_mode";
const PRIVACY_EVENT = "fintrack_privacy_changed";

/**
 * Kiểm tra trạng thái ẩn số dư hiện tại trong localStorage
 */
export const getPrivacyMode = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PRIVACY_STORAGE_KEY) === "true";
};

/**
 * Lưu và phát event thay đổi trạng thái ẩn số dư trên toàn bộ tab/views
 */
export const setPrivacyMode = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRIVACY_STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent(PRIVACY_EVENT, { detail: { isPrivate: enabled } }));
};

/**
 * Toggle trạng thái riêng tư (bật -> tắt, tắt -> bật)
 */
export const togglePrivacyMode = (): boolean => {
  const next = !getPrivacyMode();
  setPrivacyMode(next);
  return next;
};

/**
 * React Hook đồng bộ trạng thái riêng tư thời gian thực giữa các component
 */
export const usePrivacyMode = (): [boolean, () => void, (val: boolean) => void] => {
  const [isPrivate, setIsPrivate] = useState<boolean>(getPrivacyMode);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PRIVACY_STORAGE_KEY) {
        setIsPrivate(e.newValue === "true");
      }
    };

    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<{ isPrivate: boolean }>;
      if (custom.detail) {
        setIsPrivate(custom.detail.isPrivate);
      } else {
        setIsPrivate(getPrivacyMode());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(PRIVACY_EVENT, handleCustomChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(PRIVACY_EVENT, handleCustomChange);
    };
  }, []);

  const toggle = useCallback(() => {
    togglePrivacyMode();
  }, []);

  const setExplicit = useCallback((val: boolean) => {
    setPrivacyMode(val);
  }, []);

  const result = [isPrivate, toggle, setExplicit] as unknown as [
    boolean,
    () => void,
    (val: boolean) => void
  ] & {
    isPrivate: boolean;
    toggle: () => void;
    setExplicit: (val: boolean) => void;
  };
  result.isPrivate = isPrivate;
  result.toggle = toggle;
  result.setExplicit = setExplicit;

  return result;
};

/**
 * Hàm che số dư khi ở chế độ riêng tư
 * @param content Nội dung tiền tệ gốc (chuỗi hoặc số)
 * @param isPrivate Trạng thái riêng tư (mặc định true)
 * @param maskFormat Ký tự che dấu (mặc định "••••••••")
 */
export const maskBalance = (
  content?: string | number | null,
  isPrivate: boolean = true,
  maskFormat: string = "••••••••"
): string => {
  if (!isPrivate) return content !== undefined && content !== null ? String(content) : "";
  return maskFormat;
};
