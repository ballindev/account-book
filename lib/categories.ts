import type { CategoryRow } from "./supabase";

/** @deprecated DB categories를 사용하세요. 기본 시드 이름 참고용 */
export const DEFAULT_CATEGORY_NAMES = [
  "식비",
  "교통",
  "쇼핑",
  "문화",
  "기타",
] as const;

export function buildCategoryPromptList(categories: CategoryRow[]) {
  const names = categories.filter((item) => item.is_active).map((item) => item.name);
  return names.length > 0 ? names.join(", ") : DEFAULT_CATEGORY_NAMES.join(", ");
}
