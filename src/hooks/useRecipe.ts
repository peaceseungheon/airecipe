/**
 * useRecipe — 저장된 단건 레시피 조회 (id 기준), GET /api/recipes/[id] (계약 2.5 / ADR-004).
 *
 * 딥링크/새로고침을 지원하기 위해 목록 캐시가 아니라 단건 엔드포인트를 직접 호출한다.
 * SWR 키는 `/api/recipes/[id]`로 목록(`/api/recipes`) 캐시와 독립적이다.
 *
 * 소유권 정책(ADR-005): 없음/잘못된 id/타인 소유는 모두 404 NOT_FOUND로 수렴(403 없음).
 *  → 404는 notFound로, 그 외(401/503/네트워크)는 error로 노출한다.
 *
 * favorite/delete는 멱등 계약(4/5)을 따르며, 성공 시 단건 SWR 캐시와 목록 캐시 모두 무효화한다.
 */
"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import type { Recipe } from "@/types";
import { ApiClientError, requestData } from "./api-client";

export interface UseRecipeResult {
  recipe: Recipe | null;
  isLoading: boolean;
  /** 404 — 없음/타인 소유/잘못된 id(ADR-005 수렴). */
  notFound: boolean;
  /** 404 외 오류(401/503/네트워크 등). */
  error: unknown;
  setFavorite: (target: boolean) => Promise<void>;
  remove: () => Promise<void>;
}

const recipeKey = (id: string) => `/api/recipes/${id}`;

/** 목록 캐시(`/api/recipes`, `/api/recipes?...`) 전체를 무효화. */
function isListKey(k: unknown): boolean {
  return typeof k === "string" && k.startsWith("/api/recipes");
}

export function useRecipe(id: string): UseRecipeResult {
  const { mutate: globalMutate } = useSWRConfig();
  const key = recipeKey(id);

  const { data, error, isLoading, mutate } = useSWR<Recipe>(
    key,
    (url: string) => requestData<Recipe>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const notFound =
    error instanceof ApiClientError && error.code === "NOT_FOUND";

  const setFavorite = useCallback(
    async (target: boolean) => {
      await mutate(
        async () => {
          // PATCH는 갱신된 Recipe를 반환 → 단건 캐시를 그 값으로 채운다.
          return requestData<Recipe>(`/api/recipes/${id}/favorite`, {
            method: "PATCH",
            body: JSON.stringify({ isFavorite: target }),
          });
        },
        {
          optimisticData: data ? { ...data, isFavorite: target } : data,
          rollbackOnError: true,
          revalidate: false,
        },
      );
      // 목록/홈 미리보기 정합을 위해 목록 캐시 무효화.
      await globalMutate(isListKey, undefined, { revalidate: true });
    },
    [data, id, mutate, globalMutate],
  );

  const remove = useCallback(async () => {
    await requestData<{ id: string }>(`/api/recipes/${id}`, {
      method: "DELETE",
    });
    // 단건 캐시 제거 + 목록 무효화.
    await mutate(undefined, { revalidate: false });
    await globalMutate(isListKey, undefined, { revalidate: true });
  }, [id, mutate, globalMutate]);

  return {
    recipe: data ?? null,
    isLoading,
    notFound,
    // 404는 notFound로 분리 노출하므로 error에서는 제외.
    error: notFound ? undefined : error,
    setFavorite,
    remove,
  };
}
