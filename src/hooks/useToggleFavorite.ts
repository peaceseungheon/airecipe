/**
 * useToggleFavorite — 즐겨찾기 PATCH 훅 (Phase 4)
 *
 * SSOT: 03 §3.6 (PATCH /api/recipes/[id]/favorite — 멱등 목표값 명시).
 *       baseline §B D4·D5·D10·D13 + ADR-013 D19·D20.
 *
 * **재개 시 정정 (2026-05-25)**: 카드 목록에서 카드별 hook 호출 불가(rules of hooks) →
 * 시그니처를 id 가변(`toggle(id, target)`)으로 변경. 단일 hook 인스턴스를 다양한 카드에 공유.
 * `pendingId`로 진행 중인 id를 추적(카드별 pending UI).
 *
 * 책임:
 * 1. `toggleFavorite(id, { isFavorite: target }, auth)` 호출 (recipes.ts 단일 경로).
 * 2. **호출 측이 prev 보관 + 낙관적 UI** — 호출 측이 toggle 호출 전 setOptimistic(target),
 *    호출 후 null 반환(실패) 시 setOptimistic(prev)로 직접 처리(D4).
 *    훅은 성공 시 갱신된 Recipe 반환 (상세 화면이 mutate로 직접 갱신 — D5).
 * 3. 성공 시 `useRecipeCacheTrigger.invalidate()` 호출 1회 (D13) — 마이 목록 자동 refetch.
 * 4. 401 자동 재시도는 apiFetch 단일 위치 (ADR-010 D3) — `refresh` 주입만.
 * 5. 직전 in-flight abort + cancelled 플래그 (멱등 보장 + 동시성 — AC4.5).
 *    같은 id를 두 번 빠르게 호출 시 마지막 의도가 최종 (멱등 — 03 §3.6.2).
 *
 * 반환:
 *   { toggle: (id, target) => Promise<Recipe | null>, pendingId: string | null, error, reset }
 *   - 성공: 갱신된 Recipe (호출 측이 받아 mutate)
 *   - 실패·취소: null (호출 측이 rollback 트리거)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, toggleFavorite } from '../services';
import type { ApiErrorCode } from '../types/api';
import type { Recipe } from '../types/recipe';

import { useRecipeCacheTrigger } from './useRecipeCache';
import { useTossUserId } from './useTossUserId';

export interface UseToggleFavoriteResult {
  toggle: (id: string, target: boolean) => Promise<Recipe | null>;
  /** 현재 진행 중인 id, 없으면 null. 카드별 pending UI 판정용 (`pendingId === card.id`). */
  pendingId: string | null;
  error: string | null;
  reset: () => void;
}

export function useToggleFavorite(): UseToggleFavoriteResult {
  const { tossUserId, refresh } = useTossUserId();
  const { invalidate } = useRecipeCacheTrigger();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const toggle = useCallback(
    async (id: string, target: boolean): Promise<Recipe | null> => {
      if (tossUserId === undefined) {
        setError(ERROR_CODE_MESSAGES.UNAUTHORIZED);
        return null;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPendingId(id);
      setError(null);

      try {
        const updated = await toggleFavorite(
          id,
          { isFavorite: target },
          { tossUserId, refreshTossUserId: refresh },
        );
        if (controller.signal.aborted) return null;
        invalidate();
        return updated;
      } catch (err) {
        if (controller.signal.aborted) return null;
        setError(toUserMessage(err));
        return null;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (!controller.signal.aborted) {
          setPendingId((current) => (current === id ? null : current));
        }
      }
    },
    [tossUserId, refresh, invalidate],
  );

  return { toggle, pendingId, error, reset };
}

const ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: '입력을 다시 확인해 주세요.',
  UNAUTHORIZED: '로그인이 필요해요. 잠시 후 다시 시도해 주세요.',
  FORBIDDEN: '접근 권한이 없어요.',
  NOT_FOUND: '레시피를 찾을 수 없어요.',
  AI_RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
  AI_PROVIDER_ERROR: 'AI 응답 생성에 실패했어요. 다시 시도해 주세요.',
  DB_ERROR: '일시적인 오류예요. 잠시 후 다시 시도해 주세요.',
  INTERNAL_ERROR: '오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
};

function toUserMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return (
      ERROR_CODE_MESSAGES[err.error.code] ?? ERROR_CODE_MESSAGES.INTERNAL_ERROR
    );
  }
  return ERROR_CODE_MESSAGES.INTERNAL_ERROR;
}
