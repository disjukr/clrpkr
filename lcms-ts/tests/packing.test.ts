import { describe, expect, it } from "vitest";

import {
  _cmsFormatterIs8bit,
  _cmsFormatterIsFloat,
  cmsChannelsOfColorSpace,
  cmsFormatterForColorspaceOfProfile,
  cmsFormatterForPCSOfProfile,
  cmsFormatterPixelSize,
  packChunky16To8,
  packChunkyFloat32,
  TYPE_ARGB_8,
  TYPE_CMYK_FLT,
  TYPE_GRAY_8,
  TYPE_RGB_8,
  TYPE_RGB_DBL,
  TYPE_RGB_FLT,
  unpackChunky8To16,
  unpackChunkyFloat32,
} from "../src/format/packing.js";
import { cmsCreateProfilePlaceholder } from "../src/profile/profile.js";

const BASE_HEADER = {
  preferredCmmType: "    ",
  versionMajor: 4,
  versionMinor: 3,
  versionBugfix: 0,
  deviceClass: "mntr",
  colorSpace: "RGB ",
  pcs: "XYZ ",
  createdAt: {
    year: 2024,
    month: 1,
    day: 1,
    hours: 0,
    minutes: 0,
    seconds: 0,
  },
  magic: "acsp",
  platform: "MSFT",
  flags: 0,
  manufacturer: "    ",
  model: "    ",
  attributes: 0n,
  renderingIntent: 0,
  illuminant: {
    X: 0.9642,
    Y: 1,
    Z: 0.82491,
  },
  creator: "    ",
  profileId: "00000000000000000000000000000000",
};

function expectFloatArrayClose(actual: readonly number[], expected: readonly number[], tolerance = 1e-6): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, index) => {
    expect(Math.abs(value - (expected[index] ?? 0))).toBeLessThanOrEqual(tolerance);
  });
}

describe("packing formatter helpers", () => {
  it("builds color-space and PCS formatters for a profile", () => {
    const profile = cmsCreateProfilePlaceholder(BASE_HEADER);

    expect(cmsFormatterForColorspaceOfProfile(profile, 1, false)).toBe(TYPE_RGB_8);
    expect(cmsFormatterForColorspaceOfProfile(profile, 4, true)).toBe(TYPE_RGB_FLT);
    expect(cmsFormatterForPCSOfProfile(profile, 0, true)).toBe(0x490018);
  });

  it("exposes formatter classification helpers", () => {
    expect(_cmsFormatterIs8bit(TYPE_GRAY_8)).toBe(true);
    expect(_cmsFormatterIsFloat(TYPE_RGB_FLT)).toBe(true);
    expect(_cmsFormatterIsFloat(TYPE_RGB_DBL)).toBe(true);
    expect(cmsFormatterPixelSize(TYPE_RGB_DBL)).toBe(8);
    expect(cmsChannelsOfColorSpace("CMYK")).toBe(4);
  });
});

describe("packing chunky helpers", () => {
  it("unpacks and packs RGB bytes to 16-bit words", () => {
    const unpacked = unpackChunky8To16(TYPE_RGB_8, Uint8Array.from([0x12, 0x34, 0x56]));
    expect(Array.from(unpacked)).toEqual([0x1212, 0x3434, 0x5656]);

    const packed = packChunky16To8(TYPE_RGB_8, unpacked);
    expect(Array.from(packed)).toEqual([0x12, 0x34, 0x56]);
  });

  it("handles swap-first chunky layouts", () => {
    const unpacked = unpackChunky8To16(TYPE_ARGB_8, Uint8Array.from([0xff, 0x10, 0x20, 0x30]));
    expect(Array.from(unpacked)).toEqual([0x1010, 0x2020, 0x3030]);

    const packed = packChunky16To8(TYPE_ARGB_8, unpacked);
    expect(Array.from(packed)).toEqual([0, 0x10, 0x20, 0x30]);
  });

  it("packs and unpacks CMYK floats", () => {
    const unpacked = unpackChunkyFloat32(TYPE_CMYK_FLT, Float32Array.from([0.1, 0.2, 0.3, 0.4]));
    expectFloatArrayClose(Array.from(unpacked), [0.1, 0.2, 0.3, 0.4]);

    const packed = packChunkyFloat32(TYPE_CMYK_FLT, unpacked);
    expectFloatArrayClose(Array.from(packed), [0.1, 0.2, 0.3, 0.4]);
  });
});
