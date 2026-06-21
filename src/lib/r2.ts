import { S3Client } from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;

export function getR2Client() {
  if (!cachedClient) {
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("Missing Cloudflare R2 environment variables.");
    }

    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return cachedClient;
}

export function getPublicImageUrl(key: string) {
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();

  if (!publicUrl) {
    return null;
  }

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}
