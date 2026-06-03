# 요리 기록 피드 — 백엔드 구현 계획 (Plan 1/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **이 프로젝트의 실행 경로:** 본 저장소는 자체 오케스트레이터(`recipe-app-orchestrator` / `recipe-backend`·`recipe-architect`·`recipe-qa`)를 가진다. 이 계획은 그 팀으로 실행해도 되고, superpowers 서브에이전트로 실행해도 된다. 어느 쪽이든 **태스크 단위 + 태스크 사이 리뷰**를 지킨다.

**Goal:** 요리 기록(cooking log)의 영속화 — `cooking_logs` 테이블 + Cloudflare R2(S3 호환) 비공개 버킷 + 보호된 4 엔드포인트(생성/목록/상세/삭제)를 백엔드(`airecipe-backend/`)에 추가한다.

**Architecture:** 기존 계층형(Route → `requireUser` → `composition.getXService(source)` → `Service(Repository)` → Supabase)을 그대로 따른다. 신규로 **R2 스토리지 어댑터**(`StoragePort` 인터페이스 + S3 구현)를 추가하고, `CookingLogService`가 R2 업로드/presign과 `CookingLogRepository`를 조율한다. 사진은 base64로 받아 R2에 PutObject, 조회 시 presigned GET URL을 발급한다.

**Tech Stack:** Next.js 16 App Router(`runtime="nodejs"`), TypeScript(strict), Supabase(service-role/cookie dual), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, zod. 단위 테스트는 **vitest**(본 저장소 최초 테스트 러너 — 순수 로직만 대상).

**SSOT:** `docs/superpowers/specs/2026-06-03-cooking-log-feed-design.md` (특히 §5 데이터 모델, §6 API 계약).

**기준 디렉토리:** 모든 경로는 `airecipe-backend/` 하위로 해석한다.

---

## File Structure (생성/수정 맵)

**생성:**
- `src/types/cooking-log.ts` — 도메인 타입(`CookingLog`, `CreateCookingLogInput`).
- `src/mappers/cooking-log-mapper.ts` — DB row(snake) ↔ 도메인(camel) 매핑.
- `src/lib/storage/storage-port.ts` — `StoragePort` 인터페이스(업로드/presign/삭제) + `StorageError`.
- `src/lib/storage/r2-storage.ts` — R2(S3) 구현 + 객체 키 빌더.
- `src/repositories/cooking-log.repository.ts` — 리포지토리 인터페이스 + `RepositoryError` 재사용.
- `src/repositories/supabase-cooking-log.repository.ts` — Supabase 구현.
- `src/services/cooking-log.service.ts` — 업로드+행+presign 조율.
- `src/app/api/cooking-logs/route.ts` — `POST`(생성)·`GET`(목록)·`OPTIONS`.
- `src/app/api/cooking-logs/[id]/route.ts` — `GET`(상세)·`DELETE`·`OPTIONS`.
- `supabase/migrations/0003_create_cooking_logs.sql` — 테이블+인덱스+RLS.
- `docs/adr/ADR-013-cooking-logs.md` — 백엔드 결정 기록.
- `docs/api/cooking-logs.md` — 백엔드 API 문서.
- `vitest.config.ts` + 테스트 파일들(아래 태스크별).

**수정:**
- `src/lib/validation.ts` — `createCookingLogRequestSchema`, `cookingLogListQuerySchema` 추가.
- `src/lib/composition.ts` — `getCookingLogService(source)` 추가.
- `src/types/api.ts` — 필요 시 `CookingLog` 응답 타입 re-export(기존 패턴 따름).
- `supabase/schema.sql` — 집계 스키마에 cooking_logs 추가(마이그레이션과 동기).
- `.env.local.example` — `R2_*` 4키 추가.
- `package.json` — 의존성 + `test`/`typecheck` 스크립트 추가.

**외부 작업(코드 아님, 별도 수행 — 태스크 B11에 체크리스트):** R2 버킷·API 토큰 발급, Supabase 마이그레이션 적용, 배포 환경 시크릿 주입.

---

## Task B1: 테스트 러너(vitest) + typecheck 스크립트 도입

> 본 저장소는 테스트 러너가 없다. 순수 로직(매퍼/검증/키빌더) TDD를 위해 vitest를 최초 도입한다. 라우트/리포지토리(외부 I/O)는 typecheck+lint+수동 검증으로 본다.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: vitest 설치**

Run:
```bash
cd airecipe-backend && pnpm add -D vitest
```
Expected: devDependencies에 `vitest` 추가, 설치 성공.

- [ ] **Step 2: vitest 설정 작성**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: package.json 스크립트 추가**

`package.json`의 `scripts`에 추가(기존 `dev`/`build`/`start`/`lint` 유지):
```json
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
```

- [ ] **Step 4: 빈 실행 확인**

Run: `cd airecipe-backend && pnpm test`
Expected: "No test files found" 또는 0 tests(에러 아님). vitest가 동작함을 확인.

Run: `cd airecipe-backend && pnpm typecheck`
Expected: 기존 코드 타입 통과(에러 0).

- [ ] **Step 5: Commit**
```bash
git add airecipe-backend/package.json airecipe-backend/vitest.config.ts airecipe-backend/pnpm-lock.yaml
git commit -m "chore(backend): vitest 테스트 러너 + typecheck 스크립트 도입"
```

---

## Task B2: 도메인 타입 + 매퍼 (TDD)

