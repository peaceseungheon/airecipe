/**
 * Recipe Mapper — DB row(snake_case) ↔ API DTO(camelCase) 변환 단일 위치.
 * 출처: ADR-001, _workspace/01_architect_architecture.md 5절.
 *
 * 규칙:
 * - 최상위 컬럼(dish_name, cook_time_minutes, is_favorite, created_at, user_id)은 snake → camel 변환 필수.
 * - jsonb 컬럼(ingredients/steps/nutrition/tips)은 camelCase로 저장되므로 그대로 통과.
 * - API DTO에는 user_id를 절대 노출하지 않는다 (서버 내부 격리용).
 * - snake_case가 API 경계에 새면 이 Mapper의 누락 = 경계면 버그.
 */
import type {
  GeneratedRecipe,
  Ingredient,
  NutritionInfo,
  Recipe,
  RecipeStep,
} from "@/types";

/** DB recipes 테이블 row 형태 (snake_case). */
export interface RecipeRow {
  id: string;
  user_id: string;
  dish_name: string;
  description: string;
  servings: number;
  cook_time_minutes: number;
  difficulty: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tips: string[];
  nutrition: NutritionInfo;
  is_favorite: boolean;
  created_at: string;
}

/** DB row → API DTO(Recipe). user_id는 제외한다. */
export function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    dishName: row.dish_name,
    description: row.description,
    servings: row.servings,
    cookTimeMinutes: row.cook_time_minutes,
    difficulty: row.difficulty as Recipe["difficulty"],
    ingredients: row.ingredients,
    steps: row.steps,
    tips: row.tips,
    nutrition: row.nutrition,
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
  };
}

/**
 * 저장용: GeneratedRecipe + userId → DB insert payload(snake_case).
 * id/created_at/is_favorite는 DB 기본값에 위임한다.
 */
export function recipeToInsertRow(
  recipe: GeneratedRecipe,
  userId: string,
): Omit<RecipeRow, "id" | "created_at" | "is_favorite"> {
  return {
    user_id: userId,
    dish_name: recipe.dishName,
    description: recipe.description,
    servings: recipe.servings,
    cook_time_minutes: recipe.cookTimeMinutes,
    difficulty: recipe.difficulty,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tips: recipe.tips,
    nutrition: recipe.nutrition,
  };
}
