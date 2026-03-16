import { access, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import {
  cmsSliceSpace16,
  cmsSliceSpaceFloat,
  cmsStageSampleCLut16bit,
  cmsStageSampleCLutFloat,
  SAMPLER_INSPECT,
} from "../src/pipeline/sampling.js";
import type { CmsPipelineStage } from "../src/pipeline/index.js";

const packageDir = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(packageDir, "tmp", "oracle", "sampling_oracle.exe");
const helperSource = path.join(packageDir, "oracle", "sampling_oracle.c");
const buildScript = path.join(packageDir, "scripts", "build-sampling-oracle.mjs");

interface SamplingOracleOutput {
  readonly slice16: readonly (readonly number[])[];
  readonly sliceFloat: readonly (readonly number[])[];
  readonly clutFloatWritten: readonly number[];
  readonly clut16Seen: readonly number[];
  readonly clut16AfterInspect: readonly number[];
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

function getTsOutput(): SamplingOracleOutput {
  const slice16: number[][] = [];
  const sliceFloat: number[][] = [];

  cmsSliceSpace16(2, [2, 3], (input) => {
    slice16.push(Array.from(input));
    return true;
  }, null);

  cmsSliceSpaceFloat(2, [2, 3], (input) => {
    sliceFloat.push([...input]);
    return true;
  }, null);

  const clutFloat: CmsPipelineStage = {
    kind: "clutf",
    inputChannels: 2,
    outputChannels: 1,
    gridPoints: [2, 2],
    values: new Float32Array([0, 0.25, 0.5, 0.75]),
  };
  cmsStageSampleCLutFloat(clutFloat, (_input, output) => {
    output[0] = (output[0] ?? 0) + 0.1;
    return true;
  }, null);

  const clut16: CmsPipelineStage = {
    kind: "clut16",
    inputChannels: 1,
    outputChannels: 1,
    gridPoints: [3],
    values: new Uint16Array([0, 32768, 65535]),
  };
  const clut16Seen: number[] = [];
  cmsStageSampleCLut16bit(clut16, (_input, output) => {
    clut16Seen.push(output[0] ?? 0);
    output[0] = 12345;
    return true;
  }, null, SAMPLER_INSPECT);

  return {
    slice16,
    sliceFloat,
    clutFloatWritten: Array.from(clutFloat.values),
    clut16Seen,
    clut16AfterInspect: Array.from(clut16.values),
  };
}

function expectNestedClose(actual: readonly (readonly number[])[], expected: readonly (readonly number[])[], tolerance = 1e-6): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((row, rowIndex) => {
    expect(row.length).toBe(expected[rowIndex]?.length ?? 0);
    row.forEach((value, valueIndex) => {
      expect(Math.abs(value - (expected[rowIndex]?.[valueIndex] ?? 0))).toBeLessThanOrEqual(tolerance);
    });
  });
}

function expectFlatClose(actual: readonly number[], expected: readonly number[], tolerance = 1e-6): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, index) => {
    expect(Math.abs(value - (expected[index] ?? 0))).toBeLessThanOrEqual(tolerance);
  });
}

describe("upstream differential sampling behavior", () => {
  beforeAll(async () => {
    await ensureHelper();
  });

  it("matches upstream CLUT slicing and sampling behavior", async () => {
    const [{ stdout }, ts] = await Promise.all([run(helperPath, []), Promise.resolve(getTsOutput())]);
    const oracle = JSON.parse(stdout) as SamplingOracleOutput;

    expectNestedClose(ts.slice16, oracle.slice16, 0);
    expectNestedClose(ts.sliceFloat, oracle.sliceFloat);
    expectFlatClose(ts.clutFloatWritten, oracle.clutFloatWritten);
    expectFlatClose(ts.clut16Seen, oracle.clut16Seen, 0);
    expectFlatClose(ts.clut16AfterInspect, oracle.clut16AfterInspect, 0);
  });
});