요리 기록의 도메인 타입과 DB row 매핑. `recipe` 필드는 기존 `GeneratedRecipe`를 스냅샷으로 재사용한다.

**Files:**
- Create: `src/types/cooking-log.ts`
- Create: `src/mappers/cooking-log-mapper.ts`
- Test: `src/mappers/cooking-log-mapper.test.ts`

- [ ] **Step 1: 도메인 타입 작성**

Create `src/types/cooking-log.ts`:
```ts
import type { GeneratedRecipe } from "./recipe";

/** 저장된 요리 기록(도메인). photoUrl 은 조회 시 발급되는 presigned URL. */
export interface CookingLog {
  id: string;
  photoUrl: string;
  recipe: GeneratedRecipe;
  rating: number; // 1..5
  review: string;
  createdAt: string; // ISO8601
}

/** 생성 입력(검증 통과 후). image 는 base64 data URI. */
export interface CreateCookingLogInput {
  image: string; // "data:image/jpeg;base64,..."
  mimeType: string; // "image/jpeg" 등
  recipe: GeneratedRecipe;
  sourceRecipeId?: string | null;
  rating: number;
  review: string;
}
```

- [ ] **Step 2: 실패하는 매퍼 테스트 작성**

Create `src/mappers/cooking-log-mapper.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { rowToCookingLog, type CookingLogRow } from "./cooking-log-mapper";
import type { GeneratedRecipe } from "@/types/recipe";

const recipe: GeneratedRecipe = {
  dishName: "김치찌개",
  description: "얼큰한 김치찌개",
  servings: 2,
  cookTimeMinutes: 30,
  difficulty: "easy",
  ingredients: [{ name: "김치", quantity: 200, unit: "g" }],
  steps: [{ order: 1, instruction: "끓인다" }],
  tips: ["신김치가 좋다"],
  nutrition: {
    calories: 300,
    carbohydrates: 20,
    protein: 15,
    fat: 10,
    fiber: 5,
    healthNote: "균형",
  },
};

const row: CookingLogRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  photo_path: "user/abc.jpg",
  recipe,
  source_recipe_id: null,
  rating: 5,
  review: "국물이 끝내줘요",
  created_at: "2026-06-03T00:00:00.000Z",
};

describe("rowToCookingLog", () => {
  it("snake_case row를 camelCase 도메인으로 매핑하고 photoUrl을 주입한다", () => {
    const result = rowToCookingLog(row, "https://signed.example/abc");
    expect(result).toEqual({
      id: row.id,
      photoUrl: "https://signed.example/abc",
      recipe,
      rating: 5,
      review: "국물이 끝내줘요",
      createdAt: row.created_at,
    });
    // user_id / photo_path / source_recipe_id 는 도메인에 노출하지 않는다
    expect("user_id" in result).toBe(false);
    expect("photoPath" in result).toBe(false);
  });
});
```

- [ ] **Step 2b: 실패 확인**

Run: `cd airecipe-backend && pnpm test`
Expected: FAIL — `cooking-log-mapper`(`rowToCookingLog`) 미존재.

- [ ] **Step 3: 매퍼 구현**

Create `src/mappers/cooking-log-mapper.ts`:
```ts
import type { GeneratedRecipe } from "@/types/recipe";
import type { CookingLog, CreateCookingLogInput } from "@/types/cooking-log";

export interface CookingLogRow {
  id: string;
  user_id: string;
  photo_path: string;
  recipe: GeneratedRecipe;
  source_recipe_id: string | null;
  rating: number;
  review: string;
  created_at: string;
}

/** DB row + 발급된 presigned URL → 도메인. 내부 식별자는 비노출. */
export function rowToCookingLog(row: CookingLogRow, photoUrl: string): CookingLog {
  return {
    id: row.id,
    photoUrl,
    recipe: row.recipe,
    rating: row.rating,
    review: row.review,
    createdAt: row.created_at,
  };
}

/** 생성 입력 → insert row(서버가 채우는 id/created_at 제외, photo_path 는 업로드 후 주입). */
export function inputToInsertRow(
  input: CreateCookingLogInput,
  userId: string,
  photoPath: string,
): Omit<CookingLogRow, "id" | "created_at"> {
  return {
    user_id: userId,
    photo_path: photoPath,
    recipe: input.recipe,
    source_recipe_id: input.sourceRecipeId ?? null,
    rating: input.rating,
    review: input.review,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd airecipe-backend && pnpm test`
Expected: PASS (rowToCookingLog 테스트 green).

- [ ] **Step 5: Commit**
```bash
git add airecipe-backend/src/types/cooking-log.ts airecipe-backend/src/mappers/cooking-log-mapper.ts airecipe-backend/src/mappers/cooking-log-mapper.test.ts
git commit -m "feat(backend): cooking-log 도메인 타입 + row 매퍼 (TDD)"
```

---

## Task B3: 요청 검증 스키마 (TDD)

`POST` 본문과 `GET` 쿼리 검증. `recipe`는 기존 `generatedRecipeSchema`를 재사용한다.

