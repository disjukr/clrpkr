import { readFile } from "node:fs/promises";
import path from "node:path";

type ApiResponse = {
  status(code: number): ApiResponse;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
  end(data?: Uint8Array | string): void;
};

const CIE_CSV_PATH = path.resolve(process.cwd(), "data/cie-1931-2deg.csv");

export default async function handler(_req: unknown, res: ApiResponse): Promise<void> {
  try {
    const csv = await readFile(CIE_CSV_PATH, "utf8");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(csv);
  } catch {
    res.status(404).json({ error: "CIE 1931 CSV not found" });
  }
}
