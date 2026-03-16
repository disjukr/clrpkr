import { describe, expect, it } from "vitest";

import {
  _cmsComputeInterpParams,
  _cmsComputeInterpParamsEx,
  CMS_LERP_FLAGS_TRILINEAR,
  cmsEvalInterp16,
  cmsEvalInterpFloat,
} from "../src/interp/index.js";

function expectClose(actual: readonly number[], expected: readonly number[], tolerance = 1e-6): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index] ?? 0, Math.max(0, Math.round(-Math.log10(tolerance))));
  });
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

describe("cmsintrp port", () => {
  it("interpolates 1D tables in float", () => {
    const table = new Float32Array([0, 0.5, 1]);
    const params = _cmsComputeInterpParams(3, 1, 1, table, 0);

    expectClose(cmsEvalInterpFloat([0.25], params), [0.25]);
    expectClose(cmsEvalInterpFloat([0.75], params), [0.75]);
  });

  it("evaluates 3D tetrahedral interpolation for affine CLUTs", () => {
    const coefficients = [[0.1, 0.25, 0.5, 0.125]];
    const table = createAffineClut([3, 3, 3], 1, coefficients);
    const params = _cmsComputeInterpParamsEx([3, 3, 3], 3, 1, table, 0);
    const input = [0.2, 0.4, 0.6];
    const expected = [0.1 + 0.25 * 0.2 + 0.5 * 0.4 + 0.125 * 0.6];

    expectClose(cmsEvalInterpFloat(input, params), expected);
  });

  it("evaluates recursive tetrahedral interpolation for 4D affine CLUTs", () => {
    const coefficients = [[0.05, 0.1, 0.2, 0.3, 0.15]];
    const table = createAffineClut([4, 3, 5, 4], 1, coefficients);
    const params = _cmsComputeInterpParamsEx([4, 3, 5, 4], 4, 1, table, 0);
    const input = [0.3, 0.25, 0.8, 0.5];
    const expected = [0.05 + 0.1 * 0.3 + 0.2 * 0.25 + 0.3 * 0.8 + 0.15 * 0.5];

    expectClose(cmsEvalInterpFloat(input, params), expected);
  });

  it("switches to multilinear when trilinear flag is requested", () => {
    const coefficients = [[0.2, 0.1, 0.3, 0.05]];
    const table = createAffineClut([4, 4, 4], 1, coefficients);
    const params = _cmsComputeInterpParamsEx([4, 4, 4], 3, 1, table, CMS_LERP_FLAGS_TRILINEAR);
    const input = [0.61, 0.22, 0.47];
    const expected = [0.2 + 0.1 * 0.61 + 0.3 * 0.22 + 0.05 * 0.47];

    expectClose(cmsEvalInterpFloat(input, params), expected);
  });

  it("produces uint16 output for 16-bit tables", () => {
    const table = Uint16Array.from([0, 32768, 65535]);
    const params = _cmsComputeInterpParams(3, 1, 1, table, 0);

    expect(Array.from(cmsEvalInterp16([32768], params))).toEqual([32768]);
  });
});
