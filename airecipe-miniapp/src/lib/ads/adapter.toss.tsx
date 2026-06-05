/**
 * 토스 광고 SDK 어댑터 (Phase 4.5 baseline D25·D26·D32)
 *
 * SSOT: `@apps-in-toss/framework` (`InlineAd`, `loadFullScreenAd`, `showFullScreenAd`).
 *
 * 책임:
 * - SDK 직접 import는 **본 파일 1곳만**(D26·D37).
 * - InlineAd props에서 BannerSlotCallbacks를 외부에 노출하지 않음(D33) — 콜백은 console.debug.
 * - 전면 광고 이벤트(7종)를 단일 AdResult로 정규화(D32 §D).
 *
 * 환경 분기는 `src/lib/ads/index.ts`에서 — 본 파일은 어댑터 구현만.
 */

import React from 'react';
import {
  InlineAd,
  loadFullScreenAd,
  showFullScreenAd,
  type BannerSlotErrorPayload,
  type BannerSlotEventPayload,
  type InlineAdProps,
} from '@apps-in-toss/framework';

import type { AdResult, AdsAdapter, InlineAdSlotProps } from './types';

interface TossAdsConfig {
  /** plugin-env로 빌드 시점 주입 — 빈값/누락 시 인라인 렌더 안 함(빈 공간 회피). */
  inlineGroupId: string;
  /** plugin-env로 빌드 시점 주입 — 빈값/누락 시 showFullScreen이 즉시 `'failedToShow'`. */
  fullScreenGroupId: string;
}

export function createTossAdsAdapter(config: TossAdsConfig): AdsAdapter {
  function TossInlineAdSlot({
    slot,
    theme = 'auto',
    tone = 'grey',
    variant = 'expanded',
  }: InlineAdSlotProps) {
    if (!config.inlineGroupId) {
      if (typeof console !== 'undefined') {
        console.debug(`[ads:toss] inlineGroupId 미설정, 렌더 생략(slot=${slot})`);
      }
      return null;
    }
    const inlineAdProps: InlineAdProps = {
      adGroupId: config.inlineGroupId,
      theme,
      tone,
      variant,
      // 가이드(RN-BannerAd): InlineAd는 impression 측정 컨텍스트가 필수.
      // IOScrollView로 감싸지 않는 고정 배너는 impressFallbackOnMount=true로 마운트 시 impression 처리.
      // 누락 시 운영 빌드에서 렌더 실패·앱 크래시(검정 화면) 발생(ADR-022 rev.2).
      impressFallbackOnMount: true,
      onAdRendered: (p: BannerSlotEventPayload) =>
        console.debug(`[ads:toss] rendered slot=${slot} creativeId=${p.adMetadata.creativeId}`),
      onAdImpression: (p: BannerSlotEventPayload) =>
        console.debug(`[ads:toss] impression slot=${slot} creativeId=${p.adMetadata.creativeId}`),
      onAdClicked: (p: BannerSlotEventPayload) =>
        console.debug(`[ads:toss] clicked slot=${slot} creativeId=${p.adMetadata.creativeId}`),
      onAdFailedToRender: (p: BannerSlotErrorPayload) =>
        console.debug(`[ads:toss] failedToRender slot=${slot} code=${p.error.code} msg=${p.error.message}`),
      onNoFill: () => console.debug(`[ads:toss] noFill slot=${slot}`),
    };
    return <InlineAd {...inlineAdProps} />;
  }

  return {
    isEnabled() {
      return true;
    },
    InlineAdSlot: TossInlineAdSlot,
    showFullScreen({ signal } = {}) {
      return new Promise<AdResult>((resolve, reject) => {
        if (!config.fullScreenGroupId) {
          reject(new Error('ADS_FULLSCREEN_GROUP_ID 미설정'));
          return;
        }
        if (signal?.aborted) {
          resolve('cancelled');
          return;
        }

        let cancelLoad: (() => void) | null = null;
        let cancelShow: (() => void) | null = null;
        let settled = false;

        const cleanup = () => {
          cancelLoad?.();
          cancelLoad = null;
          cancelShow?.();
          cancelShow = null;
        };

        const onAbort = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve('cancelled');
        };
        signal?.addEventListener('abort', onAbort);

        cancelLoad = loadFullScreenAd({
          options: { adGroupId: config.fullScreenGroupId },
          onEvent: (loadEvent) => {
            if (settled || loadEvent.type !== 'loaded') return;

            cancelShow = showFullScreenAd({
              options: { adGroupId: config.fullScreenGroupId },
              onEvent: (showEvent) => {
                if (settled) return;
                switch (showEvent.type) {
                  case 'requested':
                  case 'show':
                  case 'impression':
                  case 'clicked':
                    console.debug(`[ads:toss] fullscreen event=${showEvent.type}`);
                    return;
                  case 'userEarnedReward':
                    // 본 미니앱 미사용 — dismissed 동일 처리(D32).
                    settled = true;
                    cleanup();
                    signal?.removeEventListener('abort', onAbort);
                    resolve('dismissed');
                    return;
                  case 'dismissed':
                    settled = true;
                    cleanup();
                    signal?.removeEventListener('abort', onAbort);
                    resolve('dismissed');
                    return;
                  case 'failedToShow':
                    settled = true;
                    cleanup();
                    signal?.removeEventListener('abort', onAbort);
                    reject(new Error('failedToShow'));
                    return;
                  default:
                    return;
                }
              },
              onError: (err) => {
                if (settled) return;
                settled = true;
                cleanup();
                signal?.removeEventListener('abort', onAbort);
                reject(err instanceof Error ? err : new Error(String(err)));
              },
            });
          },
          onError: (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            signal?.removeEventListener('abort', onAbort);
            reject(err instanceof Error ? err : new Error(String(err)));
          },
        });
      });
    },
  };
}
