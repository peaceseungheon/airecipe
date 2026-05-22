# src/lib/supabase/ — Supabase 클라이언트 팩토리

`@supabase/ssr` 기반 클라이언트 생성 (ADR-001, 아키텍처 6절).

## 파일
| 파일 | 용도 |
|------|------|
| `server.ts` | Route Handler / Server Component용. 세션 쿠키 기반 → RLS가 `auth.uid()` 인식 |
| `client.ts` | Client Component용 (로그인/회원가입). anon key만 |
| `middleware.ts` | 세션 갱신 + 보호 페이지(`/my-recipes`) 가드 헬퍼(`updateSession`). `src/proxy.ts`(구 middleware 컨벤션, ADR-007)가 호출 |

## 핵심 규약
- **service role key는 클라이언트에 절대 노출 금지.** 브라우저 클라이언트는 anon key만.
- 세션 갱신은 미들웨어가 매 요청 `getUser()`로 수행 — 호출 안 하면 토큰 갱신 안 됨.
- 보호 API는 Route에서 `requireUser()`로 401 처리(미들웨어는 페이지 리다이렉트만).