**Files:**
- Modify: `src/lib/validation.ts`
- Test: `src/lib/validation.cooking-log.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/validation.cooking-log.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  createCookingLogRequestSchema,
  cookingLogListQuerySchema,
  parseOrThrow,
} from "./validation";

const validRecipe = {
  dishName: "김치찌개",
  description: "d",
  servings: 2,
  cookTimeMinutes: 30,
  difficulty: "easy",
  ingredients: [{ name: "김치", quantity: 200, unit: "g" }],
  steps: [{ order: 1, instruction: "끓인다" }],
  tips: [],
  nutrition: { calories: 1, carbohydrates: 1, protein: 1, fat: 1, fiber: 1, healthNote: "n" },
};

const base = {
  image: "data:image/jpeg;base64,AAAA",
  mimeType: "image/jpeg",
  recipe: validRecipe,
  rating: 5,
  review: "맛있다",
};

describe("createCookingLogRequestSchema", () => {
  it("정상 입력을 통과시킨다", () => {
    const parsed = parseOrThrow(createCookingLogRequestSchema, base);
    expect(parsed.rating).toBe(5);
    expect(parsed.sourceRecipeId ?? null).toBeNull();
  });
  it("rating 0/6 은 거부한다", () => {
    expect(() => parseOrThrow(createCookingLogRequestSchema, { ...base, rating: 0 })).toThrow();
    expect(() => parseOrThrow(createCookingLogRequestSchema, { ...base, rating: 6 })).toThrow();
  });
  it("빈 review 는 거부한다", () => {
    expect(() => parseOrThrow(createCookingLogRequestSchema, { ...base, review: "" })).toThrow();
  });
  it("data URI 가 아닌 image 는 거부한다", () => {
    expect(() => parseOrThrow(createCookingLogRequestSchema, { ...base, image: "http://x" })).toThrow();
  });
});

describe("cookingLogListQuerySchema", () => {
  it("기본값 page=1 pageSize=20, 상한 50", () => {
    expect(cookingLogListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(cookingLogListQuerySchema.parse({ pageSize: "100" }).pageSize).toBe(50);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd airecipe-backend && pnpm test src/lib/validation.cooking-log.test.ts`
Expected: FAIL — 스키마 미존재.

- [ ] **Step 3: 스키마 구현**

`src/lib/validation.ts`에 추가(상단에 `generatedRecipeSchema` 가 이미 import 되어 있음 — 기존 `saveRecipeRequestSchema`가 사용 중):
```ts
export const createCookingLogRequestSchema = z.object({
  image: z
    .string()
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "이미지 형식이 올바르지 않습니다."),
  mimeType: z.string().regex(/^image\//, "이미지 형식이 올바르지 않습니다."),
  recipe: generatedRecipeSchema,
  sourceRecipeId: z.string().uuid().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  review: z.string().trim().min(1, "소감을 입력해 주세요.").max(1000),
});

export const cookingLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform((n) => Math.min(n, 50)),
});
```

- [ ] **Step 4: 통과 확인**

Run: `cd airecipe-backend && pnpm test src/lib/validation.cooking-log.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add airecipe-backend/src/lib/validation.ts airecipe-backend/src/lib/validation.cooking-log.test.ts
git commit -m "feat(backend): cooking-log 요청/쿼리 검증 스키마 (TDD)"
```

---

## Task B4: R2 스토리지 어댑터 (StoragePort + R2 구현)

R2 접근을 단일 모듈로 캡슐화. 키 빌더는 순수 함수라 TDD, S3 호출부는 typecheck로 검증.

**Files:**
- Create: `src/lib/storage/storage-port.ts`
- Create: `src/lib/storage/r2-storage.ts`
- Test: `src/lib/storage/r2-key.test.ts`

- [ ] **Step 1: StoragePort 인터페이스 작성**

Create `src/lib/storage/storage-port.ts`:
```ts
/** 객체 스토리지 추상 — 향후 공급자 교체·테스트 용이(DIP). */
export interface StoragePort {
  /** base64 data URI를 업로드하고 저장된 객체 키를 반환. */
  upload(params: {
    userId: string;
    logId: string;
    dataUri: string;
    mimeType: string;
  }): Promise<string>; // returns objectKey (= photo_path)

  /** 객체 키에 대한 presigned GET URL 발급(만료 있음). */
  getSignedUrl(objectKey: string): Promise<string>;

  /** 객체 삭제(없어도 에러 아님 — 멱등). */
  remove(objectKey: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/** "data:image/jpeg;base64,XXXX" → { buffer, ext }. 파싱 실패 시 StorageError. */
export function decodeDataUri(dataUri: string): { buffer: Buffer; ext: string } {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUri);
  if (!match) {
    throw new StorageError("이미지 데이터를 해석할 수 없습니다.");
  }
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  return { buffer: Buffer.from(match[2], "base64"), ext };
}

/** 객체 키 규칙: {userId}/{logId}.{ext} */
export function buildObjectKey(userId: string, logId: string, ext: string): string {
  return `${userId}/${logId}.${ext}`;
}
```

- [ ] **Step 2: 실패하는 키/디코드 테스트 작성**

Create `src/lib/storage/r2-key.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildObjectKey, decodeDataUri, StorageError } from "./storage-port";

describe("buildObjectKey", () => {
  it("{userId}/{logId}.{ext} 형식", () => {
    expect(buildObjectKey("u1", "l1", "jpg")).toBe("u1/l1.jpg");
  });
});

describe("decodeDataUri", () => {
  it("jpeg data URI 를 buffer+ext(jpg) 로 디코드", () => {
    const { buffer, ext } = decodeDataUri("data:image/jpeg;base64,QUJD"); // "ABC"
    expect(ext).toBe("jpg");
    expect(buffer.toString("utf8")).toBe("ABC");
  });
  it("png 는 ext png", () => {
    expect(decodeDataUri("data:image/png;base64,QQ==").ext).toBe("png");
  });
  it("형식 불일치는 StorageError", () => {
    expect(() => decodeDataUri("http://x")).toThrow(StorageError);
  });
});
```

