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
  /** insert row 생성(id 선택적, 미전달 시 DB 기본값) → 저장된 row 반환. */
  create(
    row: Omit<CookingLogRow, "id" | "created_at"> & { id?: string },
  ): Promise<CookingLogRow>;
  /** 단건 조회(소유자 스코프). 없으면 null. */
  findById(userId: string, id: string): Promise<CookingLogRow | null>;
  /** 삭제(소유자 스코프). 삭제된 row 없으면 null, 있으면 삭제된 row(키 회수용). */
  delete(userId: string, id: string): Promise<CookingLogRow | null>;
}

export { RepositoryError } from "./recipe.repository";
