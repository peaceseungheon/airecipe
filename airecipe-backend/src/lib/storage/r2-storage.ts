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
