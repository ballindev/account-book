"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNav, { AppTab } from "../components/BottomNav";
import ChatScreen from "../components/ChatScreen";
import ExpenseCalendar, { todayKey } from "../components/ExpenseCalendar";
import ExpenseCharts from "../components/ExpenseCharts";
import ExpenseFormModal from "../components/ExpenseFormModal";
import SettingsScreen from "../components/SettingsScreen";
import {
  CategoryRow,
  ExpenseRow,
  fetchCategories,
  fetchExpenses,
} from "../lib/supabase";

const TAB_TITLES: Record<AppTab, string> = {
  chat: "AI 가계부 챗봇",
  calendar: "지출 달력",
  chart: "지출 차트",
  settings: "설정",
};

type ModalState =
  | { open: false }
  | { open: true; mode: "create"; date: string }
  | { open: true; mode: "edit"; expense: ExpenseRow };

export default function Home() {
  const [tab, setTab] = useState<AppTab>("chat");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(todayKey());

  const reload = useCallback(async () => {
    const [expenseResult, categoryResult] = await Promise.all([
      fetchExpenses(),
      fetchCategories(),
    ]);

    if (expenseResult.error) {
      setExpenses([]);
      setError(expenseResult.error);
    } else {
      setExpenses(expenseResult.data);
      setError(null);
    }

    if (categoryResult.error) {
      setCategories([]);
      if (!expenseResult.error) {
        setError(categoryResult.error);
      }
    } else {
      setCategories(categoryResult.data);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const expensesByCategoryId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const expense of expenses) {
      map[expense.category_id] = (map[expense.category_id] ?? 0) + 1;
    }
    return map;
  }, [expenses]);

  const activeCategories = useMemo(
    () => categories.filter((item) => item.is_active),
    [categories],
  );

  return (
    <div className="app-shell relative mx-auto flex w-full max-w-md flex-col overflow-x-hidden bg-background">
      <header className="shrink-0 border-b border-black/5 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-center text-[1.125rem] font-semibold tracking-tight text-foreground">
          {TAB_TITLES[tab]}
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === "chat" ? <ChatScreen onSaved={reload} /> : null}

        {tab === "calendar" ? (
          <div className="relative min-h-0 flex-1">
            <div className="h-full overflow-y-auto overscroll-contain px-4 py-3 pb-20">
              <ExpenseCalendar
                expenses={expenses}
                loading={loading}
                error={error}
                selectedDate={calendarSelectedDate}
                onSelectedDateChange={setCalendarSelectedDate}
                onSelectExpense={(expense) =>
                  setModal({ open: true, mode: "edit", expense })
                }
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setModal({
                  open: true,
                  mode: "create",
                  date: calendarSelectedDate,
                })
              }
              className="absolute right-4 bottom-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#3a3a3c] text-white shadow-lg transition-colors hover:bg-[#2c2c2e]"
              aria-label="지출 추가"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        ) : null}

        {tab === "chart" ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {loading ? (
              <p className="py-6 text-center text-[13px] text-muted">
                불러오는 중...
              </p>
            ) : error ? (
              <p className="rounded-2xl bg-surface px-3 py-3.5 text-center text-[13px] text-[#ff3b30]">
                {error}
              </p>
            ) : (
              <ExpenseCharts expenses={expenses} />
            )}
          </div>
        ) : null}

        {tab === "settings" ? (
          <SettingsScreen
            categories={categories}
            expensesByCategoryId={expensesByCategoryId}
            onChanged={reload}
          />
        ) : null}
      </main>

      <BottomNav active={tab} onChange={setTab} />

      <ExpenseFormModal
        open={modal.open}
        mode={modal.open ? modal.mode : "create"}
        initialDate={
          modal.open && modal.mode === "create" ? modal.date : todayKey()
        }
        expense={modal.open && modal.mode === "edit" ? modal.expense : null}
        categories={activeCategories}
        onClose={() => setModal({ open: false })}
        onSaved={reload}
      />
    </div>
  );
}
