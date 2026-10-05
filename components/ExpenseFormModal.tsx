"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CategoryRow,
  ExpenseRow,
  deleteExpense,
  insertExpense,
  updateExpense,
} from "../lib/supabase";

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type ExpenseFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialDate?: string;
  expense?: ExpenseRow | null;
  categories: CategoryRow[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export default function ExpenseFormModal({
  open,
  mode,
  initialDate,
  expense,
  categories,
  onClose,
  onSaved,
}: ExpenseFormModalProps) {
  const activeCategories = useMemo(
    () => categories.filter((item) => item.is_active),
    [categories],
  );

  const defaultCategoryId =
    activeCategories.find((item) => item.is_protected || item.name === "기타")
      ?.id ??
    activeCategories[0]?.id ??
    0;

  const [date, setDate] = useState(todayString());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && expense) {
      setDate(expense.date);
      setDescription(expense.description);
      setCategoryId(expense.category_id || defaultCategoryId);
      setAmount(String(expense.amount));
    } else {
      setDate(initialDate || todayString());
      setDescription("");
      setCategoryId(defaultCategoryId);
      setAmount("");
    }

    setError(null);
    setConfirmDelete(false);
    setSaving(false);
  }, [open, mode, expense, initialDate, defaultCategoryId]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(/,/g, ""));
    const selected = activeCategories.find((item) => item.id === categoryId);

    if (!date || !description.trim()) {
      setError("날짜와 내용을 입력해 주세요.");
      return;
    }
    if (!selected) {
      setError("카테고리를 선택해 주세요.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("올바른 금액을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      date,
      amount: Math.round(parsedAmount),
      description: description.trim(),
      category_id: selected.id,
      category: selected.name,
    };

    const result =
      mode === "edit" && expense
        ? await updateExpense(expense.id, payload)
        : await insertExpense(payload);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    await onSaved();
    onClose();
  }

  async function handleDeleteConfirm() {
    if (!expense) return;

    setSaving(true);
    setError(null);
    const result = await deleteExpense(expense.id);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      setConfirmDelete(false);
      return;
    }

    await onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="팝업 닫기"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:pb-5">
        {confirmDelete ? (
          <div className="py-2">
            <h2 className="text-center text-[1.05rem] font-semibold text-foreground">
              삭제하시겠습니까?
            </h2>
            <p className="mt-2 text-center text-[13px] text-muted">
              이 지출 내역을 삭제하면 되돌릴 수 없어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDeleteConfirm()}
                className="h-11 rounded-xl bg-[#ff3b30] text-[14px] font-medium text-white disabled:opacity-50"
              >
                {saving ? "삭제 중..." : "확인"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmDelete(false)}
                className="h-11 rounded-xl bg-surface text-[14px] font-medium text-foreground"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[1.05rem] font-semibold text-foreground">
                {mode === "edit" ? "지출 수정" : "지출 입력"}
              </h2>
              {mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-[13px] font-medium text-[#ff3b30]"
                >
                  삭제
                </button>
              ) : (
                <span className="w-10" />
              )}
            </div>

            <div className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">날짜</span>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="box-border h-11 w-full rounded-xl bg-surface px-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">내용</span>
                <input
                  type="text"
                  required
                  maxLength={80}
                  placeholder="예: 점심 식사"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="box-border h-11 w-full rounded-xl bg-surface px-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">
                  카테고리
                </span>
                <select
                  required
                  value={categoryId || ""}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="box-border h-11 w-full rounded-xl bg-surface px-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
                >
                  {activeCategories.length === 0 ? (
                    <option value="">카테고리 없음</option>
                  ) : (
                    activeCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">금액</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="예: 12000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="box-border h-11 w-full rounded-xl bg-surface px-3 font-mono text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
                />
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-[13px] text-[#ff3b30]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={saving || activeCategories.length === 0}
                className="h-11 rounded-xl bg-accent text-[14px] font-medium text-white disabled:opacity-40"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="h-11 rounded-xl bg-surface text-[14px] font-medium text-foreground"
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
