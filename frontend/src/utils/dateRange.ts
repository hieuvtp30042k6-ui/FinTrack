export type PeriodType = "day" | "week" | "month" | "quarter" | "year" | "custom";

export interface DateRangeResult {
  from: string;
  to: string;
  label: string;
}

export const padZero = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

export const getPresetDateRange = (
  period: PeriodType,
  customFrom?: string,
  customTo?: string
): DateRangeResult => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  if (period === "day") {
    const todayStr = `${year}-${padZero(month + 1)}-${padZero(now.getDate())}`;
    return {
      from: todayStr,
      to: todayStr,
      label: `Hôm nay (${padZero(now.getDate())}/${padZero(month + 1)}/${year})`,
    };
  }

  if (period === "week") {
    const day = now.getDay();
    // Monday as start of week: day 0 is Sunday -> -6, else 1 - day
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mStr = `${monday.getFullYear()}-${padZero(monday.getMonth() + 1)}-${padZero(monday.getDate())}`;
    const sStr = `${sunday.getFullYear()}-${padZero(sunday.getMonth() + 1)}-${padZero(sunday.getDate())}`;

    return {
      from: mStr,
      to: sStr,
      label: `Tuần này (${formatDateDisplay(mStr)} - ${formatDateDisplay(sStr)})`,
    };
  }

  if (period === "quarter") {
    const quarter = Math.floor(month / 3);
    const startMonth = quarter * 3;
    const endMonth = startMonth + 2;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, endMonth + 1, 0);

    const fromStr = `${startDate.getFullYear()}-${padZero(startDate.getMonth() + 1)}-01`;
    const toStr = `${endDate.getFullYear()}-${padZero(endDate.getMonth() + 1)}-${padZero(endDate.getDate())}`;

    return {
      from: fromStr,
      to: toStr,
      label: `Quý ${quarter + 1}/${year} (${formatDateDisplay(fromStr)} - ${formatDateDisplay(toStr)})`,
    };
  }

  if (period === "year") {
    const fromStr = `${year}-01-01`;
    const toStr = `${year}-12-31`;
    return {
      from: fromStr,
      to: toStr,
      label: `Năm ${year} (01/01/${year} - 31/12/${year})`,
    };
  }

  if (period === "custom") {
    const f = customFrom || `${year}-${padZero(month + 1)}-01`;
    const t = customTo || `${year}-${padZero(month + 1)}-${padZero(now.getDate())}`;
    return {
      from: f,
      to: t,
      label: `${formatDateDisplay(f)} - ${formatDateDisplay(t)}`,
    };
  }

  // Default "month"
  const endDate = new Date(year, month + 1, 0);
  const fromStr = `${year}-${padZero(month + 1)}-01`;
  const toStr = `${year}-${padZero(month + 1)}-${padZero(endDate.getDate())}`;

  return {
    from: fromStr,
    to: toStr,
    label: `Tháng ${month + 1}/${year} (${formatDateDisplay(fromStr)} - ${formatDateDisplay(toStr)})`,
  };
};
