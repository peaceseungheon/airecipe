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
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUri);
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
