import { describe, expect, it } from "vitest";

import {
  cmsSliceSpace16,
  cmsSliceSpaceFloat,
  cmsStageSampleCLut16bit,
  cmsStageSampleCLutFloat,
  SAMPLER_INSPECT,
} from "../src/pipeline/sampling.js";
import type { CmsPipelineStage } from "../src/pipeline/index.js";

function expectArrayClose(actual: readonly number[], expected: readonly number[], tolerance = 1e-6): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, index) => {
    expect(Math.abs(value - (expected[index] ?? 0))).toBeLessThanOrEqual(tolerance);
  });
}

describe("cmssamp bootstrap", () => {
  it("slices float space in lexicographic CLUT order", () => {
    const visited: number[][] = [];

    const ok = cmsSliceSpaceFloat(2, [2, 3], (input) => {
      visited.push([...input]);
      return true;
    }, null);

    expect(ok).toBe(true);
    expect(visited).toEqual([
      [0, 0],
      [0, 32768 / 65535],
      [0, 1],
      [1, 0],
      [1, 32768 / 65535],
      [1, 1],
    ]);
  });

  it("slices 16-bit space in lexicographic CLUT order", () => {
    const visited: number[][] = [];

    const ok = cmsSliceSpace16(2, [2, 3], (input) => {
      visited.push(Array.from(input));
      return true;
    }, null);

    expect(ok).toBe(true);
    expect(visited).toEqual([
      [0, 0],
      [0, 32768],
      [0, 65535],
      [65535, 0],
      [65535, 32768],
      [65535, 65535],
    ]);
  });

  it("samples float CLUT nodes and writes back modified values", () => {
    const stage: CmsPipelineStage = {
      kind: "clutf",
      inputChannels: 2,
      outputChannels: 1,
      gridPoints: [2, 2],
      values: new Float32Array([0, 0.25, 0.5, 0.75]),
    };

    const ok = cmsStageSampleCLutFloat(stage, (_input, output) => {
      output[0] = (output[0] ?? 0) + 0.1;
      return true;
    }, null);

    expect(ok).toBe(true);
    expectArrayClose(Array.from(stage.values), [0.1, 0.35, 0.6, 0.85]);
  });

  it("supports inspect mode without mutating the CLUT", () => {
    const stage: CmsPipelineStage = {
      kind: "clut16",
      inputChannels: 1,
      outputChannels: 1,
      gridPoints: [3],
      values: new Uint16Array([0, 32768, 65535]),
    };
    const seen: number[] = [];

    const ok = cmsStageSampleCLut16bit(stage, (_input, output) => {
      seen.push(output[0] ?? 0);
      output[0] = 12345;
      return true;
    }, null, SAMPLER_INSPECT);

    expect(ok).toBe(true);
    expect(seen).toEqual([0, 32768, 65535]);
    expect(Array.from(stage.values)).toEqual([0, 32768, 65535]);
  });
});
