"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CategoryRow,
  createCategory,
  deleteCategory,
  updateCategory,
} from "../lib/supabase";

type SettingsScreenProps = {
  categories: CategoryRow[];
  expensesByCategoryId: Record<number, number>;
  onChanged: () => Promise<void> | void;
};

export default function SettingsScreen({
  categories,
  expensesByCategoryId,
  onChanged,
}: SettingsScreenProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleCategories = useMemo(
    () => categories.filter((item) => item.is_active),
    [categories],
  );

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || creating) return;

    const trimmed = name.trim();
    const wasInactive = categories.some(
      (item) => item.name === trimmed && !item.is_active,
    );

    setCreating(true);
    setMessage(null);
    const result = await createCategory(trimmed);
    setCreating(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setName("");
    setMessage(
      wasInactive
        ? "삭제했던 카테고리를 다시 활성화했어요."
        : "카테고리를 추가했어요.",
    );
    await onChanged();
  }

  async function handleRename(id: number) {
    if (!editingName.trim()) return;
    setBusyId(id);
    setMessage(null);
    const result = await updateCategory(id, editingName);
    setBusyId(null);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setEditingId(null);
    setEditingName("");
    setMessage("카테고리 이름을 수정했어요.");
    await onChanged();
  }

  async function handleDelete(category: CategoryRow) {
    const usedCount = expensesByCategoryId[category.id] ?? 0;
    const confirmed = window.confirm(
      usedCount > 0
        ? `"${category.name}" 카테고리의 지출 ${usedCount}건을 기타로 옮긴 뒤 삭제할까요?`
        : `"${category.name}" 카테고리를 삭제할까요?`,
    );
    if (!confirmed) return;

    setBusyId(category.id);
    setMessage(null);
    const result = await deleteCategory(category.id);
    setBusyId(null);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setMessage(
      usedCount > 0
        ? `"${category.name}"을(를) 삭제했고, 관련 지출은 기타로 옮겼어요.`
        : `"${category.name}"을(를) 삭제했어요.`,
    );
    await onChanged();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4">
      <header className="mb-4">
        <h2 className="text-[1.125rem] font-semibold text-foreground">
          카테고리 설정
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          카테고리를 추가·수정·삭제할 수 있어요. 삭제 시 기존 지출은 기타로
          이동합니다.
        </p>
      </header>

      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 카테고리 이름"
          maxLength={20}
          className="box-border h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-accent px-3 text-[13px] font-medium text-white disabled:opacity-40"
        >
          추가
        </button>
      </form>

      {message ? (
        <p className="mb-3 text-[13px] text-muted" role="status">
          {message}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {visibleCategories.map((category) => {
          const usedCount = expensesByCategoryId[category.id] ?? 0;
          const isEditing = editingId === category.id;

          return (
            <li
              key={category.id}
              className="rounded-2xl bg-surface px-3 py-3"
            >
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    maxLength={20}
                    className="box-border h-10 min-w-0 flex-1 rounded-xl bg-background px-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                  <button
                    type="button"
                    disabled={busyId === category.id}
                    onClick={() => void handleRename(category.id)}
                    className="text-[13px] font-medium text-foreground"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditingName("");
                    }}
                    className="text-[13px] text-muted"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {category.name}
                      {category.is_protected ? (
                        <span className="ml-1.5 text-[11px] font-normal text-muted">
                          기본
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      지출 {usedCount}건
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(category.id);
                        setEditingName(category.name);
                      }}
                      className="text-[13px] text-muted hover:text-foreground"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      disabled={category.is_protected || busyId === category.id}
                      onClick={() => void handleDelete(category)}
                      className="text-[13px] text-muted hover:text-foreground disabled:opacity-30"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
