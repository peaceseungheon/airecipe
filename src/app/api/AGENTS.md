# src/app/api/ — Route Handler (HTTP 경계)

API 엔드포인트. 계약: `_workspace/01_architect_api_contract.md` (SSOT). 상세 문서: `docs/api/`.

## 책임
HTTP I/O만: 입력 파싱·검증, 인증 확인, Service 호출, 응답 래핑. **비즈니스 로직 금지(SRP)** — 로직은 `src/services/`.

## 핵심 규약
- **얇게 유지**: Route 내 로직은 검증/분기/위임뿐. 데이터·AI 접근은 Service 경유.
- **응답은 `src/lib/api-response.ts`로만 생성**: 성공 `ok`/`okList`(`{data, meta?}`), 에러 `failFromError`(`{error:{code,message}}`). 직접 `NextResponse.json` 금지.
- **검증은 경계에서**: `src/lib/validation.ts`(zod). 통과 후 내부는 타입 신뢰.
- **인증**: 보호 엔드포인트는 진입부 `requireUser()`(`src/lib/auth.ts`). 미인증 시 401.
- **의존성은 `src/lib/composition.ts`에서 조립**해 받는다(직접 new 금지).

## 엔드포인트
| Method | Path | 인증 | 응답 |
|--------|------|------|------|
| POST | `recipes/generate` | 공개 | JSON `{data: GeneratedRecipe}` 또는 SSE(`StreamChunk`) |
| GET | `recipes` | 필요 | `{data: Recipe[], meta}` |
| GET | `recipes/[id]` | 필요 | `{data: Recipe}` (단건, ADR-004) |
| POST | `recipes` | 필요 | 201 `{data: Recipe}` |
| PATCH | `recipes/[id]/favorite` | 필요 | `{data: Recipe}` |
| DELETE | `recipes/[id]` | 필요 | `{data: {id}}` |

## 주의
- `/generate`의 SSE 모드: 에러도 HTTP 200 + `error` 청크(계약 1.3). 비스트리밍은 일반 HTTP 상태.
- 모든 Route는 `runtime = "nodejs"` (Anthropic/Supabase SDK).
- 동적 라우트 `params`는 Next 16에서 `Promise` — `await params`.
