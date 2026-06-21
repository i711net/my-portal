import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getPublicImageUrl, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
]);

export async function POST(request: Request) {
  try {
    const uploadToken = process.env.ADMIN_UPLOAD_TOKEN?.trim();
    const authHeader = request.headers.get("authorization");

    if (uploadToken && authHeader !== `Bearer ${uploadToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      filename?: string;
      contentType?: string;
    };

    if (!body.filename || !body.contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 });
    }

    if (!allowedTypes.has(body.contentType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const bucket = process.env.R2_BUCKET_NAME?.trim();

    if (!bucket) {
      return NextResponse.json({ error: "R2_BUCKET_NAME is not configured" }, { status: 500 });
    }

    const extension = body.filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: body.contentType,
    });

    const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 60 * 5 });

    return NextResponse.json({
      key,
      uploadUrl,
      publicUrl: getPublicImageUrl(key),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upload URL error";

    return NextResponse.json(
      {
        error: "Could not create R2 upload URL",
        detail: message,
      },
      { status: 500 },
    );
  }
}
