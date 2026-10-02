import React from "react";
import { useTheme } from "../utils/theme";
import { useTranslation } from "../utils/i18n";

interface ThemeAndLanguageBarProps {
  compact?: boolean;
  className?: string;
}

export const ThemeAndLanguageBar: React.FC<ThemeAndLanguageBarProps> = ({
  compact = false,
  className = "",
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLanguage, t } = useTranslation();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Nút chuyển đổi Ngôn ngữ */}
      <button
        type="button"
        onClick={toggleLanguage}
        title={lang === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
      >
        <span className="text-[13px]">{lang === "vi" ? "🇻🇳" : "🇬🇧"}</span>
        <span className="font-mono uppercase tracking-wider text-[11px]">
          {lang === "vi" ? "VI" : "EN"}
        </span>
      </button>

      {/* Nút chuyển đổi Chế độ Sáng / Tối */}
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? t("theme.light", "Giao diện Sáng") : t("theme.dark", "Giao diện Tối")}
        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 shadow-2xs transition-colors cursor-pointer flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-[18px]">
          {isDark ? "light_mode" : "dark_mode"}
        </span>
        {!compact && (
          <span className="sr-only">
            {isDark ? t("theme.light", "Sáng") : t("theme.dark", "Tối")}
          </span>
        )}
      </button>
    </div>
  );
};
