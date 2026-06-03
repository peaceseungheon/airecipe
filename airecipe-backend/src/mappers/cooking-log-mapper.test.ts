import { describe, expect, it } from "vitest";
import { rowToCookingLog, type CookingLogRow } from "./cooking-log-mapper";
import type { GeneratedRecipe } from "@/types/recipe";

const recipe: GeneratedRecipe = {
  dishName: "김치찌개",
  description: "얼큰한 김치찌개",
  servings: 2,
  cookTimeMinutes: 30,
  difficulty: "easy",
  ingredients: [{ name: "김치", quantity: 200, unit: "g" }],
  steps: [{ order: 1, instruction: "끓인다" }],
  tips: ["신김치가 좋다"],
  nutrition: {
    calories: 300,
    carbohydrates: 20,
    protein: 15,
    fat: 10,
    fiber: 5,
    healthNote: "균형",
  },
};

const row: CookingLogRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  photo_path: "user/abc.jpg",
  recipe,
  source_recipe_id: null,
  rating: 5,
  review: "국물이 끝내줘요",
  created_at: "2026-06-03T00:00:00.000Z",
};

describe("rowToCookingLog", () => {
  it("snake_case row를 camelCase 도메인으로 매핑하고 photoUrl을 주입한다", () => {
    const result = rowToCookingLog(row, "https://signed.example/abc");
    expect(result).toEqual({
      id: row.id,
      photoUrl: "https://signed.example/abc",
      recipe,
      rating: 5,
      review: "국물이 끝내줘요",
      createdAt: row.created_at,
    });
    // user_id / photo_path / source_recipe_id 는 도메인에 노출하지 않는다
    expect("user_id" in result).toBe(false);
    expect("photoPath" in result).toBe(false);
  });
});
