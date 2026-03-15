import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseIccHeader,
  parseIccTagTable,
  parseOptionalIccTagValue,
  type CmsCurveTagValue,
  type CmsMlucTagValue,
  type CmsTextTagValue,
  type CmsXyzTagValue,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function readProfile(relativePath: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  return { data, header, tags };
}

describe("ICC tag payload parsing", () => {
  it("parses mluc description and copyright tags from v4 RGB profiles", () => {
    const { data, tags } = readProfile("color/sRGB_v4_ICC_preference.icc");
    const desc = parseOptionalIccTagValue(data, tags, "desc") as CmsMlucTagValue;
    const cprt = parseOptionalIccTagValue(data, tags, "cprt") as CmsMlucTagValue;
    const wtpt = parseOptionalIccTagValue(data, tags, "wtpt") as CmsXyzTagValue;

    expect(desc.kind).toBe("mluc");
    expect(desc.entries[0]?.text.toLowerCase()).toContain("srgb");
    expect(cprt.kind).toBe("mluc");
    expect(cprt.entries[0]?.text.length).toBeGreaterThan(5);
    expect(wtpt.kind).toBe("XYZ");
    expect(wtpt.value.Y).toBeCloseTo(1, 4);
  });

  it("parses XYZ and parametric TRC tags from matrix RGB profiles", () => {
    const { data, tags } = readProfile("eci/eciRGB_v2_ICCv4.icc");
    const rXyz = parseOptionalIccTagValue(data, tags, "rXYZ") as CmsXyzTagValue;
    const rTrc = parseOptionalIccTagValue(data, tags, "rTRC");

    expect(rXyz.kind).toBe("XYZ");
    expect(rXyz.value.X).toBeGreaterThan(0);
    expect(rTrc?.kind).toBe("para");
    if (rTrc?.kind === "para") {
      expect(rTrc.functionType).toBe(3);
      expect(rTrc.parameters.length).toBe(5);
      expect(rTrc.curve.table16.length).toBeGreaterThan(1000);
    }
  });

  it("parses legacy text, desc, XYZ, and curve tags from CMYK profiles", () => {
    const { data, tags } = readProfile("eci/eciCMYK_v2.icc");
    const cprt = parseOptionalIccTagValue(data, tags, "cprt") as CmsTextTagValue;
    const desc = parseOptionalIccTagValue(data, tags, "desc");
    const kTrc = parseOptionalIccTagValue(data, tags, "kTRC") as CmsCurveTagValue;
    const wtpt = parseOptionalIccTagValue(data, tags, "wtpt") as CmsXyzTagValue;

    expect(cprt.kind).toBe("text");
    expect(cprt.text.toLowerCase()).toContain("color toolbox");
    expect(desc?.kind).toBe("desc");
    if (desc?.kind === "desc") {
      expect(desc.text.toLowerCase()).toContain("ecicmyk");
    }
    expect(kTrc.kind).toBe("curv");
    expect(kTrc.entryCount).toBeGreaterThan(100);
    expect(wtpt.kind).toBe("XYZ");
    expect(wtpt.value.X).toBeGreaterThan(0.8);
  });
});
