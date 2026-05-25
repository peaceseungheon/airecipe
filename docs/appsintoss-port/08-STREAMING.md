# 08. 스트리밍 — SSE → React Native `fetch` + `ReadableStream`

> **이 챕터 전에 알아야 할 것**: [00-OVERVIEW.md](./00-OVERVIEW.md), [01-FEATURES.md](./01-FEATURES.md), [03-API-CONTRACT.md](./03-API-CONTRACT.md)(특히 3.2.4 스트리밍 응답 와이어 형식), [07-ROUTING.md](./07-ROUTING.md)(생성 화면 라우팅·백버튼 연계).
>
> **이 챕터 완료 후 다음 챕터**: [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) — 환경변수·도메인 화이트리스트.

---

## 8.0 이 챕터의 목적

`POST /api/recipes/generate`(`stream:true`)의 SSE 스트리밍을 RN 미니앱(Granite >= 1.0)에서 어떻게 소비할지 정의한다. 현재 웹은 브라우저 `fetch` + `ReadableStream`으로 SSE를 직접 파싱하지만 (`EventSource`는 POST 본문 미지원이라 사용 불가), **RN은 추가 제약**이 있어 동일 패턴을 그대로 옮길 수 없다.

| 항목 | SSOT |
|------|------|
| 백엔드 SSE 형식 | [03-API-CONTRACT.md 3.2.4](./03-API-CONTRACT.md) |
| 백엔드 인코더 | `src/lib/sse.ts` (`encodeSSE`) |
| 백엔드 라우트 | `src/app/api/recipes/generate/route.ts` |
| 청크 타입 정의 | `src/types/api.ts` — `StreamChunk` discriminated union |
| 현재 웹 소비자 | `src/hooks/useRecipeGenerate.ts` (참조 구현) |
| 미니앱 클라이언트 위치(권장) | 신규 저장소 `src/hooks/useRecipeGenerate.ts` (이름 유지) |

## 8.1 백엔드 SSE 형식 (간략 재확인)

03-API-CONTRACT 3.2.4와 코드(`src/lib/sse.ts`)에서 확정:

- **HTTP**: `200 OK`, `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`.
- **와이어 한 청크**: `event: <type>\ndata: <JSON 직렬화 StreamChunk>\n\n` (인코더가 type을 둘 다에 넣는다).
- **청크 시퀀스** (1회 생성당):
  1. `event: meta` (`{"type":"meta","dishName":string}`) — 1회
  2. `event: text` (`{"type":"text","delta":string}`) — 0..N회 (점진 텍스트)
  3. `event: recipe` (`{"type":"recipe","recipe":GeneratedRecipe}`) — 1회 (최종 구조화 결과)
  4. `event: error` (`{"type":"error","error":{"code":ApiErrorCode,"message":string}}`) — 0..1회 (HTTP 200 내부 에러)
  5. `event: done` (`{"type":"done"}`) — 1회 (마지막)

**핵심 불변식**:

- **최종 결과는 `recipe` 청크의 `.recipe`** — `text` 누적이 아니다 (현재 웹 훅이 이미 그렇게 처리; 미니앱도 동일).
- **에러는 HTTP 200 + `error` 청크** — HTTP 상태로 분기 금지.
- **`error` 후 항상 `done`** — 종료 보장.

## 8.2 RN 환경 제약 — 왜 그대로 못 옮기는가

| 제약 | 영향 |
|------|------|
| **`EventSource` 미지원** | RN 표준 fetch는 `EventSource`를 제공하지 않으며, GET 전용이라 POST 본문이 필요한 본 API와 부적합 (웹과 동일 이슈). 후보: `react-native-sse`(GET/POST 지원) 또는 직접 fetch+ReadableStream. |
| **`fetch().body`(ReadableStream) 지원** | React Native 0.74+ / Hermes 환경에서 `Response.body`는 일반적으로 ReadableStream이 노출된다. 단 환경(엔진 버전·polyfill 설치)에 따라 `undefined`일 수 있어 **런타임 가드 필수**. Granite의 RN 런타임에서 본 패턴이 동작하는지 v1 구현 시 첫 검증 항목. |
| **`TextDecoder`/`TextDecoderStream`** | `TextDecoder`는 RN에 polyfill되어 있는 경우가 많으나 보장 안 됨 — 필요시 `text-encoding`(npm) 또는 `@stardazed/streams-text-encoding` polyfill 도입. |
| **`AbortController`** | RN 0.70+에서 표준 지원. 미니앱 v1 환경(@apps-in-toss/framework >=1.0)에서 동작 보장. |
| **백그라운드 진입 시 연결 끊김** | RN 미니앱이 백그라운드로 가면 fetch 스트림이 끊길 수 있다. 사용자가 돌아왔을 때 재시도 또는 안내. |

