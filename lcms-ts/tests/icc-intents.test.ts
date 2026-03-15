import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  cmsCreateProfilePlaceholder,
  cmsIsCLUT,
  cmsIsIntentSupported,
  cmsIsMatrixShaper,
  INTENT_ABSOLUTE_COLORIMETRIC,
  INTENT_PERCEPTUAL,
  INTENT_RELATIVE_COLORIMETRIC,
  LCMS_USED_AS_INPUT,
  LCMS_USED_AS_OUTPUT,
  LCMS_USED_AS_PROOF,
  parseIccHeader,
  parseIccTagTable,
  parseIccTagValue,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function loadProfile(relativePath: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  return { data, header, tags };
}

describe("ICC intent support", () => {
  it("recognizes RGB matrix-shaper profiles", () => {
    const { data, header, tags } = loadProfile("eci/eciRGB_v2_ICCv4.icc");
    const profile = cmsCreateProfilePlaceholder(
      header,
      ["rXYZ", "gXYZ", "bXYZ", "rTRC", "gTRC", "bTRC"].map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Missing tag ${signature}`);
        }
        return { signature, value: parseIccTagValue(data, tag) };
      }),
    );

    expect(cmsIsMatrixShaper(profile)).toBe(true);
    expect(cmsIsIntentSupported(profile, INTENT_PERCEPTUAL, LCMS_USED_AS_INPUT)).toBe(true);
    expect(cmsIsIntentSupported(profile, INTENT_RELATIVE_COLORIMETRIC, LCMS_USED_AS_OUTPUT)).toBe(true);
  });

  it("recognizes CLUT-backed CMYK input and output intents", () => {
    const { data, header, tags } = loadProfile("eci/eciCMYK_v2.icc");
    const profile = cmsCreateProfilePlaceholder(
      header,
      ["A2B0", "B2A0", "B2A2"].map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Missing tag ${signature}`);
        }
        return { signature, value: parseIccTagValue(data, tag) };
      }),
    );

    expect(cmsIsCLUT(profile, INTENT_PERCEPTUAL, LCMS_USED_AS_INPUT)).toBe(true);
    expect(cmsIsCLUT(profile, INTENT_PERCEPTUAL, LCMS_USED_AS_OUTPUT)).toBe(true);
    expect(cmsIsCLUT(profile, INTENT_ABSOLUTE_COLORIMETRIC, LCMS_USED_AS_OUTPUT)).toBe(false);
    expect(cmsIsIntentSupported(profile, INTENT_PERCEPTUAL, LCMS_USED_AS_PROOF)).toBe(false);
  });

  it("uses header rendering intent for devicelink CLUT support", () => {
    const profile = cmsCreateProfilePlaceholder(
      {
        preferredCmmType: "    ",
        versionMajor: 4,
        versionMinor: 3,
        versionBugfix: 0,
        deviceClass: "link",
        colorSpace: "CMYK",
        pcs: "Lab ",
        createdAt: { year: 2026, month: 3, day: 15, hours: 0, minutes: 0, seconds: 0 },
        magic: "acsp",
        platform: "APPL",
        flags: 0,
        manufacturer: "    ",
        model: "    ",
        attributes: 0n,
        renderingIntent: INTENT_RELATIVE_COLORIMETRIC,
        illuminant: { X: 0.9642, Y: 1, Z: 0.8249 },
        creator: "    ",
        profileId: "00000000000000000000000000000000",
      },
      [],
    );

    expect(cmsIsCLUT(profile, INTENT_RELATIVE_COLORIMETRIC, LCMS_USED_AS_INPUT)).toBe(true);
    expect(cmsIsCLUT(profile, INTENT_PERCEPTUAL, LCMS_USED_AS_INPUT)).toBe(false);
  });
});
