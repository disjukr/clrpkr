import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseIccHeader,
  parseIccLutTag,
  parseIccTagTable,
  type CmsLut16TagValue,
  type CmsLut8TagValue,
  type CmsMultiProcessElementTagValue,
  validateLutTagStructure,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function loadProfile(relativePath: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  return { data, tags };
}

describe("ICC LUT tag parsing", () => {
  it("parses mAB and mBA tags from v4 profiles", () => {
    const { data, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const a2b0 = tags.find((tag) => tag.signature === "A2B0");
    const b2a0 = tags.find((tag) => tag.signature === "B2A0");

    expect(a2b0).toBeDefined();
    expect(b2a0).toBeDefined();

    const parsedA2b0 = parseIccLutTag(data, a2b0!) as CmsMultiProcessElementTagValue;
    const parsedB2a0 = parseIccLutTag(data, b2a0!) as CmsMultiProcessElementTagValue;

    expect(parsedA2b0.kind).toBe("mAB");
    expect(parsedA2b0.inputChannels).toBe(3);
    expect(parsedA2b0.outputChannels).toBe(3);
    expect(parsedA2b0.hasBcurves).toBe(true);
    expect(parsedA2b0.hasClut).toBe(true);
    expect(parsedA2b0.clutGridPoints?.length).toBe(3);
    expect(validateLutTagStructure(parsedA2b0, a2b0!.size)).toEqual([]);

    expect(parsedB2a0.kind).toBe("mBA");
    expect(parsedB2a0.inputChannels).toBe(3);
    expect(parsedB2a0.outputChannels).toBe(3);
    expect(validateLutTagStructure(parsedB2a0, b2a0!.size)).toEqual([]);
  });

  it("parses mft2 tags from CMYK profiles", () => {
    const { data, tags } = loadProfile("eci/eciCMYK_v2.icc");
    const a2b0 = tags.find((tag) => tag.signature === "A2B0");

    expect(a2b0).toBeDefined();

    const parsed = parseIccLutTag(data, a2b0!) as CmsLut16TagValue;
    expect(parsed.kind).toBe("mft2");
    expect(parsed.inputChannels).toBe(4);
    expect(parsed.outputChannels).toBe(3);
    expect(parsed.gridPoints).toBe(16);
    expect(parsed.inputTableEntries).toBe(256);
    expect(parsed.outputTableEntries).toBe(256);
    expect(parsed.inputTables.length).toBe(1024);
    expect(parsed.outputTables.length).toBe(768);
    expect(parsed.clutValues.length).toBe(16 ** 4 * 3);
    expect(validateLutTagStructure(parsed, a2b0!.size)).toEqual([]);
  });

  it("parses mft1 tags from CMYK profiles", () => {
    const { data, tags } = loadProfile("eci/eciCMYK_v2.icc");
    const b2a2 = tags.find((tag) => tag.signature === "B2A2");

    expect(b2a2).toBeDefined();

    const parsed = parseIccLutTag(data, b2a2!) as CmsLut8TagValue;
    expect(parsed.kind).toBe("mft1");
    expect(parsed.inputChannels).toBe(3);
    expect(parsed.outputChannels).toBe(4);
    expect(parsed.gridPoints).toBe(33);
    expect(parsed.inputTables.length).toBe(768);
    expect(parsed.outputTables.length).toBe(1024);
    expect(parsed.clutValues.length).toBe(33 ** 3 * 4);
    expect(validateLutTagStructure(parsed, b2a2!.size)).toEqual([]);
  });
});
