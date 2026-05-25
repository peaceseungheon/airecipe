/**
 * useFullScreenAd — 전면 광고 호출 훅 (Phase 4.5 baseline D31)
 *
 * 책임:
 * - `ads.showFullScreen({ signal })` 1회 호출 → AdResult 정규화 결과 노출.
 * - 컴포넌트 unmount 또는 새 request 시 직전 in-flight abort.
 * - 한국어 에러 메시지 매핑(D33 — Analytics 미통합, console.debug만).
 *
 * 현 사이클(Phase 4.5) wiring 위치: 코드 PASS만, 페이지 적용 없음(D30).
 *
 * 사용 예:
 *   const { request, isPending, error } = useFullScreenAd();
 *   // 사용자 액션 후
 *   const result = await request();   // 'shown' | 'dismissed' | 'failedToShow' | 'no_fill' | 'cancelled'
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ads, type AdResult } from '../lib/ads';

export interface UseFullScreenAdResult {
  request: () => Promise<AdResult>;
  isPending: boolean;
  /** 실패 시 한국어 메시지. 성공·취소·초기 상태에서는 null. */
  error: string | null;
}

const FAIL_MESSAGE = '광고를 표시하지 못했어요.';

export function useFullScreenAd(): UseFullScreenAdResult {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const request = useCallback(async (): Promise<AdResult> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPending(true);
    setError(null);

    try {
      const result = await ads.showFullScreen({ signal: controller.signal });
      if (controller.signal.aborted) return 'cancelled';
      return result;
    } catch (err) {
      if (controller.signal.aborted) return 'cancelled';
      if (typeof console !== 'undefined') {
        console.debug('[ads] fullScreen error', err);
      }
      setError(FAIL_MESSAGE);
      return 'failedToShow';
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setPending(false);
    }
  }, []);

  return { request, isPending, error };
}
