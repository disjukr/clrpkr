import { access, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { cmsFormatterForColorspaceOfProfile, cmsFormatterForPCSOfProfile } from "../src/format/packing.js";
import { cmsOpenProfileFromMem } from "../src/profile/profile.js";

const packageDir = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(packageDir, "tmp", "oracle", "packing_oracle.exe");
const helperSource = path.join(packageDir, "oracle", "packing_oracle.c");
const buildScript = path.join(packageDir, "scripts", "build-packing-oracle.mjs");
const repoRoot = path.resolve(packageDir, "..");
const rgbProfilePath = path.join(repoRoot, "icc-profiles", "color", "sRGB2014.icc");
const cmykProfilePath = path.join(repoRoot, "icc-profiles", "eci", "eciCMYK_v2.icc");

interface PackingOracleCase {
  readonly color_u8: number;
  readonly color_u16: number;
  readonly color_float: number;
  readonly pcs_u16: number;
  readonly pcs_float: number;
}

interface PackingOracleOutput {
  readonly rgb: PackingOracleCase;
  readonly cmyk: PackingOracleCase;
}

function run(command: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `${command} ${args.join(" ")} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

async function ensureHelper(): Promise<void> {
  let needsBuild = false;

  try {
    const [helperStat, sourceStat] = await Promise.all([stat(helperPath), stat(helperSource)]);
    if (helperStat.mtimeMs < sourceStat.mtimeMs) {
      needsBuild = true;
    }
  } catch {
    needsBuild = true;
  }

  if (needsBuild) {
    await run(process.execPath, [buildScript]);
    await access(helperPath);
  }
}

function getTsResults(): PackingOracleOutput {
  const rgb = cmsOpenProfileFromMem(new Uint8Array(readFileSync(rgbProfilePath)));
  const cmyk = cmsOpenProfileFromMem(new Uint8Array(readFileSync(cmykProfilePath)));

  const describeProfile = (profile: ReturnType<typeof cmsOpenProfileFromMem>): PackingOracleCase => ({
    color_u8: cmsFormatterForColorspaceOfProfile(profile, 1, false),
    color_u16: cmsFormatterForColorspaceOfProfile(profile, 2, false),
    color_float: cmsFormatterForColorspaceOfProfile(profile, 4, true),
    pcs_u16: cmsFormatterForPCSOfProfile(profile, 2, false),
    pcs_float: cmsFormatterForPCSOfProfile(profile, 4, true),
  });

  return {
    rgb: describeProfile(rgb),
    cmyk: describeProfile(cmyk),
  };
}

describe("upstream differential packing formatter behavior", () => {
  beforeAll(async () => {
    await ensureHelper();
  });

  it("matches cmsFormatterFor*OfProfile for representative profiles", async () => {
    const [{ stdout }, ts] = await Promise.all([
      run(helperPath, [rgbProfilePath, cmykProfilePath]),
      Promise.resolve(getTsResults()),
    ]);
    const oracle = JSON.parse(stdout) as PackingOracleOutput;

    expect(ts).toEqual(oracle);
  });
});
