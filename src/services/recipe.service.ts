/**
 * RecipeService — 레시피 영속성 유스케이스 (저장/목록/즐겨찾기/삭제).
 * RecipeRepository 추상에만 의존(DIP). RepositoryError → ServiceError(ApiErrorCode) 매핑.
 *
 * 소유자 격리(ADR-005): [id] 연산에서 미존재·타인 소유를 모두 NOT_FOUND(404)로 수렴한다.
 * RLS(ADR-001) + user_id 스코프 하에서 타인 행은 빈 결과로 돌아와 "타인 소유"와 "없음"을
 * 구분할 수 없고, 존재 은닉(IDOR 정보 누설 방지) 관점에서도 404 통일이 안전하다.
 * FORBIDDEN(403)은 Sprint 1에서 발생시키지 않는다(ApiErrorCode에 예약만 유지).
 */
import {
  RepositoryError,
  type ListResult,
  type RecipeRepository,
} from "@/repositories/recipe.repository";
import { ServiceError } from "@/services/service-error";
import type { GeneratedRecipe, Recipe } from "@/types";

export interface ListInput {
  favoriteOnly?: boolean;
  page: number;
  pageSize: number;
}

export class RecipeService {
  constructor(private readonly repo: RecipeRepository) {}

  async list(userId: string, input: ListInput): Promise<ListResult> {
    try {
      return await this.repo.listByUser(userId, {
        favoriteOnly: input.favoriteOnly,
        page: input.page,
        pageSize: input.pageSize,
      });
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  async getById(userId: string, id: string): Promise<Recipe> {
    try {
      const recipe = await this.repo.findById(userId, id);
      if (!recipe) {
        // RLS + user_id 스코프상 미존재/타인 소유 모두 빈 결과 → 404 수렴(ADR-005).
        throw new ServiceError("NOT_FOUND", "레시피를 찾을 수 없습니다.");
      }
      return recipe;
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  async save(userId: string, recipe: GeneratedRecipe): Promise<Recipe> {
    try {
      return await this.repo.create(userId, recipe);
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  async setFavorite(
    userId: string,
    id: string,
    isFavorite: boolean,
  ): Promise<Recipe> {
    try {
      const existing = await this.repo.findById(userId, id);
      if (!existing) {
        throw new ServiceError("NOT_FOUND", "레시피를 찾을 수 없습니다.");
      }
      return await this.repo.setFavorite(userId, id, isFavorite);
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  async delete(userId: string, id: string): Promise<string> {
    try {
      const deleted = await this.repo.delete(userId, id);
      if (!deleted) {
        // 미존재/타인 소유 모두 삭제 0건 → 404 수렴(ADR-005).
        throw new ServiceError("NOT_FOUND", "레시피를 찾을 수 없습니다.");
      }
      return id;
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  private toServiceError(err: unknown): ServiceError {
    if (err instanceof ServiceError) return err;
    if (err instanceof RepositoryError) {
      return new ServiceError("DB_ERROR", err.message, err);
    }
    return new ServiceError(
      "INTERNAL_ERROR",
      "레시피 처리 중 오류가 발생했습니다.",
      err,
    );
  }
}
