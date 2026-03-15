import { mkdir, access, readdir, rm, copyFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCRIPTS_DIR = path.resolve(__dirname, "..");
export const ROOT_DIR = path.resolve(SCRIPTS_DIR, "..");

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function downloadFile(url, destinationPath) {
  await ensureDir(path.dirname(destinationPath));
  await runCommand("curl.exe", [
    "-L",
    "--fail",
    "--silent",
    "--show-error",
    "-A",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "-o",
    destinationPath,
    url,
  ]);
}

export async function expandZip(zipPath, destinationDir) {
  await ensureDir(destinationDir);

  await runCommand("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Expand-Archive",
    "-LiteralPath",
    zipPath,
    "-DestinationPath",
    destinationDir,
    "-Force",
  ]);
}

export async function cleanExtractedTree(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "__MACOSX") {
        await rm(entryPath, { recursive: true, force: true });
        continue;
      }

      await cleanExtractedTree(entryPath);
      continue;
    }

    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      await rm(entryPath, { force: true });
    }
  }
}

export async function emptyDir(dirPath) {
  await ensureDir(dirPath);
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    await rm(path.join(dirPath, entry.name), { recursive: true, force: true });
  }
}

export async function removeDirectIccFiles(dirPath) {
  await ensureDir(dirPath);
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (path.extname(entry.name).toLowerCase() === ".icc") {
      await rm(path.join(dirPath, entry.name), { force: true });
    }
  }
}

export async function removeChildrenExcept(dirPath, allowedNames) {
  await ensureDir(dirPath);
  const allowed = new Set(allowedNames);
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (allowed.has(entry.name)) {
      continue;
    }

    await rm(path.join(dirPath, entry.name), { recursive: true, force: true });
  }
}

export async function collectIccFiles(sourceDir, destinationDir) {
  await ensureDir(destinationDir);
  const seenNames = new Set();
  await collectIccFilesInternal(sourceDir, destinationDir, seenNames);
}

async function collectIccFilesInternal(sourceDir, destinationDir, seenNames) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(sourceDir, entry.name);

    if (entry.isDirectory()) {
      await collectIccFilesInternal(entryPath, destinationDir, seenNames);
      continue;
    }

    if (path.extname(entry.name).toLowerCase() !== ".icc") {
      continue;
    }

    const destinationPath = await getUniqueDestinationPath(
      destinationDir,
      entry.name,
      seenNames,
    );

    await copyFile(entryPath, destinationPath);
  }
}

async function getUniqueDestinationPath(destinationDir, fileName, seenNames) {
  const parsed = path.parse(fileName);
  let candidate = fileName;
  let index = 2;

  while (
    seenNames.has(candidate) ||
    (await fileExists(path.join(destinationDir, candidate)))
  ) {
    candidate = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }

  seenNames.add(candidate);
  return path.join(destinationDir, candidate);
}

export async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });

    child.on("error", reject);
  });
}
