import type { ExpenseRow } from "./supabase";

export type MonthlyTotal = {
  month: string;
  label: string;
  total: number;
};

export type CategoryTotal = {
  name: string;
  value: number;
};

export function buildMonthlyTotals(
  expenses: ExpenseRow[],
  options?: { year?: number },
): MonthlyTotal[] {
  const map = new Map<string, number>();
  const yearPrefix =
    typeof options?.year === "number" ? `${options.year}-` : null;

  for (const expense of expenses) {
    const month = expense.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (yearPrefix && !month.startsWith(yearPrefix)) continue;
    map.set(month, (map.get(month) ?? 0) + expense.amount);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => {
      const [year, monthNum] = month.split("-");
      return {
        month,
        label: yearPrefix
          ? `${Number(monthNum)}월`
          : `${year.slice(2)}.${Number(monthNum)}월`,
        total,
      };
    });
}

export function buildCategoryTotals(
  expenses: ExpenseRow[],
  options?: { year?: number },
): CategoryTotal[] {
  const yearPrefix =
    typeof options?.year === "number" ? `${options.year}-` : null;
  const map = new Map<string, number>();

  for (const expense of expenses) {
    if (yearPrefix && !expense.date.startsWith(yearPrefix)) continue;
    const category = expense.category?.trim() || "기타";
    map.set(category, (map.get(category) ?? 0) + expense.amount);
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function collectExpenseYears(expenses: ExpenseRow[]): number[] {
  const years = new Set<number>();
  for (const expense of expenses) {
    const year = Number(expense.date.slice(0, 4));
    if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
      years.add(year);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function resolveChartYears(expenses: ExpenseRow[]): number[] {
  const years = collectExpenseYears(expenses);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) {
    years.unshift(currentYear);
    years.sort((a, b) => b - a);
  }
  return years;
}
