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
