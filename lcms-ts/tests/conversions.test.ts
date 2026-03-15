import { describe, expect, it } from "vitest";

import {
  CMS_D50_XYZ,
  CMS_D50_xyY,
  cmsD50XYZ,
  cmsD50xyY,
  cmsLab2LCh,
  cmsLab2XYZ,
  cmsLCh2Lab,
  cmsXYZ2Lab,
  cmsXYZ2xyY,
  cmsxyY2XYZ,
} from "../src/index.js";

describe("D50 helpers", () => {
  it("returns copies of D50 constants", () => {
    expect(cmsD50XYZ()).toEqual(CMS_D50_XYZ);
    expect(cmsD50xyY()).toEqual(CMS_D50_xyY);
    expect(cmsD50XYZ()).not.toBe(CMS_D50_XYZ);
    expect(cmsD50xyY()).not.toBe(CMS_D50_xyY);
  });
});

describe("PCS conversions", () => {
  it("round-trips xyY and XYZ", () => {
    const xyz = { X: 0.25, Y: 0.4, Z: 0.35 };
    const xyy = cmsXYZ2xyY(xyz);
    const reconstructed = cmsxyY2XYZ(xyy);

    expect(reconstructed.X).toBeCloseTo(xyz.X, 10);
    expect(reconstructed.Y).toBeCloseTo(xyz.Y, 10);
    expect(reconstructed.Z).toBeCloseTo(xyz.Z, 10);
  });

  it("round-trips Lab and XYZ against D50", () => {
    const xyz = { X: 0.2, Y: 0.3, Z: 0.1 };
    const lab = cmsXYZ2Lab(CMS_D50_XYZ, xyz);
    const reconstructed = cmsLab2XYZ(CMS_D50_XYZ, lab);

    expect(reconstructed.X).toBeCloseTo(xyz.X, 10);
    expect(reconstructed.Y).toBeCloseTo(xyz.Y, 10);
    expect(reconstructed.Z).toBeCloseTo(xyz.Z, 10);
  });

  it("round-trips Lab and LCh", () => {
    const lab = { L: 55, a: 12, b: -22 };
    const lch = cmsLab2LCh(lab);
    const reconstructed = cmsLCh2Lab(lch);

    expect(reconstructed.L).toBeCloseTo(lab.L, 10);
    expect(reconstructed.a).toBeCloseTo(lab.a, 10);
    expect(reconstructed.b).toBeCloseTo(lab.b, 10);
  });
});
