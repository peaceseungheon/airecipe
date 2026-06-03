import type { CookingLogRepository } from "@/repositories/cooking-log.repository";
import type { StoragePort } from "@/lib/storage/storage-port";
import { rowToCookingLog, inputToInsertRow } from "@/mappers/cooking-log-mapper";
import type { CookingLog, CreateCookingLogInput } from "@/types/cooking-log";
import { ServiceError } from "./service-error";

/**
 * 요리 기록 서비스 — R2 업로드 + 행 영속화 + presign 조율(소유자 격리 404 정규화).
 * Storage/Repository 추상에만 의존(DIP). 객체 키-행 id 일치를 위해 id 를 선발급한다.
 */
export class CookingLogService {
  constructor(
    private readonly repo: CookingLogRepository,
    private readonly storage: StoragePort,
  ) {}

  async create(userId: string, input: CreateCookingLogInput): Promise<CookingLog> {
    // 안정적 객체 키({userId}/{logId}.{ext})와 행 id 를 일치시키기 위해 id 를 선발급한다.
    // runtime="nodejs" 라 crypto.randomUUID() 가용. DB 기본값 gen_random_uuid() 는 폴백.
    const logId = crypto.randomUUID();
    const objectKey = await this.storage.upload({
      userId,
      logId,
      dataUri: input.image,
      mimeType: input.mimeType,
    });
    const row = await this.repo.create({
      ...inputToInsertRow(input, userId, objectKey),
      id: logId,
    });
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
