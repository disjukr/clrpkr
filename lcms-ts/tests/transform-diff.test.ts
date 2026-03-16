import { access, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { TYPE_ARGB_8, TYPE_RGB_8 } from "../src/format/packing.js";
import { cmsOpenProfileFromMem } from "../src/profile/profile.js";
import { cmsCreateTransform, cmsDoTransform, cmsFLAGS_COPY_ALPHA, cmsFLAGS_NULLTRANSFORM } from "../src/transform/index.js";

const packageDir = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(packageDir, "tmp", "oracle", "transform_oracle.exe");
const helperSource = path.join(packageDir, "oracle", "transform_oracle.c");
const buildScript = path.join(packageDir, "scripts", "build-transform-oracle.mjs");
const repoRoot = path.resolve(packageDir, "..");
const inputProfilePath = path.join(repoRoot, "icc-profiles", "color", "sRGB2014.icc");
const outputProfilePath = path.join(repoRoot, "icc-profiles", "color", "Display P3.icc");

interface TransformOracleOutput {
  readonly rgb: readonly number[];
  readonly argb: readonly number[];
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

function getTsResults(): TransformOracleOutput {
  const inputProfile = cmsOpenProfileFromMem(new Uint8Array(readFileSync(inputProfilePath)));
  const outputProfile = cmsOpenProfileFromMem(new Uint8Array(readFileSync(outputProfilePath)));

  const xform = cmsCreateTransform(inputProfile, TYPE_RGB_8, outputProfile, TYPE_RGB_8, 0, 0);
  const nullXform = cmsCreateTransform(
    inputProfile,
    TYPE_ARGB_8,
    inputProfile,
    TYPE_ARGB_8,
    0,
    cmsFLAGS_NULLTRANSFORM | cmsFLAGS_COPY_ALPHA,
  );

  const rgbInput = Uint8Array.from([15, 75, 160, 220, 120, 45]);
  const rgbOutput = new Uint8Array(6);
  const argbInput = Uint8Array.from([170, 16, 32, 48, 187, 64, 80, 96]);
  const argbOutput = new Uint8Array(8);

  cmsDoTransform(xform, rgbInput, rgbOutput, 2);
  cmsDoTransform(nullXform, argbInput, argbOutput, 2);

  return {
    rgb: Array.from(rgbOutput),
    argb: Array.from(argbOutput),
  };
}

describe("upstream differential transform behavior", () => {
  beforeAll(async () => {
    await ensureHelper();
  });

  it("matches representative cmsCreateTransform/cmsDoTransform outputs", async () => {
    const [{ stdout }, ts] = await Promise.all([
      run(helperPath, [inputProfilePath, outputProfilePath]),
      Promise.resolve(getTsResults()),
    ]);
    const oracle = JSON.parse(stdout) as TransformOracleOutput;

    expect(ts).toEqual(oracle);
  });
});