- [ ] **Step 2b: 실패 확인**

Run: `cd airecipe-backend && pnpm test src/lib/storage/r2-key.test.ts`
Expected: FAIL — 모듈 미존재(아직 storage-port.ts 만 있고 import 경로 확인).
> Step 1에서 storage-port.ts를 만들었으면 이 테스트는 바로 PASS할 수 있다. 그 경우 Step 3로 진행.

- [ ] **Step 3: R2(S3) 구현 작성 + aws-sdk 설치**

Run:
```bash
cd airecipe-backend && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Create `src/lib/storage/r2-storage.ts`:
```ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  type StoragePort,
  StorageError,
  decodeDataUri,
  buildObjectKey,
} from "./storage-port";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

function readR2Env() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new StorageError(
      "R2 환경변수가 설정되지 않았습니다 (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET).",
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

let _client: S3Client | null = null;
let _bucket = "";

function client(): { s3: S3Client; bucket: string } {
  if (_client) return { s3: _client, bucket: _bucket };
  const env = readR2Env();
  _bucket = env.bucket;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
  return { s3: _client, bucket: _bucket };
}

export const r2Storage: StoragePort = {
  async upload({ userId, logId, dataUri, mimeType }) {
    const { s3, bucket } = client();
    const { buffer, ext } = decodeDataUri(dataUri);
    const key = buildObjectKey(userId, logId, ext);
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
    } catch (err) {
      throw new StorageError("이미지 업로드에 실패했습니다.", err);
    }
    return key;
  },

  async getSignedUrl(objectKey) {
    const { s3, bucket } = client();
    try {
      return await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      );
    } catch (err) {
      throw new StorageError("이미지 URL 발급에 실패했습니다.", err);
    }
  },

  async remove(objectKey) {
    const { s3, bucket } = client();
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    } catch {
      // 멱등: 삭제 실패는 무시(객체 부재 등)
    }
  },
};
```

- [ ] **Step 4: 테스트 + 타입 확인**

Run: `cd airecipe-backend && pnpm test src/lib/storage/r2-key.test.ts`
Expected: PASS.

Run: `cd airecipe-backend && pnpm typecheck`
Expected: 타입 통과(aws-sdk 타입 포함).

- [ ] **Step 5: Commit**
```bash
git add airecipe-backend/src/lib/storage airecipe-backend/package.json airecipe-backend/pnpm-lock.yaml
git commit -m "feat(backend): R2 스토리지 어댑터(StoragePort + S3 구현) (TDD: 키/디코드)"
```

---

## Task B5: 리포지토리 (인터페이스 + Supabase 구현)

**Files:**
- Create: `src/repositories/cooking-log.repository.ts`
- Create: `src/repositories/supabase-cooking-log.repository.ts`

- [ ] **Step 1: 리포지토리 인터페이스 작성**

Create `src/repositories/cooking-log.repository.ts`:
```ts
import type { CookingLogRow } from "@/mappers/cooking-log-mapper";

export interface CookingLogListOptions {
  page: number;
  pageSize: number;
}

export interface CookingLogListResult {
  rows: CookingLogRow[];
  total: number;
}

export interface CookingLogRepository {
  /** 소유자 기록 목록(역순) + 총 개수. */
  listByUser(userId: string, options: CookingLogListOptions): Promise<CookingLogListResult>;
  /** insert row 생성 → 저장된 row 반환. */
  create(row: Omit<CookingLogRow, "id" | "created_at">): Promise<CookingLogRow>;
  /** 단건 조회(소유자 스코프). 없으면 null. */
  findById(userId: string, id: string): Promise<CookingLogRow | null>;
  /** 삭제(소유자 스코프). 삭제된 row 없으면 null, 있으면 삭제된 row(키 회수용). */
  delete(userId: string, id: string): Promise<CookingLogRow | null>;
}

export { RepositoryError } from "./recipe.repository";
```

- [ ] **Step 2: Supabase 구현 작성**

Create `src/repositories/supabase-cooking-log.repository.ts` (recipe 리포지토리 쿼리 스타일을 그대로 미러):
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CookingLogRow } from "@/mappers/cooking-log-mapper";
import {
  type CookingLogRepository,
  type CookingLogListOptions,
  type CookingLogListResult,
  RepositoryError,
} from "./cooking-log.repository";

const TABLE = "cooking_logs";

export class SupabaseCookingLogRepository implements CookingLogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByUser(
    userId: string,
    options: CookingLogListOptions,
  ): Promise<CookingLogListResult> {
    const from = (options.page - 1) * options.pageSize;
    const to = from + options.pageSize - 1;
    const { data, error, count } = await this.db
      .from(TABLE)
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      throw new RepositoryError("기록 목록 조회에 실패했습니다.", error);
    }
    return { rows: (data as CookingLogRow[]) ?? [], total: count ?? 0 };
  }

  async create(
    row: Omit<CookingLogRow, "id" | "created_at">,
  ): Promise<CookingLogRow> {
    const { data, error } = await this.db
      .from(TABLE)
      .insert(row)
      .select("*")
      .single();
    if (error || !data) {
      throw new RepositoryError("기록 저장에 실패했습니다.", error);
    }
    return data as CookingLogRow;
  }

  async findById(userId: string, id: string): Promise<CookingLogRow | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new RepositoryError("기록 조회에 실패했습니다.", error);
    }
    return (data as CookingLogRow | null) ?? null;
  }

  async delete(userId: string, id: string): Promise<CookingLogRow | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new RepositoryError("기록 삭제에 실패했습니다.", error);
    }
    return (data as CookingLogRow | null) ?? null;
  }
}
```

