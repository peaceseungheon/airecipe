/**
 * SupabaseRecipeRepository — RecipeRepository의 Supabase 구현 (ADR-001).
 *
 * 책임:
 * - recipes 테이블 CRUD. snake_case ↔ camelCase 변환은 recipe-mapper에 위임.
 * - 소유자 격리: RLS(DB 레벨) + 애플리케이션 user_id 스코프(이중 방어).
 * - Supabase 오류는 RepositoryError로 변환(Service가 DB_ERROR로 매핑).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RepositoryError,
  type ListOptions,
  type ListResult,
  type RecipeRepository,
} from "@/repositories/recipe.repository";
import {
  recipeToInsertRow,
  rowToRecipe,
  type RecipeRow,
} from "@/mappers/recipe-mapper";
import type { GeneratedRecipe, Recipe } from "@/types";

const TABLE = "recipes";

export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByUser(userId: string, options: ListOptions): Promise<ListResult> {
    const from = (options.page - 1) * options.pageSize;
    const to = from + options.pageSize - 1;

    let query = this.db
      .from(TABLE)
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (options.favoriteOnly) {
      query = query.eq("is_favorite", true);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new RepositoryError("레시피 목록 조회에 실패했습니다.", error);
    }
    return {
      recipes: (data as RecipeRow[]).map(rowToRecipe),
      total: count ?? 0,
    };
  }

  async create(userId: string, recipe: GeneratedRecipe): Promise<Recipe> {
    const { data, error } = await this.db
      .from(TABLE)
      .insert(recipeToInsertRow(recipe, userId))
      .select("*")
      .single();

    if (error) {
      throw new RepositoryError("레시피 저장에 실패했습니다.", error);
    }
    return rowToRecipe(data as RecipeRow);
  }

  async findById(userId: string, id: string): Promise<Recipe | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new RepositoryError("레시피 조회에 실패했습니다.", error);
    }
    return data ? rowToRecipe(data as RecipeRow) : null;
  }

  async setFavorite(
    userId: string,
    id: string,
    isFavorite: boolean,
  ): Promise<Recipe> {
    const { data, error } = await this.db
      .from(TABLE)
      .update({ is_favorite: isFavorite })
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new RepositoryError("즐겨찾기 갱신에 실패했습니다.", error);
    }
    if (!data) {
      // 행이 없음 — 호출 측(Service)에서 findById로 존재/소유 여부를 이미 확인하므로
      // 여기 도달은 동시 삭제 등 경합. NOT_FOUND로 처리하도록 신호.
      throw new RepositoryError("갱신할 레시피를 찾을 수 없습니다.");
    }
    return rowToRecipe(data as RecipeRow);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("id", id)
      .select("id");

    if (error) {
      throw new RepositoryError("레시피 삭제에 실패했습니다.", error);
    }
    return (data?.length ?? 0) > 0;
  }
}
