import { PutObjectCommand } from "@aws-sdk/client-s3";
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

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_UPLOAD_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(expected && received && expected === received);
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const bucket = process.env.R2_BUCKET_NAME?.trim();

    if (!bucket) {
      return NextResponse.json({ error: "R2_BUCKET_NAME is not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Media file is required." }, { status: 400 });
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: "Unsupported media type." }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const body = Buffer.from(await file.arrayBuffer());

    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type,
      }),
    );

    return NextResponse.json({
      key,
      publicUrl: getPublicImageUrl(key),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not upload media file.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
