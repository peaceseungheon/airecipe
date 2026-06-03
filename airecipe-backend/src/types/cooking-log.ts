import type { GeneratedRecipe } from "./recipe";

/** 저장된 요리 기록(도메인). photoUrl 은 조회 시 발급되는 presigned URL. */
export interface CookingLog {
  id: string;
  photoUrl: string;
  recipe: GeneratedRecipe;
  rating: number; // 1..5
  review: string;
  createdAt: string; // ISO8601
}

/** 생성 입력(검증 통과 후). image 는 base64 data URI. */
export interface CreateCookingLogInput {
  image: string; // "data:image/jpeg;base64,..."
  mimeType: string; // "image/jpeg" 등
  recipe: GeneratedRecipe;
  sourceRecipeId?: string | null;
  rating: number;
  review: string;
}
