export const EXPENSE_CATEGORIES = [
  "식비",
  "교통",
  "쇼핑",
  "문화",
  "기타",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeCategory(value: unknown): ExpenseCategory {
  const text = String(value ?? "").trim();
  if (isExpenseCategory(text)) return text;

  // 이전 키워드 분류/유사어 보정
  if (/생활|여가|취미|영화|공연|구독/.test(text)) return "문화";
  return "기타";
}