- [ ] **Step 3: 타입 확인**

Run: `cd airecipe-backend && pnpm typecheck`
Expected: 통과.

- [ ] **Step 4: Commit**
```bash
git add airecipe-backend/src/repositories/cooking-log.repository.ts airecipe-backend/src/repositories/supabase-cooking-log.repository.ts
git commit -m "feat(backend): cooking-log 리포지토리(인터페이스 + Supabase 구현)"
```

---

## Task B6: 서비스 (CookingLogService — TDD)

업로드/행/presign 조율 + 소유 격리 404 정규화. 스토리지·리포지토리를 모킹해 단위 테스트.

**Files:**
- Create: `src/services/cooking-log.service.ts`
- Test: `src/services/cooking-log.service.test.ts`

- [ ] **Step 1: 실패하는 서비스 테스트 작성**

Create `src/services/cooking-log.service.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { CookingLogService } from "./cooking-log.service";
import { ServiceError } from "./service-error";
import type { CookingLogRow } from "@/mappers/cooking-log-mapper";
import type { CreateCookingLogInput } from "@/types/cooking-log";

const recipe = {
  dishName: "김치찌개", description: "d", servings: 2, cookTimeMinutes: 30,
  difficulty: "easy" as const,
  ingredients: [{ name: "김치", quantity: 200, unit: "g" }],
  steps: [{ order: 1, instruction: "끓인다" }], tips: [],
  nutrition: { calories: 1, carbohydrates: 1, protein: 1, fat: 1, fiber: 1, healthNote: "n" },
};
const input: CreateCookingLogInput = {
  image: "data:image/jpeg;base64,QUJD", mimeType: "image/jpeg",
  recipe, sourceRecipeId: null, rating: 5, review: "맛",
};
const savedRow: CookingLogRow = {
  id: "id-1", user_id: "u-1", photo_path: "u-1/id-1.jpg",
  recipe, source_recipe_id: null, rating: 5, review: "맛",
  created_at: "2026-06-03T00:00:00.000Z",
};

function makeDeps() {
  const storage = {
    upload: vi.fn().mockResolvedValue("u-1/id-1.jpg"),
    getSignedUrl: vi.fn().mockResolvedValue("https://signed/x"),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const repo = {
    listByUser: vi.fn(),
    create: vi.fn().mockResolvedValue(savedRow),
    findById: vi.fn(),
    delete: vi.fn(),
  };
  return { storage, repo };
}

describe("CookingLogService.create", () => {
  it("이미지 업로드 → 행 생성 → presigned URL 주입한 도메인 반환", async () => {
    const { storage, repo } = makeDeps();
    const svc = new CookingLogService(repo as never, storage as never);
    const result = await svc.create("u-1", input);
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(repo.create).toHaveBeenCalledOnce();
    expect(result.photoUrl).toBe("https://signed/x");
    expect(result.id).toBe("id-1");
    expect(result.rating).toBe(5);
  });
});

describe("CookingLogService.get", () => {
  it("미존재 시 NOT_FOUND ServiceError", async () => {
    const { storage, repo } = makeDeps();
    repo.findById.mockResolvedValue(null);
    const svc = new CookingLogService(repo as never, storage as never);
    await expect(svc.get("u-1", "missing")).rejects.toBeInstanceOf(ServiceError);
  });
});

describe("CookingLogService.delete", () => {
  it("행 삭제 후 스토리지 객체도 제거", async () => {
    const { storage, repo } = makeDeps();
    repo.delete.mockResolvedValue(savedRow);
    const svc = new CookingLogService(repo as never, storage as never);
    await svc.delete("u-1", "id-1");
    expect(storage.remove).toHaveBeenCalledWith("u-1/id-1.jpg");
  });
  it("삭제할 행 없으면 NOT_FOUND", async () => {
    const { storage, repo } = makeDeps();
    repo.delete.mockResolvedValue(null);
    const svc = new CookingLogService(repo as never, storage as never);
    await expect(svc.delete("u-1", "x")).rejects.toBeInstanceOf(ServiceError);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd airecipe-backend && pnpm test src/services/cooking-log.service.test.ts`
Expected: FAIL — `CookingLogService` 미존재.

- [ ] **Step 3: 서비스 구현**

