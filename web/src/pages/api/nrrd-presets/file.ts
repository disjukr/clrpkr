import { readFile } from "node:fs/promises";
import path from "node:path";

type ApiRequest = {
  readonly query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status(code: number): ApiResponse;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
  end(data?: Uint8Array | string): void;
};

const NRRD_ROOT = path.resolve(process.cwd(), "../icc2sdf/baked");

function normalizeRelativePath(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/\\/g, "/");
  if (!/\.nrrd$/i.test(normalized)) {
    return null;
  }
  if (normalized.startsWith("/") || normalized.includes("../")) {
    return null;
  }
  return normalized;
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const relativePath = normalizeRelativePath(req.query?.path);
  if (!relativePath) {
    res.status(400).json({ error: "Invalid NRRD preset path" });
    return;
  }

  const absolutePath = path.resolve(NRRD_ROOT, relativePath);
  if (!absolutePath.startsWith(NRRD_ROOT)) {
    res.status(400).json({ error: "Invalid NRRD preset path" });
    return;
  }

  try {
    const bytes = await readFile(absolutePath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(new Uint8Array(bytes));
  } catch {
    res.status(404).json({ error: "Preset not found" });
  }
}
