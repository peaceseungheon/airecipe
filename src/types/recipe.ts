/**
 * 도메인 타입 — baseline §A.2 / 03-API-CONTRACT §3.2.3, §3.3.3
 *
 * Recipe vs GeneratedRecipe 구분:
 * - GeneratedRecipe: AI 생성 결과(저장 전). id/createdAt/isFavorite 없음.
 * - Recipe: 저장된 레시피. GeneratedRecipe + { id, isFavorite, createdAt }.
 *
 * 응답에는 userId가 포함되지 않는다 (03 §3.10 #4 — 서버 내부 격리).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Step {
  order: number;
  instruction: string;
}

export interface Nutrition {
  calories: number;
  carbohydrates: number;
  protein: number;
  fat: number;
  fiber: number;
  healthNote: string;
}

export interface GeneratedRecipe {
  dishName: string;
  description: string;
  servings: number;
  cookTimeMinutes: number;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: Step[];
  tips: string[];
  nutrition: Nutrition;
}

export interface Recipe extends GeneratedRecipe {
  id: string;
  isFavorite: boolean;
  createdAt: string;
}