Create `src/services/cooking-log.service.ts`:
```ts
import type { CookingLogRepository } from "@/repositories/cooking-log.repository";
import type { StoragePort } from "@/lib/storage/storage-port";
import { rowToCookingLog, inputToInsertRow } from "@/mappers/cooking-log-mapper";
import type { CookingLog, CreateCookingLogInput } from "@/types/cooking-log";
import { ServiceError } from "./service-error";

export class CookingLogService {
  constructor(
    private readonly repo: CookingLogRepository,
    private readonly storage: StoragePort,
  ) {}

  async create(userId: string, input: CreateCookingLogInput): Promise<CookingLog> {
    // logId를 미리 만들지 않고: 업로드는 임시 키가 아니라 안정 키가 필요하므로
    // crypto.randomUUID()로 logId를 선발급하고 같은 값을 행 id로 사용한다.
    const logId = crypto.randomUUID();
    const objectKey = await this.storage.upload({
      userId,
      logId,
      dataUri: input.image,
      mimeType: input.mimeType,
    });
    const row = await this.repo.create({
      ...inputToInsertRow(input, userId, objectKey),
      // create()는 id/created_at 제외 Omit이지만 안정 id 사용을 위해 확장
      id: logId,
    } as never);
    const photoUrl = await this.storage.getSignedUrl(row.photo_path);
    return rowToCookingLog(row, photoUrl);
  }

  async list(
    userId: string,
    options: { page: number; pageSize: number },
  ): Promise<{ logs: CookingLog[]; total: number }> {
    const { rows, total } = await this.repo.listByUser(userId, options);
    const logs = await Promise.all(
      rows.map(async (row) =>
        rowToCookingLog(row, await this.storage.getSignedUrl(row.photo_path)),
      ),
    );
    return { logs, total };
  }

  async get(userId: string, id: string): Promise<CookingLog> {
    const row = await this.repo.findById(userId, id);
    if (!row) {
      throw new ServiceError("NOT_FOUND", "기록을 찾을 수 없습니다.");
    }
    const photoUrl = await this.storage.getSignedUrl(row.photo_path);
    return rowToCookingLog(row, photoUrl);
  }

  async delete(userId: string, id: string): Promise<{ id: string }> {
    const row = await this.repo.delete(userId, id);
    if (!row) {
      throw new ServiceError("NOT_FOUND", "기록을 찾을 수 없습니다.");
    }
    await this.storage.remove(row.photo_path);
    return { id: row.id };
  }
}
```

> **참고(id 선발급):** `repo.create`의 시그니처는 `Omit<CookingLogRow, "id"|"created_at">`이다. 안정적 객체 키(`{userId}/{logId}.jpg`)와 행 id를 일치시키기 위해 서비스에서 `crypto.randomUUID()`로 선발급한다. 이를 위해 **Task B5의 `create()` 시그니처를 `id`를 선택적으로 받도록** 조정한다(다음 스텝). DB 기본값 `gen_random_uuid()`는 id 미전달 시 폴백.

- [ ] **Step 3b: repo.create가 id를 받도록 조정**

`src/repositories/cooking-log.repository.ts`의 `create` 시그니처를 변경:
```ts
  /** insert row 생성(id 선택적, 미전달 시 DB 기본값) → 저장된 row 반환. */
  create(
    row: Omit<CookingLogRow, "id" | "created_at"> & { id?: string },
  ): Promise<CookingLogRow>;
```
`supabase-cooking-log.repository.ts`의 `create` 파라미터 타입도 동일하게 맞추고, 본문은 그대로(`insert(row)`가 id 포함/미포함 모두 처리). 서비스의 `as never` 캐스트는 제거하고 `{ ...inputToInsertRow(...), id: logId }` 를 그대로 전달.

- [ ] **Step 4: 통과 확인**

Run: `cd airecipe-backend && pnpm test src/services/cooking-log.service.test.ts`
Expected: PASS.

Run: `cd airecipe-backend && pnpm typecheck`
Expected: 통과.

- [ ] **Step 5: Commit**
```bash
git add airecipe-backend/src/services/cooking-log.service.ts airecipe-backend/src/services/cooking-log.service.test.ts airecipe-backend/src/repositories/cooking-log.repository.ts airecipe-backend/src/repositories/supabase-cooking-log.repository.ts
git commit -m "feat(backend): CookingLogService(업로드+행+presign 조율) (TDD)"
```

---

## Task B7: Composition 루트 배선

**Files:**
- Modify: `src/lib/composition.ts`

- [ ] **Step 1: 서비스 팩토리 추가**

`src/lib/composition.ts`에 추가(`getRecipeService`와 동일한 client 선택 패턴):
```ts
import { CookingLogService } from "@/services/cooking-log.service";
import { SupabaseCookingLogRepository } from "@/repositories/supabase-cooking-log.repository";
import { r2Storage } from "@/lib/storage/r2-storage";

export async function getCookingLogService(
  source: AuthSource = "cookie",
): Promise<CookingLogService> {
  const supabase =
    source === "header"
      ? createSupabaseServiceRoleClient()
      : await createSupabaseServerClient();
  return new CookingLogService(
    new SupabaseCookingLogRepository(supabase),
    r2Storage,
  );
}
```
> 기존 import(`createSupabaseServiceRoleClient`/`createSupabaseServerClient`/`AuthSource`)는 이미 파일에 있다. 누락 시 상단 import에 추가.

- [ ] **Step 2: 타입 확인**

