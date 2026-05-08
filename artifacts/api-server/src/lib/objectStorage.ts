import { Storage, File, GetSignedUrlConfig } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Use standard GCS credentials from env var or ADC (Application Default Credentials)
function createStorageClient(): Storage {
  // If GOOGLE_APPLICATION_CREDENTIALS or GCS_SERVICE_ACCOUNT_KEY is set, use it
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.GCS_SERVICE_ACCOUNT_KEY;

  if (keyJson) {
    return new Storage({
      credentials: JSON.parse(keyJson),
      projectId: process.env.GCS_PROJECT_ID || "",
    });
  }

  // Fallback to default (ADC, workload identity, etc.)
  return new Storage({
    projectId: process.env.GCS_PROJECT_ID || "",
    ...(keyFile ? { keyFilename: keyFile } : {}),
  });
}

export const objectStorageClient = createStorageClient();

export const BUCKET_NAME = process.env.GCS_BUCKET_NAME || "";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getBucket(): Storage {
    return objectStorageClient;
  }

  getBucketName(): string {
    if (!BUCKET_NAME) {
      throw new Error(
        "GCS_BUCKET_NAME not set. Set the GCS bucket name environment variable."
      );
    }
    return BUCKET_NAME;
  }

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || BUCKET_NAME;
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Set GCS_BUCKET_NAME or PUBLIC_OBJECT_SEARCH_PATHS env var."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || BUCKET_NAME;
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Set GCS_BUCKET_NAME or PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    const bucket = objectStorageClient.bucket(this.getBucketName());
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    return exists ? file : null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const bucketName = this.getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const objectId = randomUUID();
    const file = bucket.file(`uploads/${objectId}`);

    const expiresAt = Date.now() + 900_000; // 15 minutes

    const config: GetSignedUrlConfig = {
      version: "v4",
      action: "write",
      expires: expiresAt,
      contentType: "application/octet-stream",
    };

    const [signedUrl] = await file.getSignedUrl(config);
    return signedUrl;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    const bucket = objectStorageClient.bucket(this.getBucketName());
    const objectFile = bucket.file(entityId);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    // Extract the path after bucket name
    const parts = rawObjectPath.split("/").filter(Boolean);
    if (parts.length < 2) return rawObjectPath;
    const entityId = parts.slice(1).join("/");
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
