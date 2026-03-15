import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const packageDir = process.cwd();
const upstreamDir = process.env.LCMS_UPSTREAM_DIR
  ? path.resolve(process.env.LCMS_UPSTREAM_DIR)
  : path.resolve(packageDir, "tmp", "Little-CMS");
const headerPath = path.join(upstreamDir, "include", "lcms2.h");
const generatedTsPath = path.join(
  packageDir,
  "src",
  "port",
  "generated",
  "upstream-api.ts",
);
const generatedMdPath = path.join(packageDir, "docs", "upstream-api.md");
const headerDisplayPath = path.relative(packageDir, headerPath).replaceAll("\\", "/");

const header = await readFile(headerPath, "utf8");
const apiLines = header
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith("CMSAPI") && line.includes("CMSEXPORT"))
  .filter((line) => /\bcms[A-Za-z0-9_]+\s*\(/.test(line));

const entries = apiLines.map((signature) => {
  const match = signature.match(/\b(cms[A-Za-z0-9_]+)\s*\(/);

  if (!match) {
    throw new Error(`Unable to parse API name from line: ${signature}`);
  }

  return {
    name: match[1],
    signature,
  };
});

const tsFile = `export interface UpstreamApiEntry {
  readonly name: string;
  readonly signature: string;
}

export const UPSTREAM_PUBLIC_API: readonly UpstreamApiEntry[] = ${JSON.stringify(entries, null, 2)} as const;
`;

const mdLines = [
  "# Upstream API Surface",
  "",
  `Source: \`${headerDisplayPath}\``,
  "",
  `Extracted entries: ${entries.length}`,
  "",
  "| API | Signature |",
  "| --- | --- |",
  ...entries.map((entry) => `| \`${entry.name}\` | \`${entry.signature.replaceAll("|", "\\|")}\` |`),
  "",
];

await mkdir(path.dirname(generatedTsPath), { recursive: true });
await mkdir(path.dirname(generatedMdPath), { recursive: true });
await writeFile(generatedTsPath, tsFile, "utf8");
await writeFile(generatedMdPath, mdLines.join("\n"), "utf8");

console.log(`Synced ${entries.length} upstream API entries from ${headerPath}`);