Run: `cd airecipe-backend && pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: Commit**
```bash
git add airecipe-backend/src/lib/composition.ts
git commit -m "feat(backend): getCookingLogService 배선"
```

---

## Task B8: 라우트 — POST/GET `/api/cooking-logs`

**Files:**
- Create: `src/app/api/cooking-logs/route.ts`

- [ ] **Step 1: 라우트 작성** (recipes/route.ts 패턴을 정확히 미러)

Create `src/app/api/cooking-logs/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getCookingLogService } from "@/lib/composition";
import { ok, okList, failFromError } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";
import {
  createCookingLogRequestSchema,
  cookingLogListQuerySchema,
  parseOrThrow,
} from "@/lib/validation";
import { ServiceError } from "@/services/service-error";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const query = parseOrThrow(cookingLogListQuerySchema, {
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    const service = await getCookingLogService(source);
    const { logs, total } = await service.list(internalUserId, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return withCors(
      okList(logs, { total, page: query.page, pageSize: query.pageSize }),
      request,
    );
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다.");
    }
    const input = parseOrThrow(createCookingLogRequestSchema, body);
    const service = await getCookingLogService(source);
    const created = await service.create(internalUserId, input);
    return withCors(ok(created, 201), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

export const OPTIONS = corsPreflightResponse;
```

- [ ] **Step 2: 타입/린트 확인**

Run: `cd airecipe-backend && pnpm typecheck && pnpm lint`
Expected: 통과(에러 0).

- [ ] **Step 3: Commit**
```bash
git add airecipe-backend/src/app/api/cooking-logs/route.ts
git commit -m "feat(backend): POST/GET /api/cooking-logs 라우트"
```

---

## Task B9: 라우트 — GET/DELETE `/api/cooking-logs/[id]`

**Files:**
- Create: `src/app/api/cooking-logs/[id]/route.ts`

- [ ] **Step 1: 라우트 작성** (recipes/[id]/route.ts 패턴 미러 — Next.js 16 params Promise)

Create `src/app/api/cooking-logs/[id]/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getCookingLogService } from "@/lib/composition";
import { ok, failFromError } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { id: internalUserId, source } = await requireUser(request);
    const service = await getCookingLogService(source);
    const log = await service.get(internalUserId, id);
    return withCors(ok(log), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { id: internalUserId, source } = await requireUser(request);
    const service = await getCookingLogService(source);
    const result = await service.delete(internalUserId, id);
    return withCors(ok(result), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

export const OPTIONS = corsPreflightResponse;
```
> **검증 포인트:** `recipes/[id]/route.ts`의 실제 `params` 시그니처(Promise vs 객체)를 열어 확인하고 정확히 일치시킨다. Next.js 16은 `params`가 Promise다.

- [ ] **Step 2: 타입/린트 확인**

Run: `cd airecipe-backend && pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 3: Commit**
```bash
git add airecipe-backend/src/app/api/cooking-logs/\[id\]/route.ts
git commit -m "feat(backend): GET/DELETE /api/cooking-logs/[id] 라우트"
```

---

## Task B10: DB 마이그레이션 (cooking_logs + RLS)

**Files:**
- Create: `supabase/migrations/0003_create_cooking_logs.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성** (recipes 0001 패턴 + RLS 미러)

Create `supabase/migrations/0003_create_cooking_logs.sql`:
```sql
-- 요리 기록(cooking_logs). 소유자 격리는 recipes 와 동일(옵션 P):
--   RLS(쿠키 경로 auth.uid()) + 헤더 경로 service-role + .eq('user_id', ...) 필터.
create table if not exists public.cooking_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,                 -- profiles.internal_user_id 또는 auth.users.id
  photo_path       text not null,                 -- R2 객체 키 {user_id}/{id}.{ext}
  recipe           jsonb not null,                -- GeneratedRecipe 스냅샷(camelCase)
  source_recipe_id uuid,                           -- 원본 레시피 참고(생명주기 비결합)
  rating           int not null check (rating between 1 and 5),
  review           text not null,
  created_at       timestamptz not null default now()
);

create index if not exists cooking_logs_user_created_idx
  on public.cooking_logs(user_id, created_at desc);

alter table public.cooking_logs enable row level security;

drop policy if exists "owner_select" on public.cooking_logs;
drop policy if exists "owner_insert" on public.cooking_logs;
drop policy if exists "owner_delete" on public.cooking_logs;

create policy "owner_select" on public.cooking_logs
  for select using (auth.uid() = user_id);
create policy "owner_insert" on public.cooking_logs
  for insert with check (auth.uid() = user_id);
create policy "owner_delete" on public.cooking_logs
  for delete using (auth.uid() = user_id);
```
> update 정책은 본 단계 기능(수정 비범위)에 불필요해 생략.

- [ ] **Step 2: 집계 schema.sql 동기화**

`supabase/schema.sql` 말미에 위 `cooking_logs` 테이블+인덱스+RLS 블록을 동일하게 추가(파일이 전체 스키마의 SSOT라면 일관 유지).

- [ ] **Step 3: 로컬/원격 적용은 외부 작업(B11)에서 수행. 여기서는 SQL 문법만 자기검토.**

- [ ] **Step 4: Commit**
```bash
git add airecipe-backend/supabase/migrations/0003_create_cooking_logs.sql airecipe-backend/supabase/schema.sql
git commit -m "feat(backend): cooking_logs 마이그레이션 + RLS"
```

---

## Task B11: 환경변수·문서·외부 작업 체크리스트

**Files:**
- Modify: `.env.local.example`
- Create: `docs/adr/ADR-013-cooking-logs.md`
- Create: `docs/api/cooking-logs.md`

- [ ] **Step 1: .env.local.example 에 R2 키 추가**

`.env.local.example` 말미에:
```bash
# ----- Cloudflare R2 (cooking-logs 사진 저장) -----
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=cooking-photos
```

- [ ] **Step 2: ADR-013 작성** (기존 ADR 형식 따름 — 컨텍스트/결정/근거/대안)

Create `docs/adr/ADR-013-cooking-logs.md`: 핵심 결정 기록 —
스토리지 공급자 R2(S3 호환, 비공개+presigned), 업로드 백엔드 경유(base64), `cooking_logs` owner-scoped,
recipe 스냅샷(jsonb), id 선발급으로 객체키-행 일치, StoragePort 추상화. (스펙 §3 결정표 D1~D9 인용.)

- [ ] **Step 3: API 문서 작성**

Create `docs/api/cooking-logs.md`: 4 엔드포인트 요청/응답/에러/인증(`X-Toss-User-Id`)/CORS — 스펙 §6 내용을 백엔드 docs 형식(recipes.md 미러)으로.

- [ ] **Step 4: 외부 작업 체크리스트(코드 아님 — 수행/인계)**

`docs/api/cooking-logs.md` 말미 "PENDING(외부 작업)" 절:
- [ ] Cloudflare R2 버킷 `cooking-photos` 생성(비공개).
- [ ] R2 API 토큰 발급 → `R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET` 로컬·배포(Vercel) 주입.
- [ ] Supabase에 `0003_create_cooking_logs.sql` 적용(마이그레이션 또는 SQL 에디터).
- [ ] `APPSINTOSS_ALLOWED_ORIGINS`에 미니앱 origin 포함 확인(이미 있으면 무변경).
- [ ] CORS preflight(OPTIONS) + 실제 호출 검증.

- [ ] **Step 5: Commit**
```bash
git add airecipe-backend/.env.local.example airecipe-backend/docs/adr/ADR-013-cooking-logs.md airecipe-backend/docs/api/cooking-logs.md
git commit -m "docs(backend): ADR-013 + cooking-logs API 문서 + R2 env 예시"
```

---

## Task B12: 통합 스모크 검증(수동) + 계약 동기화

> 테스트 러너로는 외부 I/O(R2/Supabase)를 다 못 본다. 배포/로컬에서 실제 호출로 계약을 확인하고, 미니앱 SSOT 계약 문서를 갱신한다.

**Files:**
- Modify: `../airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md` (미니앱 SSOT 사본에 §추가)

- [ ] **Step 1: 로컬 스모크(외부 작업 완료 후)**

R2/Supabase env 주입 + 마이그레이션 적용 후, `pnpm dev` 상태에서:
```bash
# 생성 (작은 1x1 jpeg base64 사용)
curl -s -X POST http://localhost:3000/api/cooking-logs \
  -H 'Content-Type: application/json' -H 'X-Toss-User-Id: testhash12345678' \
  -d '{"image":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AvwA//9k=","mimeType":"image/jpeg","recipe":{"dishName":"테스트","description":"d","servings":2,"cookTimeMinutes":10,"difficulty":"easy","ingredients":[{"name":"a","quantity":1,"unit":"g"}],"steps":[{"order":1,"instruction":"x"}],"tips":[],"nutrition":{"calories":1,"carbohydrates":1,"protein":1,"fat":1,"fiber":1,"healthNote":"n"}},"rating":5,"review":"맛"}'
```
Expected: 201 + `{ data: { id, photoUrl(https://...r2...), recipe, rating:5, review, createdAt } }`. `photoUrl`을 브라우저로 열어 이미지 표시 확인.

```bash
curl -s 'http://localhost:3000/api/cooking-logs?page=1&pageSize=20' -H 'X-Toss-User-Id: testhash12345678'   # 목록
curl -s http://localhost:3000/api/cooking-logs/<ID> -H 'X-Toss-User-Id: testhash12345678'                    # 상세
curl -s -X DELETE http://localhost:3000/api/cooking-logs/<ID> -H 'X-Toss-User-Id: testhash12345678'          # 삭제
```
Expected: 각각 200 + 규약 shape. 삭제 후 목록에서 사라지고 R2 객체 제거.

- [ ] **Step 2: 미니앱 SSOT 계약 갱신**

`airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md`에 §(엔드포인트 8~11) 추가 — cooking-logs 4종의 요청/응답/에러/인증을 본 계획의 §6과 1:1 동기. (미니앱 Plan에서 api-client가 이 문서를 SSOT로 참조.)

- [ ] **Step 3: 최종 게이트**

Run: `cd airecipe-backend && pnpm test && pnpm typecheck && pnpm lint`
Expected: 테스트 PASS · 타입 통과 · 린트 0 에러.

- [ ] **Step 4: Commit**
```bash
git add airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md
git commit -m "docs(contract): 03-API-CONTRACT에 cooking-logs 4종 계약 추가(백엔드 정렬)"
```

---

## Self-Review (작성자 체크)

- **스펙 커버리지:** §5 데이터모델(B10) · §6.1 POST(B8) · §6.2 GET 목록(B8) · §6.3 상세(B9) · §6.4 삭제(B9) · §5.2/5.3 R2(B4,B11) · 응답 shape(B2 매퍼 + 라우트) · CORS(라우트 OPTIONS + 기존 withCors) — 모두 태스크 존재. ✅
- **플레이스홀더:** 코드 스텝은 실제 코드 포함. ADR/문서 태스크(B11 Step2/3)는 "무엇을 쓸지" 명시(스펙 인용) — 구현 시 스펙 §3/§6을 그대로 옮김. ✅
- **타입 일관성:** `CookingLogRow`(매퍼 정의) → 리포지토리/서비스 동일 사용. `rowToCookingLog(row, photoUrl)` 2-인자 시그니처 일관. `create(row & {id?})` 조정(B6 Step3b)으로 서비스의 id 선발급과 정합. ✅
- **id 선발급 주의:** B6에서 `crypto.randomUUID()` 사용 → `runtime="nodejs"`라 가용. 객체키와 행 id 일치 보장. ✅

## 실행 핸드오프

이 백엔드 계획 완료 후 → **미니앱 계획**(`2026-06-03-cooking-log-feed-miniapp.md`)으로. 미니앱은 본 계획이 확정한 `03-API-CONTRACT.md`의 cooking-logs 계약을 SSOT로 소비한다.
