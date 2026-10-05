"use client";

import { useMemo, useState } from "react";
import type { ExpenseRow } from "../lib/supabase";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function formatCompactAmount(amount: number) {
  if (amount >= 10000) {
    const man = amount / 10000;
    return `${man % 1 === 0 ? man : man.toFixed(1)}만`;
  }
  return formatAmount(amount);
}

function toDateKey(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${month}-${dayText}`;
}

function todayKey() {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

type ExpenseCalendarProps = {
  expenses: ExpenseRow[];
  loading?: boolean;
  error?: string | null;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  onSelectExpense: (expense: ExpenseRow) => void;
};

export default function ExpenseCalendar({
  expenses,
  loading = false,
  error = null,
  selectedDate,
  onSelectedDateChange,
  onSelectExpense,
}: ExpenseCalendarProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const dailyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) {
      map.set(expense.date, (map.get(expense.date) ?? 0) + expense.amount);
    }
    return map;
  }, [expenses]);

  const selectedExpenses = useMemo(
    () => expenses.filter((item) => item.date === selectedDate),
    [expenses, selectedDate],
  );

  const selectedTotal = dailyTotals.get(selectedDate) ?? 0;

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateKey: string | null }> = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push({ day: null, dateKey: null });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        day,
        dateKey: toDateKey(viewYear, viewMonth, day),
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateKey: null });
    }

    return cells;
  }, [viewYear, viewMonth]);

  function moveMonth(offset: number) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  if (loading) {
    return (
      <p className="py-3 text-center text-[13px] text-muted">불러오는 중...</p>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl bg-surface px-3 py-3.5 text-center text-[13px] text-[#ff3b30]">
        지출 목록을 불러오지 못했어요: {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-surface px-2.5 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[28px] font-bold leading-none text-muted transition-colors hover:text-foreground"
            aria-label="이전 달"
          >
            ‹
          </button>
          <h3 className="text-[14px] font-medium text-foreground">
            {viewYear}년 {viewMonth + 1}월
          </h3>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[28px] font-bold leading-none text-muted transition-colors hover:text-foreground"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="py-1 text-center text-[11px] font-medium text-muted"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {calendarCells.map((cell, index) => {
            if (!cell.day || !cell.dateKey) {
              return <div key={`empty-${index}`} className="min-h-[52px]" />;
            }

            const total = dailyTotals.get(cell.dateKey) ?? 0;
            const isSelected = cell.dateKey === selectedDate;
            const isToday = cell.dateKey === todayKey();

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => onSelectedDateChange(cell.dateKey!)}
                className={`flex min-h-[52px] flex-col items-center rounded-xl px-0.5 py-1 transition-colors ${
                  isSelected
                    ? "bg-[#3a3a3c] text-white"
                    : isToday
                      ? "bg-background"
                      : "hover:bg-background"
                }`}
              >
                <span
                  className={`text-[12px] font-medium ${
                    isSelected ? "text-white" : "text-foreground"
                  }`}
                >
                  {cell.day}
                </span>
                {total > 0 ? (
                  <span
                    className={`mt-0.5 max-w-full truncate text-[9px] leading-tight tabular-nums ${
                      isSelected ? "text-white/85" : "text-[#ff3b30]"
                    }`}
                  >
                    {formatCompactAmount(total)}
                  </span>
                ) : (
                  <span className="mt-0.5 h-[11px]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
          <h4 className="text-[13px] font-medium text-foreground">
            {selectedDate} 내역
          </h4>
          <p className="font-mono text-[12px] tabular-nums text-muted">
            {selectedExpenses.length}건 · {formatAmount(selectedTotal)}원
          </p>
        </div>

        {selectedExpenses.length === 0 ? (
          <p className="rounded-2xl bg-surface px-3 py-3 text-center text-[13px] text-muted">
            이 날의 지출이 없습니다
          </p>
        ) : (
          <ul className="max-h-[14rem] touch-pan-y space-y-1.5 overflow-y-auto overscroll-contain">
            {selectedExpenses.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectExpense(item)}
                  className="flex min-h-[3rem] w-full min-w-0 items-center justify-between gap-2 rounded-2xl bg-surface px-3 py-2 text-left transition-colors hover:bg-black/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-[14px] font-medium text-foreground">
                        {item.description}
                      </p>
                      <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <p className="shrink-0 font-mono text-[14px] font-medium tabular-nums text-foreground">
                    {formatAmount(item.amount)}
                    <span className="ml-0.5 font-sans text-[11px] font-normal text-muted">
                      원
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { todayKey };