### 8.2.1 두 가지 구현 옵션 비교

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. `fetch` + `ReadableStream` 직접 파싱** | 현재 웹과 동일 패턴 (`useRecipeGenerate.ts` 참조) | 의존성 0, 웹 코드 거의 그대로 이식 | RN 환경별 ReadableStream 지원 편차에 노출 |
| **B. `react-native-sse` 라이브러리** | POST 본문 + SSE 헤더 지원 | 환경 호환성 검증된 패키지 | 라이브러리 의존성, EventSource API에 맞춰 코드 재구성 필요 |

**채택: 옵션 A를 1차로 시도, 환경 미지원 확인 시 옵션 B로 폴백.**

근거:
- 현재 웹 `useRecipeGenerate.ts`가 fetch+ReadableStream으로 동작하며 백엔드 와이어 형식과 정확히 맞물려 있다 — 동일 로직을 RN으로 옮기면 청크 파서·StreamChunk 분기 로직을 그대로 재사용할 수 있다.
- Granite의 RN 런타임은 일반적으로 최신 RN(Hermes) 기반이라 `Response.body`/`getReader`가 지원될 가능성이 높다.
- 옵션 B는 라이브러리에 EventSource API 모양을 강제받아 백엔드 와이어와 어댑터 한 겹이 추가된다(`type` 필드는 같으나 SSE event name 라우팅 후 data JSON 파싱).

> 미니앱 v1 구현 첫 작업에서 fetch+ReadableStream 동작을 확인하고, 미지원 환경 발견 시 본 챕터를 R3 갱신하면서 옵션 B 코드로 교체.

## 8.3 옵션 A — `fetch` + `ReadableStream` 구현 사양

### 8.3.1 파일/위치

- 미니앱 저장소: `src/hooks/useRecipeGenerate.ts` (현재 웹과 동일 이름·인터페이스 유지 — UI 컴포넌트가 props만 보고 동작 가능).
- 보조 파서 함수(`parseSseEvents`, `extractChunk`): 동일 모듈 또는 `src/lib/sse-parser.ts`로 분리(SRP).

### 8.3.2 외부 인터페이스 (현재 웹과 동일하게 유지)

```ts
export type GenerateStatus = "idle" | "streaming" | "done" | "error";

export interface UseRecipeGenerateResult {
  status: GenerateStatus;
  progressText: string;          // text 청크 누적 (UX 점진 표시)
  recipe: GeneratedRecipe | null;
  error: string | null;
  generate: (req: GenerateRecipeRequest) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}
```

> **인터페이스 불변**. UI(SearchForm + 진행 표시 + RecipeDisplay)는 웹/미니앱 양쪽에서 동일 시그니처를 소비. (06-UI-MAPPING 6.4.1, 07-ROUTING 7.3.2)

### 8.3.3 내부 흐름 (의사 코드)

```ts
async function generateStreaming(body: GenerateRecipeRequest, signal: AbortSignal) {
  const url = `${import.meta.env.API_BASE_URL}/api/recipes/generate`;  // 09-ENV-CONFIG `plugin-env` 주입
  const tossUserId = await getStoredTossUserId();      // 05-AUTH 2.1 — 있어도 보내고, 없으면 생략 가능(공개 API)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(tossUserId ? { 'X-Toss-User-Id': tossUserId } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  // 스트림 시작 전 HTTP 에러 (검증 실패 등)는 JSON ApiError로 옴
  if (!res.ok) {
    let message = `요청이 실패했습니다 (HTTP ${res.status}).`;
    try {
      const errBody = await res.json() as ApiError;
      if (errBody?.error?.message) message = errBody.error.message;
    } catch {/* JSON 아님 */}
    throw new ApiClientError('AI_PROVIDER_ERROR', message, res.status);
  }

  if (!res.body) {
    throw new ApiClientError('AI_PROVIDER_ERROR', '스트림 응답 본문이 없습니다.', res.status);
    // RN 환경에서 body 미지원 → 옵션 B로 폴백 신호 (8.2.1)
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawError = false;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const { events, rest } = parseSseEvents(buffer);  // \n\n 분리
    buffer = rest;
    for (const block of events) {
      const chunk = extractChunk(block);              // data: 라인 추출 → JSON.parse → StreamChunk
      if (!chunk) continue;
      if (chunk.type === 'error') sawError = true;
      handleChunk(chunk);                              // type별 setState
    }
  }
  // 종료 직전 잔여 버퍼 한 번 더 처리
  const tail = extractChunk(buffer);
  if (tail) { if (tail.type === 'error') sawError = true; handleChunk(tail); }

  if (!sawError) setStatus('done');
}
```

