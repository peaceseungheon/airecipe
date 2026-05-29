/**
 * useRecommendations — 테마 기반 요리 추천 query 훅 (Phase 6 / ADR-016 D51).
 *
 * 책임:
 * 1. theme deps — situation/weather 변경 시 자동 새 fetch + 이전 in-flight abort.
 * 2. 테마 미선택(situation·weather 둘 다 undefined)이면 호출 보류 — items=[] + isLoading=false.
 * 3. 401 자동 재시도는 apiFetch 단일 위치(ADR-010 D3) — refreshTossUserId 주입만.
 * 4. unmount 시 AbortController.abort + cancelled 플래그로 stale setState 차단(Phase 3 useSaveRecipe 패턴 누적).
 * 5. refresh() — 동일 테마 새 추천(D51 사용자 의도 두 번째 패턴).
 *
 * 캐시: 메모리 내 테마 hash key (D51). 동일 테마 재진입 시 즉시 표시 + 백그라운드 refresh 없음(v1 단순).
 *
 * 사용 예 (frontend `/recipe/recommend`):
 *   const { items, isLoading, error, refresh } = useRecommendations(theme);
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiClientError, getRecommendations } from '../services';
import type { ApiErrorCode, RecommendationItem } from '../types/api';
import type { RecommendationTheme } from '../lib/zod/recommendations';

import { useTossUserId } from './useTossUserId';

export interface UseRecommendationsResult {
  /** 추천 5개. 미선택·로딩·에러·in-flight 시 []. */
  items: RecommendationItem[];
  /** 호출 진행 중. */
  isLoading: boolean;
  /** 실패 시 한국어 사용자 메시지. 성공·초기 상태에서는 null. */
  error: string | null;
  /** 동일 테마 새 추천(이전 in-flight abort + 새 fetch). 테마가 미선택이면 no-op. */
  refresh: () => void;
}

interface CacheEntry {
  themeKey: string;
  items: RecommendationItem[];
}

const cache = new Map<string, CacheEntry>();

function themeKey(theme: RecommendationTheme): string {
  return `${theme.situation ?? ''}|${theme.weather ?? ''}`;
}

function isThemeSelected(theme: RecommendationTheme): boolean {
  return theme.situation !== undefined || theme.weather !== undefined;
}

export function useRecommendations(theme: RecommendationTheme): UseRecommendationsResult {
  const { tossUserId, refresh: refreshTossUserId } = useTossUserId();

  const key = useMemo(() => themeKey(theme), [theme]);
  const selected = isThemeSelected(theme);

  const initialItems = useMemo(() => {
    if (!selected) return [];
    return cache.get(key)?.items ?? [];
  }, [key, selected]);

  const [items, setItems] = useState<RecommendationItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (tossUserId === undefined) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const cached = cache.get(key);
    if (cached) {
      setItems(cached.items);
    }

    (async () => {
      try {
        const result = await getRecommendations(
          { theme },
          {
            tossUserId,
            refreshTossUserId,
            signal: controller.signal,
          },
        );
        if (cancelledRef.current || controller.signal.aborted) return;
        cache.set(key, { themeKey: key, items: result.items });
        setItems(result.items);
        setIsLoading(false);
      } catch (err) {
        if (cancelledRef.current || controller.signal.aborted) return;
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError(toUserMessage(err));
        setIsLoading(false);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    })();
  }, [key, selected, theme, tossUserId, refreshTossUserId, trigger]);

  const refresh = useCallback(() => {
    if (!selected) return;
    cache.delete(key);
    setTrigger((t) => t + 1);
  }, [key, selected]);

  return { items, isLoading, error, refresh };
}

// ─── 사용자 친화 한국어 에러 메시지 매핑(useSaveRecipe와 동일 정책) ──────────

const ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: '테마를 다시 확인해 주세요.',
  UNAUTHORIZED: '잠시 후 다시 시도해 주세요.',
  FORBIDDEN: '접근 권한이 없어요.',
  NOT_FOUND: '추천을 찾을 수 없어요.',
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
