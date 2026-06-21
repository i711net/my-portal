import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getPublicImageUrl, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";

const R2_FREE_TIER_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;

type ListedR2Object = {
  Key?: string;
  Size?: number;
  LastModified?: Date;
};

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_UPLOAD_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(expected && received && expected === received);
}

function isDeleteAuthorized(request: Request, deleteToken: string) {
  const expected = (process.env.ADMIN_DELETE_TOKEN || process.env.ADMIN_UPLOAD_TOKEN)?.trim();
  const received = deleteToken || request.headers.get("x-delete-token")?.trim();

  return Boolean(expected && received && expected === received);
}

function getMediaType(key: string) {
  const lower = key.toLowerCase();

  if (/\.(mp4|webm)$/.test(lower)) {
    return "video";
  }

  if (/\.(mp3|mpeg|wav|ogg|oga|webm)$/.test(lower)) {
    return "audio";
  }

  return "image";
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const bucket = process.env.R2_BUCKET_NAME?.trim();

    if (!bucket) {
      return NextResponse.json({ error: "R2_BUCKET_NAME is not configured" }, { status: 500 });
    }

    const client = getR2Client();
    let continuationToken: string | undefined;
    const allObjects: ListedR2Object[] = [];

    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: "uploads/",
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        }),
      );

      allObjects.push(...(response.Contents ?? []));
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    const totalSizeBytes = allObjects.reduce((sum, item) => sum + (item.Size ?? 0), 0);
    const media = allObjects
      .filter((item) => item.Key)
      .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
      .slice(0, 80)
      .map((item) => {
        const key = item.Key!;

        return {
          key,
          url: getPublicImageUrl(key),
          type: getMediaType(key),
          size: item.Size ?? 0,
          uploadedAt: item.LastModified?.toISOString() ?? null,
          name: key.split("/").pop() ?? key,
        };
      });

    return NextResponse.json({
      media,
      storage: {
        objectCount: allObjects.filter((item) => item.Key).length,
        totalSizeBytes,
        freeTierBytes: R2_FREE_TIER_STORAGE_BYTES,
        remainingFreeTierBytes: Math.max(0, R2_FREE_TIER_STORAGE_BYTES - totalSizeBytes),
        usagePercent: Math.min(100, (totalSizeBytes / R2_FREE_TIER_STORAGE_BYTES) * 100),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not load media library.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      key?: string;
      deleteToken?: string;
    };
    const key = String(body.key || "").trim();

    if (!key || !key.startsWith("uploads/") || key.includes("..")) {
      return NextResponse.json({ error: "Media key is invalid." }, { status: 400 });
    }

    if (!isDeleteAuthorized(request, String(body.deleteToken || "").trim())) {
      return NextResponse.json({ error: "Delete password is missing or incorrect." }, { status: 403 });
    }

    const bucket = process.env.R2_BUCKET_NAME?.trim();

    if (!bucket) {
      return NextResponse.json({ error: "R2_BUCKET_NAME is not configured" }, { status: 500 });
    }

    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return NextResponse.json({ deleted: true, key });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not delete media file.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
