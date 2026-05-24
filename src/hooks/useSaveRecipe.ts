/**
 * useSaveRecipe — 생성된 GeneratedRecipe를 저장하는 mutation 훅 (Phase 3)
 *
 * Baseline §A.1, §A.4, §D.3.
 * SSOT: 03 §3.5 (POST /api/recipes — 201 + `{ data: Recipe }`).
 *
 * 책임:
 * 1. `saveRecipe({ recipe })` 호출 → 성공 시 저장된 `Recipe`(id 포함) 반환.
 * 2. 성공 시 `useRecipeCacheTrigger.invalidate()` 1회 — 마이 목록 refetch 강제 (AC3.2).
 * 3. 401 자동 재시도는 apiFetch 단일 위치 (ADR-010 D3) — `refreshTossUserId: refresh` 주입만.
 * 4. unmount 시 AbortController.abort + cancelled 플래그로 stale setState 차단 (§H.2 #17).
 *
 * 사용 예 (frontend `/recipe/generate` 저장 버튼):
 *   const { save, isSaving, error, reset } = useSaveRecipe();
 *   ...
 *   const saved = await save(generatedRecipe);
 *   if (saved) navigation.navigate('/recipe/[id]', { id: saved.id });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, saveRecipe } from '../services';
import type { ApiErrorCode } from '../types/api';
import type { GeneratedRecipe, Recipe } from '../types/recipe';

import { useRecipeCacheTrigger } from './useRecipeCache';
import { useTossUserId } from './useTossUserId';

export interface UseSaveRecipeResult {
  /** 저장 진행 중 — 버튼 disabled / Spinner 노출. */
  isSaving: boolean;
  /** 실패 시 한국어 사용자 메시지. 성공 또는 초기 상태에서는 null. */
  error: string | null;
  /**
   * 저장 시도. 성공 시 저장된 Recipe(id 포함) 반환 + invalidate. 실패 시 null 반환 + error state 설정.
   * 식별자 미발급 상태(useTossUserId 아직 마운트 직후)에서는 즉시 한국어 에러 + null.
   * unmount 후 호출 결과는 setState 차단 (cancelled 플래그) — 호출 측은 반환값 받아 라우팅 결정.
   */
  save: (recipe: GeneratedRecipe) => Promise<Recipe | null>;
  /** error/isSaving 초기화. "다시 시도" 버튼 직전 호출. */
  reset: () => void;
}

export function useSaveRecipe(): UseSaveRecipeResult {
  const { tossUserId, refresh } = useTossUserId();
  const { invalidate } = useRecipeCacheTrigger();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  // unmount cleanup — 08 §8.4.2 패턴 누적 (Phase 2 useRecipeGenerate).
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setIsSaving(false);
    setError(null);
  }, []);

  const save = useCallback(
    async (recipe: GeneratedRecipe): Promise<Recipe | null> => {
      if (tossUserId === undefined) {
        // 식별자 발급 전 — 보호 호출 차단. 화면 가드(§C.4)가 일반적으로 막지만 방어선.
        setError(ERROR_CODE_MESSAGES.UNAUTHORIZED);
        return null;
      }

      // 이전 호출이 in-flight면 abort.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSaving(true);
      setError(null);

      try {
        const saved = await saveRecipe(
          { recipe },
          { tossUserId, refreshTossUserId: refresh },
        );
        if (cancelledRef.current || controller.signal.aborted) {
          return null;
        }
        invalidate();
        setIsSaving(false);
        return saved;
      } catch (err) {
        if (cancelledRef.current || controller.signal.aborted) {
          return null;
        }
        setError(toUserMessage(err));
        setIsSaving(false);
        return null;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [tossUserId, refresh, invalidate],
  );

  return { isSaving, error, save, reset };
}

// ─── 사용자 친화 한국어 에러 메시지 매핑 (useRecipeGenerate와 동일 정책) ────

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
