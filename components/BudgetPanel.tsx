"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  clearMonthlyBudget,
  getBudgetUsage,
  loadMonthlyBudget,
  saveMonthlyBudget,
} from "../lib/budget";
import {
  currentMonthKey,
  sumExpensesForMonth,
} from "../lib/expense-stats";
import type { ExpenseRow } from "../lib/supabase";

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

type BudgetPanelProps = {
  expenses: ExpenseRow[];
};

export default function BudgetPanel({ expenses }: BudgetPanelProps) {
  const monthKey = currentMonthKey();
  const spent = useMemo(
    () => sumExpensesForMonth(expenses, monthKey),
    [expenses, monthKey],
  );

  const [budget, setBudget] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadMonthlyBudget();
    setBudget(saved);
    setDraft(saved ? String(saved) : "");
    setEditing(!saved);
    setHydrated(true);
  }, []);

  const usage = getBudgetUsage(spent, budget);
  const [, monthNum] = monthKey.split("-");
  const monthLabel = `${Number(monthNum)}월`;

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const value = Number(draft.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) return;

    saveMonthlyBudget(value);
    setBudget(Math.round(value));
    setDraft(String(Math.round(value)));
    setEditing(false);
  }

  function handleClear() {
    clearMonthlyBudget();
    setBudget(null);
    setDraft("");
    setEditing(true);
  }

  if (!hydrated) {
    return (
      <div className="mb-3 rounded-2xl bg-surface px-3 py-3 text-[13px] text-muted">
        예산 불러오는 중...
      </div>
    );
  }

  const barWidth = budget
    ? `${Math.min(100, Math.max(0, usage.ratio * 100))}%`
    : "0%";

  const barColor =
    usage.level === "over"
      ? "#ff3b30"
      : usage.level === "warn"
        ? "#ff9500"
        : "#1d1d1f";

  return (
    <div className="mb-3 rounded-2xl bg-surface px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium text-foreground">
          {monthLabel} 예산
        </h3>
        {budget && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12px] text-muted transition-colors hover:text-foreground"
          >
            수정
          </button>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="예: 500000"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="box-border h-10 min-w-0 flex-1 rounded-xl bg-background px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-foreground/10"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-accent px-3 text-[13px] font-medium text-white disabled:opacity-40"
          >
            저장
          </button>
          {budget ? (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-2 text-[12px] text-muted"
            >
              삭제
            </button>
          ) : null}
        </form>
      ) : (
        <>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="font-mono text-[15px] font-medium tabular-nums text-foreground">
              {formatAmount(spent)}
              <span className="mx-1 font-sans text-[12px] font-normal text-muted">
                /
              </span>
              {formatAmount(budget ?? 0)}
              <span className="ml-0.5 font-sans text-[12px] font-normal text-muted">
                원
              </span>
            </p>
            <p
              className={`font-mono text-[13px] tabular-nums ${
                usage.level === "ok" ? "text-muted" : "text-foreground"
              }`}
            >
              {usage.percent}%
            </p>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: barWidth, backgroundColor: barColor }}
            />
          </div>

          {usage.level === "warn" ? (
            <p className="mt-2 text-[12px] leading-snug text-[#c93400]">
              예산의 80% 이상을 사용했어요. 남은 금액은{" "}
              {formatAmount(Math.max(0, usage.remaining ?? 0))}원입니다.
            </p>
          ) : null}

          {usage.level === "over" ? (
            <p className="mt-2 text-[12px] leading-snug text-[#ff3b30]">
              이번 달 예산을 {formatAmount(spent - (budget ?? 0))}원 초과했어요!
            </p>
          ) : null}

          {usage.level === "ok" && usage.remaining != null ? (
            <p className="mt-2 text-[12px] text-muted">
              남은 예산 {formatAmount(usage.remaining)}원
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
