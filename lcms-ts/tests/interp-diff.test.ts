import { access, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import {
  _cmsComputeInterpParams,
  _cmsComputeInterpParamsEx,
  CMS_LERP_FLAGS_TRILINEAR,
  cmsEvalInterp16,
  cmsEvalInterpFloat,
} from "../src/interp/index.js";

const packageDir = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(packageDir, "tmp", "oracle", "interp_oracle.exe");
const helperSource = path.join(packageDir, "oracle", "interp_oracle.c");
const buildScript = path.join(packageDir, "scripts", "build-interp-oracle.mjs");

interface InterpOracleOutput {
  readonly linear025: readonly number[];
  readonly linear075: readonly number[];
  readonly tetra3d: readonly number[];
  readonly tetra4d: readonly number[];
  readonly trilinear3d: readonly number[];
  readonly u16: readonly number[];
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

function createAffineClut(
  gridPoints: readonly number[],
  outputChannels: number,
  coefficients: readonly number[][],
): Float32Array {
  const totalEntries = gridPoints.reduce((product, points) => product * points, outputChannels);
  const values = new Float32Array(totalEntries);
  let offset = 0;

  const visit = (axis: number, coords: number[]): void => {
    if (axis >= gridPoints.length) {
      const normalized = coords.map((coord, index) => coord / ((gridPoints[index] ?? 1) - 1));
      for (let outIndex = 0; outIndex < outputChannels; outIndex += 1) {
        const coeffs = coefficients[outIndex] ?? [];
        let value = coeffs[0] ?? 0;
        for (let inputIndex = 0; inputIndex < normalized.length; inputIndex += 1) {
          value += (coeffs[inputIndex + 1] ?? 0) * (normalized[inputIndex] ?? 0);
        }
        values[offset + outIndex] = value;
      }
      offset += outputChannels;
      return;
    }

    for (let coord = 0; coord < (gridPoints[axis] ?? 0); coord += 1) {
      coords.push(coord);
      visit(axis + 1, coords);
      coords.pop();
    }
  };

  visit(0, []);
  return values;
}

function getTsOutput(): InterpOracleOutput {
  const linearTable = new Float32Array([0, 0.5, 1]);
  const linearParams = _cmsComputeInterpParams(3, 1, 1, linearTable, 0);

  const tetra3dTable = createAffineClut([3, 3, 3], 1, [[0.1, 0.25, 0.5, 0.125]]);
  const tetra3dParams = _cmsComputeInterpParamsEx([3, 3, 3], 3, 1, tetra3dTable, 0);

  const tetra4dTable = createAffineClut([4, 3, 5, 4], 1, [[0.05, 0.1, 0.2, 0.3, 0.15]]);
  const tetra4dParams = _cmsComputeInterpParamsEx([4, 3, 5, 4], 4, 1, tetra4dTable, 0);

  const trilinearTable = createAffineClut([4, 4, 4], 1, [[0.2, 0.1, 0.3, 0.05]]);
  const trilinearParams = _cmsComputeInterpParamsEx([4, 4, 4], 3, 1, trilinearTable, CMS_LERP_FLAGS_TRILINEAR);

  const u16Table = Uint16Array.from([0, 32768, 65535]);
  const u16Params = _cmsComputeInterpParams(3, 1, 1, u16Table, 0);

  return {
    linear025: cmsEvalInterpFloat([0.25], linearParams),
    linear075: cmsEvalInterpFloat([0.75], linearParams),
    tetra3d: cmsEvalInterpFloat([0.2, 0.4, 0.6], tetra3dParams),
    tetra4d: cmsEvalInterpFloat([0.3, 0.25, 0.8, 0.5], tetra4dParams),
    trilinear3d: cmsEvalInterpFloat([0.61, 0.22, 0.47], trilinearParams),
    u16: Array.from(cmsEvalInterp16([32768], u16Params)),
  };
}

function expectNumberArrayClose(actual: readonly number[], expected: readonly number[], tolerance = 1e-6): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, index) => {
    expect(Math.abs(value - (expected[index] ?? 0))).toBeLessThanOrEqual(tolerance);
  });
}

describe("upstream differential interpolation behavior", () => {
  beforeAll(async () => {
    await ensureHelper();
  });

  it("matches cmsintrp oracle outputs for fixed interpolation cases", async () => {
    const [{ stdout }, ts] = await Promise.all([run(helperPath, []), Promise.resolve(getTsOutput())]);
    const oracle = JSON.parse(stdout) as InterpOracleOutput;

    expectNumberArrayClose(ts.linear025, oracle.linear025);
    expectNumberArrayClose(ts.linear075, oracle.linear075);
    expectNumberArrayClose(ts.tetra3d, oracle.tetra3d);
    expectNumberArrayClose(ts.tetra4d, oracle.tetra4d);
    expectNumberArrayClose(ts.trilinear3d, oracle.trilinear3d);
    expect(ts.u16).toEqual(oracle.u16);
  });
});
