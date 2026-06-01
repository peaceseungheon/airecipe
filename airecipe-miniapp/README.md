# airecipe-miniapp

AI 레시피 안내 — 앱인토스 미니앱 (React Native + Granite + TDS).

요리명을 입력하면 AI가 한국어 레시피를 생성하고, 영양 정보를 함께 보여준다. 저장·즐겨찾기·마이 레시피 관리 가능.

> 본 저장소는 **미니앱 클라이언트만** 담는다. 백엔드(API·DB·AI)는 별 저장소 [AIReceipe](https://github.com/peaceseungheon/AIReceipe)의 Next.js + Supabase + AI Provider를 그대로 사용 (Vercel 배포).

## 시작하기

```bash
# 의존성 설치 (이미 완료된 상태로 클론한 경우 생략)
pnpm install

# 환경변수 — .env.example을 복사하고 값 채우기
cp .env.example .env.local
# .env.local 편집: API_BASE_URL을 운영 도메인으로 교체

# 로컬 개발 서버
pnpm dev:local
```

토스 샌드박스 앱에서 `intoss://airecipe`를 입력하여 진입(딥링크 prefix = `scheme://appName` = `intoss://` + `airecipe`). 자세한 절차는 `docs/appsintoss-port/09-ENV-CONFIG.md` 참조.

## 디렉터리 구조

```
airecipe-miniapp/
├── pages/                    # 파일 기반 라우팅 (intoss://airecipe/<path>)
├── src/
│   ├── _app.tsx              # 앱 컨테이너
│   ├── components/           # TDS 기반 재사용 컴포넌트
│   ├── hooks/                # useTossUserId 등
│   ├── services/             # api-client.ts (백엔드 호출 단일 경로)
│   ├── types/                # 공유 타입 (백엔드와 동일)
│   └── lib/                  # zod 스키마 등
├── docs/
│   ├── appsintoss-port/      # 포팅 사양서 11챕터 (LLM 안내 자료)
│   └── adr/                  # ADR-009 + 백엔드 핵심 ADR 사본
├── granite.config.ts         # 앱 설정 (appName·displayName·plugin-env)
└── .env.example              # 환경변수 템플릿
```

## 문서

신규 작업자(또는 LLM)는 다음 순서로 읽는다:

1. `docs/appsintoss-port/00-OVERVIEW.md` — 챕터 인덱스
2. `docs/adr/ADR-009-appsintoss-port-architecture.md` — 핵심 결정
3. `docs/appsintoss-port/10-SPRINT-PLAN.md` — Phase별 구현 순서

자세한 규칙은 `CLAUDE.md`.

## 스크립트

| 명령 | 용도 |
|------|------|
| `pnpm dev` / `pnpm dev:local` | 로컬 개발 서버 |
| `pnpm dev:staging` | 스테이징 백엔드로 개발 |
| `pnpm build:staging` | 스테이징 번들 |
| `pnpm build:prod` | 프로덕션 번들 |
| `pnpm typecheck` | 타입 체크 |
| `pnpm lint` | ESLint |
| `pnpm test` | Jest |
| `pnpm deploy` | 콘솔 업로드 (ait deploy) |

## 라이선스

Private.
