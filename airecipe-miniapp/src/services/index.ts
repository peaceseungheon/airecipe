export { apiFetch, ApiClientError } from './api-client';
export type { ApiFetchInit } from './api-client';
export {
  generateRecipe,
  generateRecipeStream,
  listRecipes,
  getRecipe,
  saveRecipe,
  toggleFavorite,
  deleteRecipe,
  getRecommendations,
} from './recipes';
export type {
  AuthedCallOptions,
  GenerateOptions,
  RecommendationsCallOptions,
} from './recipes';
export { streamRecipe } from './sse-client';
export type { StreamRecipeOptions } from './sse-client';
export {
  createCookingLog,
  listCookingLogs,
  getCookingLog,
  deleteCookingLog,
} from './cooking-logs';
