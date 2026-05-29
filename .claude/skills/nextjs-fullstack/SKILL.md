---
name: nextjs-fullstack
description: "Next.js(App Router) + TypeScript 풀스택 레시피 앱의 프로젝트 구조, API Route Handler, 데이터 페칭 훅, 컴포넌트 작성, 빌드/테스트 명령 규칙. Next.js 코드를 작성·수정하거나, 페이지/API/훅을 추가하거나, 프로젝트 구조를 결정할 때 반드시 이 스킬을 사용할 것. 라우팅·서버/클라이언트 컴포넌트 경계·응답 형식 결정 시에도 사용."
---

# Next.js 풀스택 작성 가이드 (레시피 앱)

App Router + TypeScript 기준. 일관된 구조와 경계면 안전성을 확보한다.

## 프로젝트 구조

```
src/
├── app/                    # App Router: 라우팅 = 디렉토리 구조
│   ├── api/                # Route Handler (백엔드)
│   │   └── recipes/route.ts
│   ├── (marketing)/        # route group → URL에서 제거됨
│   ├── recipes/[id]/page.tsx
│   └── layout.tsx
├── components/             # 재사용 UI (presentational)
├── hooks/                  # 데이터 페칭/상태 훅 (use*.ts)
├── services/              # 비즈니스 로직 (프레임워크 독립)
├── repositories/          # 데이터 접근
├── lib/ai/                # AI 어댑터 (Claude)
├── mappers/               # DB row ↔ DTO 변환
└── types/                 # 공유 타입 (API 계약의 코드 표현 = SSOT)
```

> `src/types/`는 백엔드와 프론트가 **공유**하는 단일 진실 공급원이다. API 응답 타입을 여기 정의하고 양쪽이 import한다. 타입을 양쪽에 따로 정의하면 경계면 불일치가 발생한다.

## API Route Handler 규칙

```ts
// src/app/api/recipes/route.ts
import { NextResponse } from "next/server";
import type { RecipeListResponse } from "@/types/recipe";

export async function GET(): Promise<NextResponse<RecipeListResponse>> {
  const recipes = await recipeService.list();
  return NextResponse.json({ recipes }); // 응답 shape을 타입으로 고정
}
```

규칙:
- **응답 타입을 `NextResponse<T>`로 명시한다.** 프론트 훅이 같은 `T`를 사용한다.
- **응답 래핑을 일관되게 한다.** 배열은 `{ recipes: [...] }`처럼 객체로 감싸 향후 메타데이터 추가 여지를 둔다. 감싼 경우 프론트가 반드시 unwrap한다.
- Route는 얇게 — 로직은 Service로 (SRP). `software-design-principles-backend` 스킬 참조.
- 입력 검증은 경계에서 (zod). 검증 통과 후 내부는 타입 신뢰.

## 데이터 페칭 훅 규칙

```ts
// src/hooks/use-recipes.ts
import type { RecipeListResponse } from "@/types/recipe";

export function useRecipes() {
  // 응답 타입은 API와 동일한 RecipeListResponse 사용
  // { recipes } 를 unwrap하여 반환
}
```

규칙:
- **API와 동일한 공유 타입을 import한다.** 훅에서 임의 제네릭 캐스팅(`fetchJson<Recipe[]>`)으로 추측하지 않는다.
- 래핑된 응답은 훅에서 unwrap하여 컴포넌트엔 깔끔한 형태로 전달.
- 로딩/에러/빈 상태를 명시적으로 노출한다.

## 서버 / 클라이언트 컴포넌트 경계
- 기본은 서버 컴포넌트. 상호작용(useState/이벤트/훅)이 필요할 때만 `"use client"`.
- 데이터 페칭은 가능하면 서버 컴포넌트에서. 클라이언트 훅은 사용자 상호작용 기반 페칭(레시피 생성 요청 등)에 사용.

## 빌드 / 테스트 명령
- 타입체크 + 빌드: `npm run build`
- 린트: `npm run lint`
- 단위 테스트: `npm test` (vitest 가정)
- 개발 서버: `npm run dev`

> `npm run build` 통과는 **타입 캐스팅·any·제네릭으로 우회된 불일치를 잡지 못한다.** 빌드 통과를 완료로 간주하지 말고 QA의 경계면 검증을 거친다.

## AI 비동기 응답 처리
레시피 생성처럼 시간이 걸리는 작업:
- 즉시 완료 가능하면 동기 응답 `{ recipe }`.
- 오래 걸리면 작업을 큐잉하고 `202 { jobId, status }` 반환 후 폴링/스트리밍. **이 경우 즉시 응답 shape과 최종 결과 shape이 다름을 타입으로 구분**하고 프론트가 혼동하지 않게 한다.
