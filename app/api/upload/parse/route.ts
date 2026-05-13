/**
 * POST /api/upload/parse
 *
 * Accepts a multipart upload (single field named `file`) — Excel, CSV or
 * JSON — and returns a structured summary the UploadStudio can render.
 * Falls back to a JSON body with `{ filename }` for the packaged samples
 * (which only exist locally on disk under data/fta-aggregates/files/).
 */
import { NextResponse, type NextRequest } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseBufferToFile } from "@/lib/upload/parse-fta-excel";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB cap — FTA xlsx files are tiny

export async function POST(req: NextRequest) {
  const ctype = req.headers.get("content-type") ?? "";

  // Multipart — real upload from the browser
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "missing 'file' field" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `file too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
        { status: 413 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const parsed = parseBufferToFile(buf, file.name);
      return NextResponse.json({ success: true, parsed });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: (e as Error).message },
        { status: 500 },
      );
    }
  }

  // JSON body — packaged sample by filename (local-only path)
  try {
    const body = (await req.json()) as { filename?: string };
    if (!body.filename) {
      return NextResponse.json(
        { success: false, error: "expected { filename } for sample lookup" },
        { status: 400 },
      );
    }
    // Sanitise — only allow basenames, no traversal
    const safe = body.filename.replace(/[/\\]/g, "");
    const candidate = join(process.cwd(), "data", "fta-aggregates", "files", safe);
    try {
      await stat(candidate);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `sample not available on this deployment (file '${safe}' not found on server). Upload it manually instead.`,
        },
        { status: 404 },
      );
    }
    const buf = await readFile(candidate);
    const parsed = parseBufferToFile(buf, safe);
    return NextResponse.json({ success: true, parsed });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
