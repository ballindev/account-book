import type { ExpenseRow } from "./supabase";
import { normalizeCategory } from "./categories";

export type MonthlyTotal = {
  month: string;
  label: string;
  total: number;
};

export type CategoryTotal = {
  name: string;
  value: number;
};

export function buildMonthlyTotals(expenses: ExpenseRow[]): MonthlyTotal[] {
  const map = new Map<string, number>();

  for (const expense of expenses) {
    const month = expense.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    map.set(month, (map.get(month) ?? 0) + expense.amount);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => {
      const [year, monthNum] = month.split("-");
      return {
        month,
        label: `${year.slice(2)}.${Number(monthNum)}월`,
        total,
      };
    });
}

export function buildCategoryTotals(expenses: ExpenseRow[]): CategoryTotal[] {
  const map = new Map<string, number>();

  for (const expense of expenses) {
    const category = normalizeCategory(expense.category);
    map.set(category, (map.get(category) ?? 0) + expense.amount);
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function currentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function sumExpensesForMonth(expenses: ExpenseRow[], monthKey: string) {
  return expenses
    .filter((item) => item.date.startsWith(monthKey))
    .reduce((sum, item) => sum + item.amount, 0);
}
