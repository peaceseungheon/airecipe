# ADR-019 — Sentry 에러 트래킹 (Granite 정식 경로 정렬 + PII 차단)

- **상태:** Accepted
- **날짜:** 2026-06-01
- **맥락 범위:** 미니앱 단독 (백엔드 무변경)
- **관련:** ADR-009(아키텍처), ADR-014(어댑터 환경 분기 선례), 09-ENV-CONFIG

## 배경

Sentry 마법사(`@sentry/react-native` wizard)가 생성한 기본 설정이 코드에 들어와 있었으나, 본 앱은 **Granite + 앱인토스 미니앱**이라 bare RN 전제의 wizard 설정이 환경과 맞지 않았다. 검토 결과 5개 문제 확인:

1. **정식 소스맵 경로 부재** — `@granite-js/plugin-sentry`가 설치만 되고 `granite.config.ts`에 미연결. 프로덕션 Hermes 번들에서 스택트레이스가 minified로만 수집 → 디버깅 불가.
2. **metro 경유 무효** — `metro.config.cjs`의 `withSentryConfig`는 RN CLI Metro 전제. Granite 자체 번들러(`granite dev`/`ait build`)는 이 경로를 거치지 않음.
3. **동작 모순** — `enableNative: false`(미니앱은 네이티브 Sentry 미탑재) 상태에서 `mobileReplayIntegration()`·`feedbackIntegration()`(네이티브 의존) 사용.
4. **PII 정책 위반** — `sendDefaultPii: true`(IP/쿠키/유저) + `enableLogs: true`. 코드 규칙 6(`X-Toss-User-Id` 노출 금지)·09 §9.5 PII 마스킹·자유 텍스트 로그 정책과 충돌.
5. **DSN 하드코딩** — 09 §9.1.1은 `SENTRY_DSN`을 plugin-env 주입으로 규정. 평문 하드코딩은 SSOT 위반 + 환경 분리 불가 + local에서도 전송.

## 결정 (D64~D69)

- **D64 — 소스맵은 `@granite-js/plugin-sentry`로 일원화.** `granite.config.ts` plugins 배열 말미에 `sentry()` 추가(README 규약: plugin-hermes 뒤). `metro.config.cjs`의 `withSentryConfig`는 제거(plain metro config로 환원).
- **D65 — 빌드 플러그인은 CI 시크릿 존재 시에만 활성.** `enabled: SENTRY_AUTH_TOKEN !== ''`. 토큰 부재(로컬·기여자 빌드)에서 no-op이라 빌드가 깨지지 않음. `authToken`/`org`/`project`는 `process.env`(CI 주입, 미니앱 번들 미포함).
- **D66 — 런타임 init는 환경 게이팅.** `APP_ENV === 'local'` 또는 `SENTRY_DSN` 미설정 시 `Sentry.init` 스킵. ADR-014 D27 광고 어댑터 noop 분기와 동일 정책(dev 노이즈·쿼터 소모 차단).
- **D67 — DSN·environment는 plugin-env 주입.** `granite.config.ts` `env({ SENTRY_DSN })` + `import.meta.env.SENTRY_DSN`/`APP_ENV`로 소비. 하드코딩 금지(09 §9.1.1).
- **D68 — PII 차단 동결.** `sendDefaultPii: false` + `enableLogs: false`. 자유 텍스트(재료 입력)·식별자 헤더 자동 수집 차단(09 §9.5·코드 규칙 6).
- **D69 — 네이티브 의존 통합 미사용.** `enableNative: false` 유지(미니앱은 호스트 앱 내 RN). `mobileReplayIntegration`·`feedbackIntegration`·replay 샘플레이트 제거 — JS 에러 캡처만 유효.

## 결과

- `granite.config.ts` — `sentry()` 플러그인 추가 + `SENTRY_DSN` env 주입. (appName은 `airecipe` 그대로 — 본 ADR 범위 밖.)
- `metro.config.cjs` — `withSentryConfig` 제거.
- `src/_app.tsx` — `Sentry.init` 환경 게이팅 + PII/logs off + replay/feedback 통합 제거 + DSN/environment env 주입.
- `src/types/env.d.ts`·`src/env.d.ts`(수동 sync, D38 선례) — `SENTRY_DSN: string` 추가.
- 검증: typecheck PASS, lint 0 errors(router.gen.ts 누적 warning 1건).

## 외부 작업 PENDING

- **Sentry 콘솔** — 프로젝트의 org/project slug 확정 + CI `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` 시크릿 등록.
- **DSN 환경 주입** — staging/prod 빌드 시 `SENTRY_DSN` 환경변수 주입(`.env.production` 또는 CI).
- **실 송출 검증** — staging 배포 후 의도적 에러 → Sentry 이벤트 + un-minified 스택트레이스(소스맵) 수신 확인.

## 보류 / 미채택

- **Session Replay / User Feedback** — 네이티브 모듈 의존이라 미니앱(enableNative=false)에서 불가. 향후 앱인토스가 네이티브 Sentry를 지원하면 별 ADR 재검토.
- **`beforeSend` 헤더 스크럽** — sendDefaultPii=false로 자동 수집을 끈 현재는 불필요. 수동 `setUser`/breadcrumb 도입 시 재평가.
- **performance tracing(`tracesSampleRate`)** — 본 사이클 미도입(에러 트래킹만). 필요 시 별 ADR.
