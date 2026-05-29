# 0007. 페이지 보호를 middleware.ts 대신 proxy.ts 규약으로 전환 (Next 16)

- 상태: 채택됨
- 날짜: 2026-05-21

## 맥락

계약 0.3은 페이지 보호 가드를 `middleware.ts`로 명시했다. 그러나 프론트 구현이 Next.js 16으로 빌드되면서 `middleware` 파일 규약이 **deprecated** 되어 빌드 경고가 발생한다. Next 16은 이를 `proxy.ts`(함수명 `proxy`)로 이름을 바꿔 "네트워크 경계·라우팅" 역할을 명확히 했다(공식 업그레이드 가이드).

요구사항(requirements.md)은 "Next.js 14+"를 명시하므로 Next 16은 허용 범위다. 동작은 정상이나 경고가 남고, 향후 `middleware` 규약은 제거 예정이다.

## 결정

페이지 보호 가드를 `proxy.ts`(named export `proxy`)로 전환한다.
- 공식 codemod 사용: `npx @next/codemod@latest middleware-to-proxy .`
- 계약 0.3의 "middleware.ts" 문구를 "proxy.ts"로 갱신한다.
- matcher·리다이렉트 정책(0.3 페이지 보호 표)은 그대로 유지한다 — 파일/함수명만 변경.

## 근거

- **미래 호환성**: `middleware` 규약은 deprecated이며 제거 예정. Sprint 1에서 전환하면 부채를 남기지 않는다.
- **경고 제거**: 빌드 경고가 사라져 DoD(`npm run build` 통과)의 신호 대 잡음비가 개선된다.
- **런타임 제약 무해**: `proxy`는 nodejs 런타임 전용(edge 미지원)이다. 우리 가드는 `@supabase/ssr` 세션 갱신 + 리다이렉트로 edge 런타임이 필요 없으므로 제약이 문제되지 않는다.
- **안전한 전환**: 공식 codemod가 파일명·함수명·config 플래그를 자동 변환한다. 수동 위험 최소.

## 대안

- **middleware.ts 유지**: deprecated 경고를 안고 가며 향후 제거 시 강제 마이그레이션. 부채. 기각.
- **Next 14로 다운그레이드**: 요구사항이 "14+"라 가능하나, 이미 16으로 동작하는 구현을 되돌리는 비용이 크고 이득이 없다. 기각.

## 결과

- 계약 0.3: "middleware.ts" → "proxy.ts" 문구 갱신, 페이지 보호 표·불변식은 동일.
- frontend: `middleware.ts` → `proxy.ts`, export `middleware` → `proxy`로 전환(codemod). matcher 동일(`/my-recipes/:path*`, `/recipe/:path*`, `/auth/login`, `/auth/signup`). `/recipe/generate`는 코드에서 공개 처리 유지.
- 런타임은 nodejs 고정 — Supabase SSR 세션 갱신은 nodejs에서 정상.
- QA: 페이지 보호 검증 대상 파일을 `proxy.ts`로 갱신. 보호 경로·리다이렉트 동작은 동일 기준.
- 관련: 계약 0.3, ADR-004(단건 조회), frontend 요약 6절.
