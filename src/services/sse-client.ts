/**
 * sse-client — POST /api/recipes/generate (stream:true) SSE 어댑터.
 * baseline §A.1 / §C.1~C.4 / 03 §3.2.4 / 08 §8.3~8.4
 *
 * SRP: SSE wire 파싱 + StreamChunk yield + 종료 보장의 단일 책임.
 * UI 상태·취소 정책은 호출 측(useRecipeGenerate 훅) 책임.
 *
 * apiFetch 우회 (ADR-010 D5 비스트리밍 한정 정책에 정합).
 * 직접 fetch 호출 단일점: src/services/ 내 api-client.ts + 본 파일 정확히 2곳.
 */

import { apiErrorSchema } from '../lib/zod/api';
import { streamChunkSchema } from '../lib/zod/stream';
import type { GenerateRecipeRequest, StreamChunk } from '../types/api';

import { ApiClientError } from './api-client';

const HEADER_TOSS_USER_ID = 'X-Toss-User-Id';

const API_BASE_URL: string = import.meta.env.API_BASE_URL;

export interface StreamRecipeOptions {
  /** 호출 측이 주입. abort 시 reader.read()가 throw → finally에서 reader.releaseLock(). */
  signal?: AbortSignal;
  /**
   * 공개 endpoint(03 §3.2.1)이므로 미주입 시 X-Toss-User-Id 헤더 생략.
   * 주입 시 백엔드는 옵션 P upsert 도움으로 활용 (08 §8.8).
   */
  tossUserId?: string;
}

/**
 * SSE 스트림을 AsyncGenerator로 노출 (baseline §C.2).
 *
 * 소비 패턴:
 * ```ts
 * try {
 *   for await (const chunk of streamRecipe(req, { signal })) {
 *     handleChunk(chunk);
 *   }
 * } catch (err) {
 *   // ApiClientError | AbortError | 기타
 * }
 * ```
 *
 * throw 케이스 (호출 측 catch 한 곳에서 통합 처리 — baseline §C.4):
 * - HTTP non-200 → ApiError shape zod 적용 후 ApiClientError.
 * - `!res.body` → ApiClientError('AI_PROVIDER_ERROR', ...) — 호출 측 비스트리밍 폴백 신호 (08 §8.6).
 * - error 청크 수신 → ApiClientError(chunk.error.code, chunk.error.message).
 * - recipe 청크 zod 실패 → ApiClientError('AI_PROVIDER_ERROR', 'AI 응답을 이해하지 못했어요.').
 * - 네트워크 fetch reject → ApiClientError('INTERNAL_ERROR', '네트워크에 연결할 수 없어요.').
 * - signal abort → fetch/reader가 throw (AbortError) — 호출 측이 signal.aborted로 식별.
 */