핵심 포인트:

1. **버퍼 누적 + `\n\n` 분리**: 한 청크가 여러 chunk read에 걸쳐 도착할 수 있어 라인 단위가 아닌 빈줄(`\n\n`) 단위로 이벤트 블록을 잘라낸다. 현재 웹 `parseSseEvents` 함수 그대로 이식.
2. **다중 `data:` 라인 처리**: SSE는 `data:`가 여러 줄일 수 있어 join 후 JSON.parse. 현재 웹 `extractChunk` 그대로 이식.
3. **버퍼 잔여 처리**: 마지막 `done` 청크가 `\n\n` 직전에서 끊겨 있을 수 있어 루프 종료 후 1회 더 처리.
4. **`Content-Type: application/json`도 함께**: 백엔드는 두 가지 Content-Type을 응답할 수 있고(에러 시 JSON), 본 클라이언트는 응답 헤더 보고 분기하지 않고 **상태 코드 + body shape**으로 분기.
5. **`Accept` 헤더는 옵션**: 미니앱 식별을 도울 수 있으나 백엔드 라우트는 `stream` 본문 플래그로 분기하므로 필수 아님.

### 8.3.4 청크별 UI 분기 (`handleChunk`)

현재 웹 `useRecipeGenerate.ts`와 **완전 동일**. 미니앱은 React 상태만 setX로 갱신.

```ts
function handleChunk(chunk: StreamChunk) {
  switch (chunk.type) {
    case 'meta':   /* status는 이미 streaming */ break;
    case 'text':   setProgressText(prev => prev + chunk.delta); break;
    case 'recipe': setRecipe(chunk.recipe); break;   // 최종 GeneratedRecipe
    case 'error':  setError(chunk.error.message); setStatus('error'); break;
    case 'done':   /* 종료는 루프 종료 후 status 확정 */ break;
  }
}
```

> **`text` 누적 ≠ 최종 결과**: progressText는 내부 상태 신호일 뿐. 진짜 결과는 `recipe` 청크의 `.recipe` (GeneratedRecipe). 03-API-CONTRACT 3.2.4 인용 그대로.

### 8.3.5 text 청크 표시 정책 (backend 권장 — Gemini 부분 JSON·Claude tool 모드)

