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
