const BUDGET_STORAGE_KEY = "account-book-monthly-budget";

export function loadMonthlyBudget(): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value);
  } catch {
    return null;
  }
}

export function saveMonthlyBudget(amount: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUDGET_STORAGE_KEY, String(Math.round(amount)));
}

export function clearMonthlyBudget() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BUDGET_STORAGE_KEY);
}

export function getBudgetUsage(spent: number, budget: number | null) {
  if (!budget || budget <= 0) {
    return {
      ratio: 0,
      percent: 0,
      remaining: null as number | null,
      level: "none" as const,
    };
  }

  const ratio = spent / budget;
  const percent = Math.min(999, Math.round(ratio * 100));
  const remaining = budget - spent;

  let level: "ok" | "warn" | "over" = "ok";
  if (ratio >= 1) level = "over";
  else if (ratio >= 0.8) level = "warn";

  return { ratio, percent, remaining, level };
}
