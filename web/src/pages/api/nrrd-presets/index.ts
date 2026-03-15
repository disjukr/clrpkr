import { readdir } from "node:fs/promises";
import path from "node:path";

type ApiResponse = {
  status(code: number): ApiResponse;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
};

type NrrdPreset = {
  readonly path: string;
  readonly label: string;
  readonly fileName: string;
};

const NRRD_ROOT = path.resolve(process.cwd(), "../icc2sdf/baked");

async function collectVolumes(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectVolumes(absolutePath)));
      continue;
    }
    if (!/\.nrrd$/i.test(entry.name)) {
      continue;
    }
    files.push(absolutePath);
  }

  return files;
}

export default async function handler(
  _req: unknown,
  res: ApiResponse,
): Promise<void> {
  const files = await collectVolumes(NRRD_ROOT);
  const presets: NrrdPreset[] = files
    .map((absolutePath) => {
      const relativePath = path
        .relative(NRRD_ROOT, absolutePath)
        .replace(/\\/g, "/");
      return {
        path: relativePath,
        label: relativePath,
        fileName: path.basename(relativePath),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ presets });
}
