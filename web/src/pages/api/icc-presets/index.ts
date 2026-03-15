import { readdir } from "node:fs/promises";
import path from "node:path";

type ApiRequest = {
  readonly method?: string;
};

type ApiResponse = {
  status(code: number): ApiResponse;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
  end(data?: string): void;
};

type IccPreset = {
  readonly path: string;
  readonly label: string;
  readonly fileName: string;
};

const ICC_ROOT = path.resolve(process.cwd(), "../icc-profiles");

async function collectProfiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectProfiles(absolutePath)));
      continue;
    }
    if (!/\.(icc|icm)$/i.test(entry.name)) {
      continue;
    }
    files.push(absolutePath);
  }

  return files;
}

export default async function handler(_req: ApiRequest, res: ApiResponse): Promise<void> {
  const files = await collectProfiles(ICC_ROOT);
  const presets: IccPreset[] = files
    .map((absolutePath) => {
      const relativePath = path.relative(ICC_ROOT, absolutePath).replace(/\\/g, "/");
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
