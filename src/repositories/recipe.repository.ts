/**
 * RecipeRepository — 레시피 데이터 접근 추상 (Repository 패턴, ADR-001).
 * Service는 이 인터페이스에만 의존하고 Supabase를 모른다(DIP).
 * 구현체: SupabaseRecipeRepository. 테스트에서는 Fake 주입.
 */
import type { GeneratedRecipe, Recipe } from "@/types";

export interface ListOptions {
  favoriteOnly?: boolean;
  page: number;
  pageSize: number;
}

export interface ListResult {
  recipes: Recipe[];
  total: number;
}

export interface RecipeRepository {
  /** 소유자(userId)의 레시피 목록 + 총 개수. */
  listByUser(userId: string, options: ListOptions): Promise<ListResult>;

  /** GeneratedRecipe를 userId 소유로 저장하고 저장된 Recipe 반환. */
  create(userId: string, recipe: GeneratedRecipe): Promise<Recipe>;

  /** 단건 조회. 없으면 null. (소유자 격리는 RLS + userId 스코프) */
  findById(userId: string, id: string): Promise<Recipe | null>;

  /** isFavorite 목표 값 설정(멱등). 갱신된 Recipe 반환. */
  setFavorite(userId: string, id: string, isFavorite: boolean): Promise<Recipe>;

  /** 삭제. 삭제된 행이 없으면 false. */
  delete(userId: string, id: string): Promise<boolean>;
}

/** 데이터 접근 오류 — Service가 ApiErrorCode(DB_ERROR)로 매핑한다. */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