backend 통지(04-AI-PROVIDER §4.3.3·§4.4.3 + backend의 미니앱 정합 결정 #6)에 따라:

- **Gemini 기본 모드**: text 청크 delta가 **부분 JSON 문자열**(`{"dishName":"김치찌개","ing` 같은 깨진 토큰)로 흐른다. `JSON.parse` 불가, 사용자 화면에 그대로 표시하면 깨진 텍스트가 보인다.
- **Claude tool 강제 모드(롤백 경로)**: tool 호출 중에는 text 델타가 **거의 비어있다**(`""` 또는 빈 단일 청크). 점진 표시 자체가 무의미.

**결론(채택)**: **점진 표시는 text 청크 내용이 아니라 "생성 중" 상태 인디케이터에 한정**한다. 즉 미니앱 UI는 다음과 같이 단순화한다:

1. `meta` 청크 도달 → "AI가 레시피를 생성하고 있어요" 인디케이터 표시(Spinner + 메시지).
2. `text` 청크 도달 → **델타를 사용자에게 표시하지 않는다**. 내부적으로 `progressText`로만 누적해 "응답이 진행 중"을 판단하는 신호로 사용(타임아웃 리셋 등). UI에는 표시 금지.
3. `recipe` 청크 도달 → `setRecipe(chunk.recipe)` → `RecipeDisplay`가 한 번에 렌더(저장 버튼 활성화).
4. `error`/`done` 청크 → 종료 처리.

| 시나리오 | 미니앱 처리 |
|----------|------------|
| `text` 청크 부분 JSON 도착 | **사용자에게 표시 금지**. `progressText`는 디버그/타임아웃 신호로만 누적 |
| `text` 청크 비어있음(Claude tool 모드) | 정상 — 인디케이터만 유지 |
| 최종 `recipe` 청크 도달 | `setRecipe(chunk.recipe)` → 인디케이터 숨김 → `RecipeDisplay` 1회 렌더 |
| JSON.parse 시도 | **금지** — 백엔드가 zod 검증된 `recipe` 청크 외엔 파싱 책임을 미니앱이 지지 않음 |

> **변경 영향**: 현재 웹 `useRecipeGenerate.ts` (`src/hooks/useRecipeGenerate.ts` 99~101행)와 `/recipe/generate` 페이지(`src/app/recipe/generate/page.tsx` 98~102행)는 progressText를 그대로 회색 박스로 표시한다. **이는 웹 UX 결정**이며, **미니앱은 그 패턴을 따르지 않는다**. backend 결정 #6에 따른 RN 컨텍스트 차별화. (현재 웹 코드는 변경 안 함 — ADR-009 D4).

## 8.4 취소 — `AbortController`

### 8.4.1 사용자 명시 취소 (취소 버튼)

```ts
const abortRef = useRef<AbortController | null>(null);

const cancel = useCallback(() => {
  abortRef.current?.abort();
  abortRef.current = null;
}, []);

// generate 진입부
const controller = new AbortController();
abortRef.current = controller;
try { await generateStreaming(body, controller.signal); }
catch (err) {
  if (controller.signal.aborted) { setStatus('idle'); return; }
  setError(toErrorMessage(err)); setStatus('error');
}
```

현재 웹 훅과 완전 동일. AbortError는 catch에서 `signal.aborted` 체크 → idle로 복귀(에러 표시 안 함).

### 8.4.2 화면 이탈 시 취소 (네비게이션)

생성 화면에서 백버튼 또는 다른 화면 이동 시 진행 중 스트림을 끊는다. 두 가지 트리거:

1. **`useEffect` cleanup**: 컴포넌트 unmount 시 `cancel()` 호출.
2. **하드웨어 백버튼**: 07-ROUTING 7.7.2의 `useBackEvent`에서 `status === 'streaming'`이면 cancel 후 백 진행 막거나 진행(UX 선택).

```ts
useEffect(() => {
  return () => { abortRef.current?.abort(); };
}, []);
```

### 8.4.3 화면 비활성(visibility)

Granite의 [`useVisibility`](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/화면)로 화면이 보이지 않을 때(다른 미니앱·토스 백그라운드) cancel 호출 — **v1은 선택**. 보수적 선택: 백그라운드에서도 스트림 유지하고 도착 시 결과 표시. RN의 백그라운드 fetch 정책에 따라 끊길 수 있으므로 8.5와 동일하게 핸들.

## 8.5 타임아웃·재시도·네트워크 실패

### 8.5.1 타임아웃

API 계약(03 3.2 비고)에 따라 백엔드의 AI 생성은 수십 초가 걸릴 수 있다. 미니앱 타임아웃 정책:

| 단계 | 타임아웃 | 처리 |
|------|---------|------|
| **첫 청크 도달까지** | 15초 | 초과 시 cancel → "응답이 늦어요. 다시 시도하시겠어요?" 안내. (재시도 1회 자동) |
| **청크 간 무응답** | 30초 | 동일 — 무응답이면 cancel + 재시도 안내 |
| **전체 한도** | 90초 | 미니앱 안전망 — backend 어댑터 타임아웃 60초(04 §4.9) 위에 30초 여유. 초과 시 강제 cancel + 사용자에 안내 |

```ts
// 의사 코드 — 첫 청크 타임아웃
const firstChunkTimer = setTimeout(() => controller.abort(), 15_000);
// 첫 chunk read 성공 시
clearTimeout(firstChunkTimer);
```

### 8.5.2 재시도

- **자동 재시도**: 1회 (네트워크 에러 또는 첫 청크 타임아웃에 한정).
- **수동 재시도**: 에러 화면에서 "다시 시도" 버튼 → `generate()` 재호출 (현재 입력 유지).
- **재시도 금지 케이스**:
  - 400 (VALIDATION_ERROR) — 사용자 입력 수정 필요.
  - HTTP 200 + `error` 청크의 AI_RATE_LIMITED — 사용자에게 잠시 후 시도 안내.
- **401 (UNAUTHORIZED) 특수 처리** (backend 결정 #2 + 05-AUTH §5.4):
  - `getAnonymousKey()` 재호출 → SecureStore 갱신 → **동일 요청 1회만 재시도**.
  - **무한 루프 방지**: `_retried` 플래그를 요청 컨텍스트(혹은 클로저 변수)에 두고 재시도 후엔 다시 401이 와도 더 시도하지 않는다.
  - 두 번째 401 → "다시 시도해 주세요" 토스트, status='error' 종료.

```ts
// 의사 코드 — 401 1회 재시도 가드
async function callWithRetry(fn: () => Promise<Response>) {
  let res = await fn();
  if (res.status === 401) {
    await refreshTossUserId();  // getAnonymousKey() 재호출 + SecureStore 갱신
    res = await fn();           // 1회만 재시도 — 재진입 금지
  }
  return res;
}
```

### 8.5.3 네트워크 실패 복구

> **`NETWORK_ERROR` 코드 카테고리**: 본 코드는 **클라이언트 측 별도 에러 카테고리**이며, 서버 응답의 `ApiErrorCode` union(`src/types/api.ts` line 36~44)에는 **포함되지 않는다**. 서버가 응답하지 못한 경우(fetch 도달 전 실패)에 클라이언트(`api-client.ts`의 `ApiClientError`)가 자체 생성한다. 코드 분기 시 서버 발신 코드와 동일 union으로 다루지 말고, "서버 응답 코드 + NETWORK_ERROR/PARSE_ERROR" 두 그룹으로 처리한다.

| 시나리오 | 처리 |
|----------|------|
| `fetch` reject (TypeError) | `ApiClientError('NETWORK_ERROR', '...', 0)` — 클라이언트 측 카테고리. 안내 토스트/Alert |
| 중간에 끊김 (reader가 throw) | 동일 — `NETWORK_ERROR`, "연결이 끊겼습니다" |
| 백엔드 503 (DB/AI 일시 장애) | `error.code` 확인 → "잠시 후 다시 시도해 주세요" |
| 백엔드 502 AI_PROVIDER_ERROR | 동일 — 사용자 친화 메시지 |

## 8.6 비스트리밍 폴백 (옵션)

스트리밍이 환경 제약(8.2)으로 실패할 경우, 미니앱은 동일 엔드포인트를 `stream:false`로 호출해 단일 JSON 응답으로 받는다 (현재 웹 `generateNonStreaming` 함수 동일).

```ts
async function generateNonStreaming(body, signal) {
  const result = await requestData<GeneratedRecipe>('/api/recipes/generate', {
    method: 'POST',
    body: JSON.stringify({ ...body, stream: false }),
    signal,
  });
  setRecipe(result);
  setStatus('done');
}
```

- 장점: ReadableStream 미지원 환경에서 안전.
- 단점: 점진 텍스트 UX 없음 — 전체 응답이 올 때까지 로딩 스피너.

**자동 폴백 정책**: 첫 generate 시 try stream → `!res.body`(스트림 미지원)면 자동 stream:false 재호출. 사용자에게는 동일 UX 보이되 진행 텍스트 영역만 숨김.

## 8.7 RN 구현 체크리스트 (v1 첫 작업 시)

- [ ] `Response.body` + `getReader`가 미니앱 환경에서 동작하는지 첫 검증.
- [ ] `TextDecoder`가 동작하는지 확인. 미동작 시 polyfill 도입.
- [ ] `AbortController` + `fetch` 신호 연동 확인.
- [ ] 첫 청크 타임아웃·재시도 1회 로직 추가.
- [ ] 화면 unmount 시 cancel cleanup.
- [ ] 하드웨어 백 → `useBackEvent` 가드 (07 7.7.2).
- [ ] `text` 청크 progressText 누적 표시 → `recipe` 청크 도달 시 `RecipeDisplay` 렌더 (06 6.4.2).
- [ ] `error` 청크 분기 → Toast 또는 인라인 에러 (06 6.3.5).
- [ ] 비스트리밍 폴백 경로 (8.6).
- [ ] CORS 헤더 확인 — 미니앱 도메인이 백엔드 화이트리스트에 포함됨을 03 3.1.4와 교차 확인 (실패 시 fetch 자체가 차단됨).

## 8.8 백엔드와의 동기 항목

| 항목 | 백엔드 결정 (03-API-CONTRACT) | 미니앱 소비 |
|------|------------------------------|------------|
| Content-Type | `text/event-stream; charset=utf-8` | `fetch.body` 텍스트 디코더 |
| 청크 구분자 | `\n\n` 빈 줄 | `parseSseEvents`의 `indexOf('\n\n')` |
| 청크 타입 키 | `type`(discriminated union) | `switch (chunk.type)` 분기 |
| 에러 전달 방식 | HTTP 200 + `error` 청크 | HTTP 상태 무관, 청크 타입으로 분기 |
| 최종 결과 위치 | `recipe` 청크의 `.recipe` 필드 | `setRecipe(chunk.recipe)` |
| 인증 헤더 | `X-Toss-User-Id` (공개 엔드포인트지만 옵션 P upsert 도움) | 있으면 보냄, 없으면 생략 |
| CORS | 미니앱 도메인 화이트리스트 | 09-ENV-CONFIG와 교차 |

**조정 필요 시점**: 백엔드가 SSE 형식을 변경하면 본 챕터와 `useRecipeGenerate.ts`를 동시 갱신. backend에게 SendMessage로 확인.

## 8.9 검증 절차 (QA가 확인할 항목)

- [ ] 본 챕터의 청크 5종(`meta`/`text`/`recipe`/`error`/`done`)이 03 3.2.4 표와 정확히 일치.
- [ ] `error` 청크가 HTTP 200 내부 전달이며 HTTP 상태로 분기하지 않음을 명시.
- [ ] 최종 결과는 `recipe` 청크의 `.recipe`임을 명시(`text` 누적 아님).
- [ ] `useRecipeGenerate` 외부 인터페이스가 웹/미니앱 동일(`status`, `progressText`, `recipe`, `error`, `generate`, `cancel`, `reset`).
- [ ] AbortController가 (1) 명시 cancel, (2) unmount cleanup, (3) 하드웨어 백 가드(07 7.7.2) 3곳에서 사용됨.
- [ ] 비스트리밍 폴백 경로가 정의되어 있음.
- [ ] 미니앱 도메인 CORS 화이트리스트 정합성(09-ENV-CONFIG 작성 후 교차).
- [ ] 환경 미지원(`!res.body`)에 대한 처리 흐름이 정의됨.

## 8.10 SSOT 참조

- `src/app/api/recipes/generate/route.ts` — 백엔드 라우트
- `src/lib/sse.ts` — `encodeSSE` 인코더
- `src/types/api.ts` — `StreamChunk` discriminated union
- `src/hooks/useRecipeGenerate.ts` — 참조 클라이언트 (웹) — RN 이식 원본
- `src/hooks/api-client.ts` — `ApiClientError`, `requestData` (비스트리밍 폴백에 사용)
- [03-API-CONTRACT.md 3.2](./03-API-CONTRACT.md) — 와이어 형식 SSOT
- [05-AUTH.md](./05-AUTH.md) — `X-Toss-User-Id` 헤더 송출
- [07-ROUTING.md 7.7](./07-ROUTING.md) — 하드웨어 백 + AbortController 연계
- [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) — `API_BASE_URL` (plugin-env, `import.meta.env`)·도메인 화이트리스트
- [ADR-008](../adr/ADR-008-gemini-default-with-claude-fallback.md) — 기본 Gemini, Claude 비활성 보존 (Provider 선택은 백엔드 책임)

## 8.11 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-22 | 초기 작성 (세션 #4) | SSE → RN fetch+ReadableStream 사양 + AbortController + 비스트리밍 폴백 + Gemini 부분 JSON 처리 |
