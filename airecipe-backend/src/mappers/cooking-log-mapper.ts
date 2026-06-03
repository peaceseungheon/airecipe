import type { GeneratedRecipe } from "@/types/recipe";
import type { CookingLog, CreateCookingLogInput } from "@/types/cooking-log";

export interface CookingLogRow {
  id: string;
  user_id: string;
  photo_path: string;
  recipe: GeneratedRecipe;
  source_recipe_id: string | null;
  rating: number;
  review: string;
  created_at: string;
}

/** DB row + 발급된 presigned URL → 도메인. 내부 식별자는 비노출. */
export function rowToCookingLog(row: CookingLogRow, photoUrl: string): CookingLog {
  return {
    id: row.id,
    photoUrl,
    recipe: row.recipe,
    rating: row.rating,
    review: row.review,
    createdAt: row.created_at,
  };
}

/** 생성 입력 → insert row(서버가 채우는 id/created_at 제외, photo_path 는 업로드 후 주입). */
export function inputToInsertRow(
  input: CreateCookingLogInput,
  userId: string,
  photoPath: string,
): Omit<CookingLogRow, "id" | "created_at"> {
  return {
    user_id: userId,
    photo_path: photoPath,
    recipe: input.recipe,
    source_recipe_id: input.sourceRecipeId ?? null,
    rating: input.rating,
    review: input.review,
  };
}
