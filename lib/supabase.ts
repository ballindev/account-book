import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 .env.local에 설정해 주세요.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type CategoryRow = {
  id: number;
  name: string;
  is_default: boolean;
  is_active: boolean;
  is_protected: boolean;
  created_at: string;
  updated_at: string;
};

export type ExpenseRow = {
  id: number;
  created_at: string;
  date: string;
  amount: number;
  description: string;
  category_id: number;
  category: string;
};

type ExpenseQueryRow = {
  id: number;
  created_at: string;
  date: string;
  amount: number;
  description: string;
  category_id: number | null;
  category: string | null;
  categories: { id: number; name: string } | { id: number; name: string }[] | null;
};

function categoryNameFromJoin(
  row: ExpenseQueryRow,
  fallback = "기타",
) {
  const joined = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;
  return joined?.name || row.category || fallback;
}

export async function fetchCategories(options?: {
  activeOnly?: boolean;
}): Promise<{ data: CategoryRow[]; error: string | null }> {
  let query = supabase
    .from("categories")
    .select("id, name, is_default, is_active, is_protected, created_at, updated_at")
    .order("id", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as CategoryRow[], error: null };
}

export async function fetchExpenses(): Promise<{
  data: ExpenseRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, created_at, date, amount, description, category_id, category, categories(id, name)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = (data ?? []) as unknown as ExpenseQueryRow[];

  return {
    error: null,
    data: rows.map((item) => ({
      id: item.id,
      created_at: item.created_at,
      date: item.date,
      amount: item.amount,
      description: item.description,
      category_id: item.category_id ?? 0,
      category: categoryNameFromJoin(item),
    })),
  };
}

export async function insertExpense(payload: {
  date: string;
  amount: number;
  description: string;
  category_id: number;
  category: string;
}) {
  const { error } = await supabase.from("expenses").insert({
    date: payload.date,
    amount: payload.amount,
    description: payload.description,
    category_id: payload.category_id,
    category: payload.category,
  });

  return { error: error?.message ?? null };
}

export async function updateExpense(
  id: number,
  payload: {
    date: string;
    amount: number;
    description: string;
    category_id: number;
    category: string;
  },
) {
  const { error } = await supabase
    .from("expenses")
    .update({
      date: payload.date,
      amount: payload.amount,
      description: payload.description,
      category_id: payload.category_id,
      category: payload.category,
    })
    .eq("id", id);

  return { error: error?.message ?? null };
}

export async function deleteExpense(id: number) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function createCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { data: null as CategoryRow | null, error: "카테고리 이름을 입력해 주세요." };
  }

  // 소프트 삭제된 동일 이름이 있으면 다시 활성화
  const existing = await supabase
    .from("categories")
    .select("id, name, is_default, is_active, is_protected, created_at, updated_at")
    .eq("name", trimmed)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: existing.error.message };
  }

  if (existing.data) {
    if (existing.data.is_active) {
      return { data: null, error: "이미 사용 중인 카테고리 이름이에요." };
    }

    const { data, error } = await supabase
      .from("categories")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", existing.data.id)
      .select("id, name, is_default, is_active, is_protected, created_at, updated_at")
      .single();

    return {
      data: (data as CategoryRow | null) ?? null,
      error: error?.message ?? null,
    };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: trimmed,
      is_default: false,
      is_active: true,
      is_protected: false,
    })
    .select("id, name, is_default, is_active, is_protected, created_at, updated_at")
    .single();

  if (error?.message?.includes("categories_name_unique")) {
    return {
      data: null,
      error: "이미 있는 카테고리 이름이에요. 다시 시도해 주세요.",
    };
  }

  return {
    data: (data as CategoryRow | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function updateCategory(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "카테고리 이름을 입력해 주세요." };
  }

  const { error } = await supabase
    .from("categories")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  // 표시용 텍스트 컬럼도 함께 동기화
  await supabase
    .from("expenses")
    .update({ category: trimmed })
    .eq("category_id", id);

  return { error: null as string | null };
}

export async function deleteCategory(id: number) {
  const { data: target, error: targetError } = await supabase
    .from("categories")
    .select("id, name, is_protected")
    .eq("id", id)
    .single();

  if (targetError || !target) {
    return { error: targetError?.message ?? "카테고리를 찾을 수 없어요." };
  }

  if (target.is_protected) {
    return { error: "기본 카테고리(기타)는 삭제할 수 없어요." };
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_protected", true)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (fallbackError || !fallback) {
    return { error: "대체 카테고리(기타)를 찾을 수 없어요." };
  }

  if (fallback.id === id) {
    return { error: "기본 카테고리는 삭제할 수 없어요." };
  }

  const { error: moveError } = await supabase
    .from("expenses")
    .update({ category_id: fallback.id, category: fallback.name })
    .eq("category_id", id);

  if (moveError) {
    return { error: moveError.message };
  }

  const { error: softDeleteError } = await supabase
    .from("categories")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  return { error: softDeleteError?.message ?? null };
}

export function resolveCategory(
  categories: CategoryRow[],
  categoryName: string | undefined,
) {
  const active = categories.filter((item) => item.is_active);
  const fallback =
    active.find((item) => item.is_protected || item.name === "기타") ??
    active[0] ??
    null;

  if (!categoryName) {
    return fallback;
  }

  const matched = active.find((item) => item.name === categoryName.trim());
  return matched ?? fallback;
}