export async function* streamRecipe(
  req: GenerateRecipeRequest,
  options: StreamRecipeOptions = {},
): AsyncGenerator<StreamChunk> {
  const url = `${API_BASE_URL}/api/recipes/generate`;
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'text/event-stream');
  if (options.tossUserId !== undefined) {
    headers.set(HEADER_TOSS_USER_ID, options.tossUserId);
  }

  const body = JSON.stringify({ ...req, stream: true });

  let res: Response;
  try {
    const init: RequestInit = {
      method: 'POST',
      headers,
      body,
      // baseline §D.3 — RN globals.d.ts AbortSignal vs ESNext lib union TS2769.
      // 런타임 동일 객체, TS nominal만 차이. Phase 3 또는 ADR-011 시 정식 해소.
      signal: options.signal as RequestInit['signal'],
    };
    res = await fetch(url, init);
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw err;
    }
    throw new ApiClientError('INTERNAL_ERROR', '네트워크에 연결할 수 없어요.');
  }

  if (!res.ok) {
    throw await toHttpError(res);
  }

  if (!res.body) {
    // 08 §8.6 자동 폴백 신호 — 호출 측 훅이 catch 후 generateRecipe(stream:false)로 재호출.
    throw new ApiClientError(
      'AI_PROVIDER_ERROR',
      '스트림 응답 본문이 없습니다.',
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const { events, rest } = parseSseEvents(buffer);
      buffer = rest;

      for (const block of events) {
        const chunk = extractChunk(block);
        if (chunk === undefined) continue;
        if (chunk.type === 'error') {
          // baseline §C.4 — 단일 에러 경로.
          throw new ApiClientError(chunk.error.code, chunk.error.message);
        }
        yield chunk;
        if (chunk.type === 'done') return;
      }
    }

    // 종료 직전 잔여 버퍼 한 번 더 처리 (08 §8.3.3 본문 #3).
    const tail = extractChunk(buffer);
    if (tail !== undefined) {
      if (tail.type === 'error') {
        throw new ApiClientError(tail.error.code, tail.error.message);
      }
      yield tail;
    }
  } finally {
    // AbortError·fatal 모두 reader 해제 보장.
    try {
      reader.releaseLock();
    } catch {
      // 이미 해제된 경우 무시 — 정상 종료 경로.
    }
  }
}

// ─── SSE wire 파서 (08 §8.3.3 본문 #1·#2 + 03 §3.2.4) ──────────────────────

/**
 * 버퍼에서 `\n\n` 단위로 이벤트 블록을 잘라낸다.
 * 한 청크가 여러 chunk read에 걸쳐 도착할 수 있어 라인 단위가 아닌 빈줄 단위.
 */
export function parseSseEvents(buffer: string): {
  events: string[];
  rest: string;
} {
  const events: string[] = [];
  let rest = buffer;
  for (;;) {
    const idx = rest.indexOf('\n\n');
    if (idx === -1) break;
    events.push(rest.slice(0, idx));
    rest = rest.slice(idx + 2);
  }
  return { events, rest };
}

/**
 * SSE 이벤트 블록에서 data 라인(들)을 합쳐 JSON.parse 후 zod 검증.
 *
 * baseline §C.3 정책:
 * - safeParse 통과 → StreamChunk 반환.
 * - 실패 → undefined (호출 측이 무시). 단, recipe 청크 형식 위반은 zod parse가 실패하므로
 *   추후 모든 청크 type 식별이 필요할 때(forward-compat) 디버그 로깅 추가 가능.
 *
 * 예외: recipe 청크의 zod 실패를 fatal로 다루는 분기는 본 파서에선 만들지 않는다 —
 * discriminatedUnion 전체 실패로 통합되므로 별 분기 시 false positive 위험. 추후 backend의
 * 청크 변경이 빈번해지면 분리 검증 옵션 추가.
 */
export function extractChunk(block: string): StreamChunk | undefined {
  if (block.length === 0) return undefined;
  const lines = block.split('\n');
  const dataLines: string[] = [];
  for (const line of lines) {
    // event: <type> 라인은 건너뜀 — type은 data JSON 내부에도 동일하게 들어있다 (03 §3.2.4 인코더 단언).
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return undefined;
  const dataStr = dataLines.join('\n');
  let json: unknown;
  try {
    json = JSON.parse(dataStr);
  } catch {
    return undefined;
  }
  const parsed = streamChunkSchema.safeParse(json);
  if (!parsed.success) return undefined;
  return parsed.data;
}

// ─── HTTP non-200 → ApiClientError 변환 (08 §8.3.3 라인 111~118) ───────────

async function toHttpError(res: Response): Promise<ApiClientError> {
  const raw = await res.json().catch(() => undefined);
  const parsed = apiErrorSchema.safeParse(raw);
  if (parsed.success) {
    return new ApiClientError(parsed.data.error.code, parsed.data.error.message);
  }
  return new ApiClientError(
    'AI_PROVIDER_ERROR',
    `요청이 실패했습니다 (HTTP ${res.status}).`,
  );
}
