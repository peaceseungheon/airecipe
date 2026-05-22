/**
 * useMyRecipes — 저장된 레시피 목록 조회/저장/즐겨찾기/삭제 (SWR).
 *
 * 계약:
 *  - GET /api/recipes               → RecipeListResponse { data: Recipe[], meta }
 *  - POST /api/recipes              → { data: Recipe }       (저장)
 *  - PATCH /api/recipes/[id]/favorite { isFavorite } → { data: Recipe } (멱등, 낙관적 업데이트)
 *  - DELETE /api/recipes/[id]       → { data: { id } }
 *
 * 서버 상태(ADR-003): SWR 캐싱·재검증·낙관적 업데이트.
 * favorite은 토글이 아니라 목표값 명시(멱등) → 낙관적 업데이트와 일치.
 */
"use client";

import useSWR from "swr";
import { useCallback } from "react";
import type { GeneratedRecipe, ListMeta, Recipe } from "@/types";
import { listFetcher, requestData } from "./api-client";

export interface UseMyRecipesOptions {
  /** true면 즐겨찾기만, false/undefined면 전체 */
  favorite?: boolean;
  page?: number;
  pageSize?: number;
}

export interface UseMyRecipesResult {
  recipes: Recipe[];
  meta: ListMeta | null;
  isLoading: boolean;
  error: unknown;
  /** 생성된 레시피를 저장 → 저장된 Recipe 반환, 목록 캐시 무효화. */
  save: (recipe: GeneratedRecipe) => Promise<Recipe>;
  /** 즐겨찾기 목표값 설정(멱등). 낙관적 업데이트. */
  setFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  /** 삭제. 낙관적 제거 후 서버 확정. */
  remove: (id: string) => Promise<void>;
  /** 수동 재검증. */
  refresh: () => Promise<unknown>;
}

/** 쿼리 키 빌드 — favorite/page/pageSize를 URL로 직렬화 */
function buildListKey(opts: UseMyRecipesOptions): string {
  const params = new URLSearchParams();
  if (opts.favorite) params.set("favorite", "true");
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  const qs = params.toString();
  return `/api/recipes${qs ? `?${qs}` : ""}`;
}

export function useMyRecipes(
  opts: UseMyRecipesOptions = {},
): UseMyRecipesResult {
  const key = buildListKey(opts);
  const { data, error, isLoading, mutate } = useSWR<{
    data: Recipe[];
    meta: ListMeta;
  }>(key, listFetcher<Recipe>, { revalidateOnFocus: false });

  const recipes = data?.data ?? [];
  const meta = data?.meta ?? null;

  const save = useCallback(
    async (recipe: GeneratedRecipe) => {
      const saved = await requestData<Recipe>("/api/recipes", {
        method: "POST",
        body: JSON.stringify({ recipe }),
      });
      // 목록 캐시 무효화(저장 성공 후) — ADR-003.
      await mutate();
      return saved;
    },
    [mutate],
  );

  const setFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      // 낙관적 업데이트: 즉시 로컬 반영.
      const optimistic = data
        ? {
            ...data,
            data: data.data.map((r) =>
              r.id === id ? { ...r, isFavorite } : r,
            ),
          }
        : data;
      try {
        await mutate(
          async () => {
            await requestData<Recipe>(`/api/recipes/${id}/favorite`, {
              method: "PATCH",
              body: JSON.stringify({ isFavorite }),
            });
            return undefined; // 서버 재검증으로 정확한 목록 회수.
          },
          {
            optimisticData: optimistic,
            rollbackOnError: true,
            populateCache: false,
            revalidate: true,
          },
        );
      } catch (err) {
        // rollback은 SWR이 처리. 호출부가 메시지 표시할 수 있게 재던짐.
        throw err;
      }
    },
    [data, mutate],
  );

  const remove = useCallback(
    async (id: string) => {
      const optimistic = data
        ? { ...data, data: data.data.filter((r) => r.id !== id) }
        : data;
      await mutate(
        async () => {
          await requestData<{ id: string }>(`/api/recipes/${id}`, {
            method: "DELETE",
          });
          return undefined; // 재검증.
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          populateCache: false,
          revalidate: true,
        },
      );
    },
    [data, mutate],
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    recipes,
    meta,
    isLoading,
    error,
    save,
    setFavorite,
    remove,
    refresh,
  };
}
