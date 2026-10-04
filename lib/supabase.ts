import { createClient } from "@supabase/supabase-js";
import { normalizeCategory } from "./categories";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 .env.local에 설정해 주세요.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type ExpenseRow = {
  id: number;
  created_at: string;
  date: string;
  amount: number;
  description: string;
  category: string;
};

function isMissingCategoryColumn(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /column .*category.* does not exist/i.test(error.message ?? "")
  );
}

export async function fetchExpenses(): Promise<{
  data: ExpenseRow[];
  error: string | null;
  categorySupported: boolean;
}> {
  const withCategory = await supabase
    .from("expenses")
    .select("id, created_at, date, amount, description, category")
    .order("created_at", { ascending: false });

  if (!withCategory.error) {
    return {
      categorySupported: true,
      error: null,
      data: (withCategory.data ?? []).map((item) => ({
        ...item,
        category: normalizeCategory(item.category),
      })),
    };
  }

  if (!isMissingCategoryColumn(withCategory.error)) {
    return {
      data: [],
      error: withCategory.error.message,
      categorySupported: false,
    };
  }

  // category 컬럼이 아직 없을 때: 기존 데이터라도 보이게 폴백
  const fallback = await supabase
    .from("expenses")
    .select("id, created_at, date, amount, description")
    .order("created_at", { ascending: false });

  if (fallback.error) {
    return {
      data: [],
      error: fallback.error.message,
      categorySupported: false,
    };
  }

  return {
    categorySupported: false,
    error: null,
    data: (fallback.data ?? []).map((item) => ({
      ...item,
      category: "기타",
    })),
  };
}

export async function insertExpense(payload: {
  date: string;
  amount: number;
  description: string;
  category: string;
}) {
  const withCategory = await supabase.from("expenses").insert({
    date: payload.date,
    amount: payload.amount,
    description: payload.description,
    category: payload.category,
  });

  if (!withCategory.error) {
    return { error: null as string | null, categorySupported: true };
  }

  if (!isMissingCategoryColumn(withCategory.error)) {
    return {
      error: withCategory.error.message,
      categorySupported: false,
    };
  }

  const fallback = await supabase.from("expenses").insert({
    date: payload.date,
    amount: payload.amount,
    description: payload.description,
  });

  return {
    error: fallback.error?.message ?? null,
    categorySupported: false,
  };
}
