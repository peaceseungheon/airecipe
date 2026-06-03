import { describe, expect, it } from '@jest/globals';

import {
  cookingLogSchema,
  createCookingLogRequestSchema,
} from './cooking-log';

const recipe = {
  dishName: '김치찌개',
  description: 'd',
  servings: 2,
  cookTimeMinutes: 30,
  difficulty: 'easy',
  ingredients: [{ name: '김치', quantity: 200, unit: 'g' }],
  steps: [{ order: 1, instruction: '끓인다' }],
  tips: [],
  nutrition: {
    calories: 1,
    carbohydrates: 1,
    protein: 1,
    fat: 1,
    fiber: 1,
    healthNote: 'n',
  },
};

describe('cookingLogSchema', () => {
  it('정상 응답을 파싱한다', () => {
    const ok = cookingLogSchema.parse({
      id: 'x',
      photoUrl: 'https://s/x',
      recipe,
      rating: 5,
      review: '맛',
      createdAt: '2026-06-03T00:00:00.000Z',
    });
    expect(ok.rating).toBe(5);
  });

  it('rating 범위를 벗어나면 거부', () => {
    expect(() =>
      cookingLogSchema.parse({
        id: 'x',
        photoUrl: 'https://s/x',
        recipe,
        rating: 9,
        review: '맛',
        createdAt: 'x',
      }),
    ).toThrow();
  });
});

describe('createCookingLogRequestSchema', () => {
  it('요청 형식을 검증한다', () => {
    const ok = createCookingLogRequestSchema.parse({
      image: 'data:image/jpeg;base64,AAA',
      mimeType: 'image/jpeg',
      recipe,
      sourceRecipeId: null,
      rating: 4,
      review: '좋아요',
    });
    expect(ok.review).toBe('좋아요');
  });

  it('빈 review는 거부', () => {
    expect(() =>
      createCookingLogRequestSchema.parse({
        image: 'data:image/jpeg;base64,AAA',
        mimeType: 'image/jpeg',
        recipe,
        rating: 4,
        review: '   ',
      }),
    ).toThrow();
  });
});
