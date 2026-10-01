"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ExpenseRow, supabase } from "../lib/supabase";

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

const fieldClassName =
  "box-border h-14 w-full max-w-full min-h-[56px] min-w-0 rounded-xl bg-background px-4 text-lg text-foreground outline-none transition placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-foreground/10 sm:h-12 sm:min-h-0 sm:text-[15px]";

export default function Home() {
  const [date, setDate] = useState(todayString);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("id, created_at, date, amount, description")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setExpenses([]);
      return;
    }

    setExpenses(data ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      await loadExpenses();
      if (!cancelled) setLoading(false);
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [loadExpenses]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(/,/g, ""));
    if (
      !date ||
      !description.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("expenses").insert({
      date,
      amount: parsedAmount,
      description: description.trim(),
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setAmount("");
    setDescription("");
    setDate(todayString());
    await loadExpenses();
    setSaving(false);
  }

  async function handleDelete(id: number) {
    setError(null);

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setExpenses((prev) => prev.filter((item) => item.id !== id));
  }

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex w-full flex-1 flex-col items-center px-5 py-12 sm:px-8 sm:py-16 md:py-20">
      <main className="animate-fade-up w-full max-w-md">
        <header className="mb-12 sm:mb-14">
          <h1 className="text-[2rem] font-semibold tracking-tight text-foreground sm:text-[1.75rem] md:text-[2rem]">
            나의 스마트 가계부
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted sm:text-[15px]">
            날짜 · 금액 · 내용만 적으면 지출이 정리됩니다
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="w-full rounded-2xl bg-surface px-5 py-7 sm:px-7 sm:py-8"
        >
          <div className="flex min-w-0 flex-col gap-8 sm:gap-6">
            <label className="flex min-w-0 flex-col gap-2.5">
              <span className="text-[15px] font-medium text-muted sm:text-[13px]">
                날짜
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${fieldClassName} text-base sm:text-[15px]`}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-2.5">
              <span className="text-[15px] font-medium text-muted sm:text-[13px]">
                금액
              </span>
              <input
                type="number"
                required
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="12000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${fieldClassName} font-mono tabular-nums`}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-2.5">
              <span className="text-[15px] font-medium text-muted sm:text-[13px]">
                내용
              </span>
              <input
                type="text"
                required
                maxLength={80}
                placeholder="점심 식사"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-9 flex h-14 min-h-[56px] w-full items-center justify-center rounded-xl bg-accent text-[17px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 sm:mt-8 sm:h-12 sm:min-h-0 sm:text-[15px]"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </form>

        {error ? (
          <p className="mt-6 text-[15px] text-muted" role="alert">
            {error}
          </p>
        ) : null}

        <section
          className="mt-14 w-full animate-fade-up sm:mt-16"
          style={{ animationDelay: "60ms" }}
        >
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-[17px] font-medium text-foreground sm:text-[15px]">
              지출 내역
            </h2>
            <p className="font-mono text-[15px] tabular-nums text-muted sm:text-[13px]">
              합계{" "}
              <span className="text-[17px] font-medium text-foreground sm:text-[15px]">
                {formatAmount(total)}
                <span className="ml-0.5 font-sans text-[13px] font-normal text-muted">
                  원
                </span>
              </span>
            </p>
          </div>

          {loading ? (
            <p className="py-12 text-center text-[15px] text-muted">
              불러오는 중...
            </p>
          ) : expenses.length === 0 ? (
            <p className="py-12 text-center text-[15px] text-muted">
              아직 저장된 지출이 없습니다
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {expenses.map((item) => (
                <li
                  key={item.id}
                  className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-5 sm:px-6 sm:py-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-medium tracking-tight text-foreground sm:text-[15px]">
                      {item.description}
                    </p>
                    <p className="mt-1.5 text-[15px] text-muted sm:text-[13px]">
                      {item.date}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-right font-mono text-[1.35rem] font-medium leading-none tabular-nums tracking-tight text-foreground sm:text-xl">
                      {formatAmount(item.amount)}
                      <span className="ml-0.5 font-sans text-[13px] font-normal text-muted">
                        원
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[15px] text-muted transition-colors hover:text-foreground sm:min-h-0 sm:min-w-0 sm:text-[13px]"
                      aria-label={`${item.description} 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
