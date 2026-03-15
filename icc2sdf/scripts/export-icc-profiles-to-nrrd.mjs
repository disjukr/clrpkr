import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLabSdfVolumeFromIccGpu,
  createNodeGpuRuntime,
  serializeNrrd,
} from "../dist/src/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(scriptDir);
const repoDir = dirname(packageDir);
const iccProfilesDir = join(repoDir, "icc-profiles");
const outputRootDir = join(packageDir, "tmp", "icc-profiles-nrrd");

async function collectIccFiles(rootDir) {
  const entries = await (await import("node:fs/promises")).readdir(rootDir, {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectIccFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && /\.(icc|icm)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  files.sort((left, right) => left.localeCompare(right));
  return files;
}

async function ensureParentDir(pathname) {
  await mkdir(dirname(pathname), { recursive: true });
}

async function main() {
  const files = await collectIccFiles(iccProfilesDir);
  const failures = [];
  let converted = 0;
  const runtime = await createNodeGpuRuntime();
  const device = await runtime.requestDevice();

  await rm(outputRootDir, { recursive: true, force: true });
  await mkdir(outputRootDir, { recursive: true });

  for (const filePath of files) {
    const relativePath = relative(iccProfilesDir, filePath);
    const outputPath = join(outputRootDir, relativePath).replace(/\.(icc|icm)$/i, ".nrrd");
    const start = Date.now();

    try {
      const iccBytes = new Uint8Array(await readFile(filePath));
      const sdf = await buildLabSdfVolumeFromIccGpu(iccBytes, { device });
      const nrrd = serializeNrrd({
        metadata: {
          dimensions: sdf.metadata.dimensions,
          spacing: {
            xStep: sdf.metadata.spacing.lStep,
            yStep: sdf.metadata.spacing.aStep,
            zStep: sdf.metadata.spacing.bStep,
          },
          origin: {
            x: sdf.metadata.bounds.lMin,
            y: sdf.metadata.bounds.aMin,
            z: sdf.metadata.bounds.bMin,
          },
        },
        data: sdf.data,
      });

      await ensureParentDir(outputPath);
      await writeFile(outputPath, nrrd);
      converted += 1;
      console.log(
        `[ok] ${relativePath} -> ${relative(outputRootDir, outputPath)} (${((Date.now() - start) / 1000).toFixed(1)}s)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ file: relativePath, error: message });
      console.warn(`[fail] ${relativePath}: ${message}`);
    }
  }

  const summaryPath = join(outputRootDir, "summary.json");
  await writeFile(
    summaryPath,
    JSON.stringify(
      {
        converted,
        failed: failures.length,
        failures,
      },
      null,
      2,
    ),
  );

  console.log(`Converted ${converted}/${files.length} ICC files.`);
  console.log(`Summary: ${summaryPath}`);

  device.destroy();
}

await main();
