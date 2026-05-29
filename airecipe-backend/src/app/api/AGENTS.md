# src/app/api/ — Route Handler (HTTP 경계)

API 엔드포인트. 계약: `_workspace/01_architect_api_contract.md` (SSOT). 상세 문서: `docs/api/`.

## 책임
HTTP I/O만: 입력 파싱·검증, 인증 확인, Service 호출, 응답 래핑. **비즈니스 로직 금지(SRP)** — 로직은 `src/services/`.

## 핵심 규약
- **얇게 유지**: Route 내 로직은 검증/분기/위임뿐. 데이터·AI 접근은 Service 경유.
- **응답은 `src/lib/api-response.ts`로만 생성**: 성공 `ok`/`okList`(`{data, meta?}`), 에러 `failFromError`(`{error:{code,message}}`). 직접 `NextResponse.json` 금지.
- **검증은 경계에서**: `src/lib/validation.ts`(zod). 통과 후 내부는 타입 신뢰.
- **인증** (ADR-010): 보호 엔드포인트는 진입부 `requireUser(request)`(`src/lib/auth/require-user.ts`). 헤더 우선·쿠키 fallback. 미인증 시 401. 레거시 `src/lib/auth.ts`(인자 없는 형태)는 신규 사용 금지.
- **CORS** (ADR-010 D5): 모든 라우트(인증·비인증 무관)에 `withCors(..., req)` 래핑 + `export const OPTIONS = corsPreflightResponse`. SSE는 `Response` init.headers에 `buildCorsHeaders(req)` spread.
- **의존성은 `src/lib/composition.ts`에서 조립**해 받는다(직접 new 금지).

## 엔드포인트
| Method | Path | 인증 | 응답 |
|--------|------|------|------|
| POST | `recipes/generate` | 공개 (ADR-010 D8 — 비로그인 미리보기 유지) | JSON `{data: GeneratedRecipe}` 또는 SSE(`StreamChunk`) |
| GET | `recipes` | 필요 (헤더/쿠키) | `{data: Recipe[], meta}` |
| GET | `recipes/[id]` | 필요 (헤더/쿠키) | `{data: Recipe}` (단건, ADR-004) |
| POST | `recipes` | 필요 (헤더/쿠키) | 201 `{data: Recipe}` |
| PATCH | `recipes/[id]/favorite` | 필요 (헤더/쿠키) | `{data: Recipe}` |
| DELETE | `recipes/[id]` | 필요 (헤더/쿠키) | `{data: {id}}` |
| OPTIONS | (모든 라우트) | 무관 | 204 + CORS 헤더(화이트리스트만) |

## 주의
- `/generate`의 SSE 모드: 에러도 HTTP 200 + `error` 청크(계약 1.3). 비스트리밍은 일반 HTTP 상태.
- 모든 Route는 `runtime = "nodejs"` (Anthropic/Supabase SDK).
- 동적 라우트 `params`는 Next 16에서 `Promise` — `await params`.
