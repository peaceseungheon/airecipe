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
    row: Omit<CookingLogRow, "id" | "created_at"> & { id?: string },
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
