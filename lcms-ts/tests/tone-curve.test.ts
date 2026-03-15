import { describe, expect, it } from "vitest";

import {
  cmsBuildGamma,
  cmsBuildTabulatedToneCurve16,
  cmsBuildTabulatedToneCurveFloat,
  cmsEstimateGamma,
  cmsEvalToneCurve16,
  cmsEvalToneCurveFloat,
  cmsGetToneCurveParametricType,
  cmsIsToneCurveDescending,
  cmsIsToneCurveLinear,
  cmsIsToneCurveMonotonic,
  cmsReverseToneCurveEx,
} from "../src/index.js";

describe("tone curves", () => {
  it("builds and evaluates gamma curves", () => {
    const gamma22 = cmsBuildGamma(2.2);

    expect(cmsGetToneCurveParametricType(gamma22)).toBe(1);
    expect(cmsEvalToneCurveFloat(gamma22, 0.5)).toBeCloseTo(0.5 ** 2.2, 6);
    expect(cmsEstimateGamma(gamma22, 0.01)).toBeCloseTo(2.2, 2);
  });

  it("evaluates tabulated curves", () => {
    const linear = cmsBuildTabulatedToneCurve16(3, [0, 32768, 65535]);
    const sampled = cmsBuildTabulatedToneCurveFloat(3, [0, 0.25, 1]);

    expect(cmsEvalToneCurve16(linear, 32768)).toBeCloseTo(32768, 0);
    expect(cmsEvalToneCurveFloat(sampled, 0.5)).toBeCloseTo(0.25, 2);
    expect(cmsIsToneCurveLinear(linear)).toBe(true);
  });

  it("detects monotonic direction and reverses monotonic tables", () => {
    const descending = cmsBuildTabulatedToneCurve16(4, [65535, 50000, 10000, 0]);

    expect(cmsIsToneCurveDescending(descending)).toBe(true);
    expect(cmsIsToneCurveMonotonic(descending)).toBe(true);

    const gamma18 = cmsBuildGamma(1.8);
    const reversed = cmsReverseToneCurveEx(256, gamma18);

    expect(cmsEvalToneCurveFloat(reversed, cmsEvalToneCurveFloat(gamma18, 0.5))).toBeCloseTo(0.5, 2);
  });
});
