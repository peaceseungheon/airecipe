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
