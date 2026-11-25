import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { BlobStore } from "./types";

// The provider only ever receives ciphertext: EncryptedStore wraps this class.
export class S3Store implements BlobStore {
  private c = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  private bucket = process.env.S3_BUCKET!;

  async put(key: string, data: Buffer) {
    await this.c.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: "application/octet-stream",
      }),
    );
  }
  async get(key: string) {
    try {
      const r = await this.c.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return Buffer.from(await r.Body!.transformToByteArray());
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey")
        throw Object.assign(new Error("not found"), { code: "ENOENT" });
      throw e;
    }
  }
  async delete(key: string) {
    await this.c.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
