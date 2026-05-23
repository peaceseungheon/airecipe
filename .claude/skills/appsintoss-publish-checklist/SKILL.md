---
name: appsintoss-publish-checklist
description: "앱인토스 미니앱 출시 검수 전담 체크리스트 — 콘솔 등록(appName/displayName/아이콘/카테고리/도메인 화이트리스트), TDS 의무, 권한 최소화, 번들 100MB 제한, AI 콘텐츠 면책, 서비스 오픈 정책 준수, CORS·HTTPS, 보안(키 미포함), 고객센터·홈페이지 등록을 점검한다. 출시 준비, 검수 점검, 콘솔 등록 확인, 배포 직전 검토 요청 시 반드시 이 스킬을 사용. '출시', '검수', '심사', '배포' 키워드도 트리거."
---

# 앱인토스 미니앱 출시 검수 체크리스트 (airecipe-miniapp)

본 미니앱은 비게임 카테고리(AI 레시피 안내)로 출시한다. 검수 통과 기준은 앱인토스 공식 정책을 따른다. 본 스킬은 Phase 5(출시 준비)에서 architect/qa가 사용하는 일관 체크리스트다.

SSOT 챕터: `docs/appsintoss-port/09-ENV-CONFIG.md` §9.6, `10-SPRINT-PLAN.md` Phase 5. 본 스킬은 그 위에 운영 절차를 더한 것.

## 검수 6개 영역

### 1. 콘솔 등록

| 항목 | 요구 |
|------|------|
| appName | `airecipe-miniapp` (RFC-1123, granite.config.ts와 정확히 일치) |
| displayName | `AI 레시피` (한글, 콘솔 등록명과 일치) |
| 카테고리 | 비게임 |
| 아이콘 | 콘솔 업로드 → URL을 `granite.config.ts`의 `brand.icon`에 반영. 4x 해상도 권장 |
| 외부 도메인 화이트리스트 | 백엔드 운영 URL (HTTPS) 등록 |
| 고객센터 / 홈페이지 | 내비게이션 바 더보기에 표시되는 링크 |
| 출시 환경 | staging → production 분리 (테스트 후 승급) |

### 2. TDS 의무 (비게임 필수)

| 점검 항목 | 검증 방법 |
|----------|----------|
| 모든 화면이 TDS RN 컴포넌트 사용 | `06-UI-MAPPING.md`와 코드 교차 비교 |
| 커스텀 색·폰트는 TDS 토큰 활용 | 직접 hex/픽셀 값 사용 grep |
| TDS 미커버 영역만 커스텀 컴포넌트 | 커스텀 컴포넌트 인벤토리 작성, 각 사유 명시 |

### 3. 권한 최소화

| 항목 | 본 미니앱 |
|------|----------|
| `granite.config.ts` `permissions` | `[]` (Sprint 1은 추가 권한 불필요) |
| 향후 권한 추가 시 | 검수 가이드의 권한별 사유 명시 필요 |

### 4. 번들 / 성능

| 항목 | 요구 |
|------|------|
| 번들 크기 | 100MB 이하 (압축 해제 기준) |
| 이미지 / 폰트 | 분리 권장 (인앱 리소스 vs CDN) |
| `granite build --analyze` | 번들 분석 후 큰 모듈 정리 |
| 콜드 스타트 | 적절한 첫 화면 로딩 시간 |

### 5. 콘텐츠 / 정책

| 항목 | 본 미니앱 |
|------|----------|
| 카테고리 위배 | 디지털 자산·도박·자금세탁·금융 ❌ 해당 없음 |
| AI 생성 콘텐츠 | 영양 정보·`healthNote`에 **"의료 자문이 아님"** 면책 문구 권장 |
| 자유 입력 사용자 텍스트 | 프롬프트 인젝션 / 비속어 / PII 정책 (백엔드 측 책임이지만 미니앱 UI도 가이드 표시) |
| 외부 링크 | 백엔드 외 외부 링크 사용 시 콘솔 등록 |

### 6. 보안 / 인프라

| 항목 | 검증 |
|------|------|
| 미니앱 번들에 API 키 미포함 | 빌드 산출물 `grep "GEMINI_API_KEY\|ANTHROPIC_API_KEY\|SUPABASE_SERVICE_ROLE_KEY"` 결과 비어있음 |
| `API_BASE_URL`은 HTTPS (production/staging) | HTTP는 local 한정 |
| CORS 화이트리스트 와일드카드 금지 | 백엔드 측 설정 점검 (별 저장소) |
| `X-Toss-User-Id` 헤더 UI/로그 노출 금지 | 화면·로깅 코드 grep |
| Sentry/로깅 PII 마스킹 | DSN 등록 시 정책 점검 |

## 검수 전 최종 체크리스트

```
[ ] 콘솔: appName·displayName·아이콘·카테고리·도메인 화이트리스트 등록
[ ] granite.config.ts: 콘솔 값과 정확히 일치 (특히 icon URL)
[ ] 모든 화면 TDS RN 컴포넌트 사용 확인 (커스텀 컴포넌트 사유 명시)
[ ] 번들 100MB 이하 (`pnpm build:prod` 후 *.ait 파일 크기)
[ ] 권한 최소 (`permissions: []`)
[ ] AI 면책 문구 (영양/healthNote)
[ ] API 키 미니앱 번들 비포함 확인 (빌드 산출물 grep)
[ ] CORS·HTTPS 백엔드 측 점검
[ ] 401·404·429·5xx 에러 모두 한국어 친화적 UI
[ ] 6기능 e2e 샌드박스 통과 (생성·저장·목록·상세·즐겨찾기·삭제)
[ ] 고객센터·홈페이지 콘솔 등록
[ ] 토스앱 5.246.0 이상 진입 확인 (서비스 오픈 정책)
```

## 검수 반려 흔한 사유 (사전 예방)

| 반려 사유 | 사전 예방 |
|----------|----------|
| TDS 미사용 | 06-UI-MAPPING 교차 검증 + AppsInToss MCP 표본 |
| 아이콘 미설정 | 콘솔 업로드 후 granite.config.ts 반영 |
| appName 콘솔 불일치 | 콘솔에 등록한 ID와 granite.config.ts의 appName 정확 매칭 |
| 권한 과다 | `permissions: []` 유지, 추가 시 사유 명시 |
| 번들 100MB 초과 | 리소스 분리·이미지 압축 |
| AI 면책 미표시 | 영양/healthNote UI에 한국어 면책 라벨 |
| 정책 카테고리 위배 | 본 앱은 해당 없으나 향후 기능 추가 시 재검토 |

## 운영 절차

1. **출시 전 1주일**: 본 체크리스트를 architect/qa가 함께 실행.
2. **위반/위반 가능 발견 시**: architect가 ADR로 우회 결정 또는 기능 조정.
3. **검토 요청 직전**: `pnpm build:prod` 산출물에 대해 보안 grep 실시.
4. **검토 요청 후 반려 시**: 반려 사유를 본 체크리스트에 반영하여 진화.

## SSOT 참조

- `docs/appsintoss-port/09-ENV-CONFIG.md` §9.5 보안 체크리스트, §9.6 출시 정책
- `docs/appsintoss-port/10-SPRINT-PLAN.md` Phase 5
- AppsInToss 공식: `checklist/app-nongame.md`, `intro/guide.md`, `development/deploy.md`
- AppsInToss MCP `search_docs` "출시 정책", "검수", "비게임 가이드"
