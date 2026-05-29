# src/lib/supabase/ — Supabase 클라이언트 팩토리

`@supabase/ssr` 기반 클라이언트 생성 (ADR-001, 아키텍처 6절).

## 파일
| 파일 | 용도 |
|------|------|
| `server.ts` | Route Handler / Server Component용. 세션 쿠키 기반 → RLS가 `auth.uid()` 인식 (웹앱 경로) |
| `client.ts` | Client Component용 (로그인/회원가입). anon key만 |
| `middleware.ts` | 세션 갱신 + 보호 페이지(`/my-recipes`) 가드 헬퍼(`updateSession`). `src/proxy.ts`(구 middleware 컨벤션, ADR-007)가 호출 |
| `service-role.ts` | **service-role 키** 인증 클라이언트 (ADR-010). RLS 우회용 — 미니앱 헤더 경로 전용. 브라우저 노출 금지 |

## 핵심 규약
- **service role key는 클라이언트에 절대 노출 금지.** 브라우저 클라이언트는 anon key만.
- 세션 갱신은 미들웨어가 매 요청 `getUser()`로 수행 — 호출 안 하면 토큰 갱신 안 됨.
- 보호 API는 Route에서 `requireUser(request)`(`src/lib/auth/require-user.ts`, ADR-010)로 401 처리. 헤더 경로는 service-role + Repository `.eq('user_id', ...)` 단일 방어로 격리.
- 레거시 `src/lib/auth.ts`(인자 없는 `requireUser()`)는 신규 사용 금지.
