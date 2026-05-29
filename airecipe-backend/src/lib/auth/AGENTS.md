# src/lib/auth/ — 인증 진입점 (ADR-010)

웹앱(Supabase Auth 쿠키)과 미니앱(앱인토스 `X-Toss-User-Id` 헤더) 두 경로를 **단일 추상**(`requireUser(request)`) 뒤로 통합한다.

## 파일
| 파일 | 용도 |
|------|------|
| `require-user.ts` | `requireUser(request): Promise<InternalUser>` — Route Handler가 호출. **헤더 우선 · 쿠키 fallback** (ADR-010 D3) |
| `toss-user-resolver.ts` | `resolveInternalUserId(tossUserIdHash): Promise<uuid>` — `profiles` 매핑 테이블 upsert(ADR-010 D1). service-role 사용 |
| `index.ts` | re-export |

## 분기 규칙 (ADR-010 D3)
1. `X-Toss-User-Id` 헤더 값이 trim 후 비어있지 않다면 → `resolveInternalUserId(hash)` → `{ id, source: 'header' }`. **service-role 클라이언트로 RLS 우회.**
2. 헤더 없음 → 기존 Supabase 세션 → `{ id: user.id, source: 'cookie', email }`. **쿠키 RLS 통과.**
3. 둘 다 실패 → `ServiceError('UNAUTHORIZED')` → Route가 401로 변환.

## 핵심 규약
- **Route Handler는 무조건 `requireUser(request)`만 호출**(인자 필수). 인자 없는 호출은 ADR-010 이전 레거시(`src/lib/auth.ts`)로 신규 사용 금지.
- **`source`는 로깅·메트릭 용도**. 도메인 로직 분기는 `id`(internal_user_id)만 사용.
- **헤더 경로는 service-role**이라 RLS가 비활성. 격리는 Repository(`src/repositories/`)가 모든 메서드에 `.eq('user_id', internalUserId)` 필터를 부착하여 단일 방어로 강제(ADR-010 D4, D7).
- `resolveInternalUserId`는 멱등 — UNIQUE 제약·`onConflict: 'toss_user_id'` upsert로 경합 안전. 캐시는 요청 스코프로만 도입(프로세스 전역 캐시 금지 — stale 위험).

## 적용 범위
보호 5개 핸들러:
- GET/POST `/api/recipes`
- GET/DELETE `/api/recipes/[id]`
- PATCH `/api/recipes/[id]/favorite`

**예외 1개:** `POST /api/recipes/generate`는 비인증 공개 엔드포인트(ADR-010 D8). `requireUser` 호출 금지 — 강제 시 웹앱 비로그인 미리보기 회귀.

## 관련
- ADR-010 (옵션 P · 인증 경로 병존)
- ADR-001 (RLS — 쿠키 경로에서 살아남음)
- ADR-005 (소유권 404 수렴 — 양 경로 적용)
- `src/lib/supabase/service-role.ts` — service-role 클라이언트
- `src/lib/cors.ts` — CORS 헬퍼(미니앱 cross-origin)
- `src/lib/auth.ts` — **레거시**. 신규 코드는 import 금지(완전 제거 검토는 Sprint 2).
