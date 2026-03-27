import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { uploadBufferToTransloadit } from "@/lib/transloadit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = (form.get("filename") as string) || "upload.bin";
  const type = file.type || "application/octet-stream";

  try {
    const url = await uploadBufferToTransloadit(buf, name, type);
    return NextResponse.json({ url, contentType: type });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }
}
