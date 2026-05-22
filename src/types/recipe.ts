/**
 * 레시피 도메인 공유 타입 — 백엔드/프론트 SSOT.
 * API 계약: _workspace/01_architect_api_contract.md
 * API 경계는 항상 camelCase (DB snake_case는 mappers에서 변환).
 */

export type Difficulty = "easy" | "medium" | "hard";

/** 재료 1건 */
export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

/** 조리 단계 1건 (order는 1부터) */
export interface RecipeStep {
  order: number;
  instruction: string;
}

/** 1인분 기준 영양 정보 */
export interface NutritionInfo {
  calories: number;
  carbohydrates: number;
  protein: number;
  fat: number;
  fiber: number;
  healthNote: string;
}

/**
 * 생성된(저장 전) 레시피. id/createdAt/userId 없음.
 * AI tool use input_schema의 필드명이 이 타입과 일치해야 한다.
 */
export interface GeneratedRecipe {
  dishName: string;
  description: string;
  servings: number;
  cookTimeMinutes: number;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tips: string[];
  nutrition: NutritionInfo;
}

/**
 * 저장된 레시피. GeneratedRecipe + 영속성 필드.
 * userId는 응답 DTO에 포함하지 않는다(서버 내부 격리용).
 */
export interface Recipe extends GeneratedRecipe {
  id: string;
  isFavorite: boolean;
  createdAt: string; // ISO8601
}
