import path from "node:path";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { cmsPipelineEvalFloat, cmsReadInputLUT, cmsReadOutputLUT } from "../src/pipeline/index.js";
import {
  cmsFLAGS_COPY_ALPHA,
  cmsFLAGS_NULLTRANSFORM,
  cmsCreateTransform,
  cmsDoTransform,
} from "../src/transform/index.js";
import { cmsOpenProfileFromMem, type CmsProfile } from "../src/profile/profile.js";
import { cmsGetPCS } from "../src/profile/profile.js";
import { CMS_D50_XYZ, cmsLab2XYZ, cmsXYZ2Lab } from "../src/color/conversions.js";
import {
  packChunky16To8,
  TYPE_ARGB_8,
  TYPE_RGB_8,
  unpackChunky8To16,
} from "../src/format/packing.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const srgbPath = path.join(repoRoot, "icc-profiles", "color", "sRGB2014.icc");
const displayP3Path = path.join(repoRoot, "icc-profiles", "color", "Display P3.icc");

function normalizeRgb8(pixel: readonly number[]): number[] {
  return pixel.map((value) => (((value & 0xff) << 8) | (value & 0xff)) / 65535);
}

function bridgePCS(values: readonly number[], inputPCS: string, outputPCS: string): number[] {
  if (inputPCS === outputPCS) {
    return [...values];
  }

  if (inputPCS === "Lab " && outputPCS === "XYZ ") {
    const xyz = cmsLab2XYZ(CMS_D50_XYZ, {
      L: (values[0] ?? 0) * 100,
      a: (values[1] ?? 0) * 255 - 128,
      b: (values[2] ?? 0) * 255 - 128,
    });
    return [xyz.X, xyz.Y, xyz.Z];
  }

  if (inputPCS === "XYZ " && outputPCS === "Lab ") {
    const lab = cmsXYZ2Lab(CMS_D50_XYZ, {
      X: values[0] ?? 0,
      Y: values[1] ?? 0,
      Z: values[2] ?? 0,
    });
    return [lab.L / 100, (lab.a + 128) / 255, (lab.b + 128) / 255];
  }

  throw new Error(`Unsupported PCS bridge ${JSON.stringify(inputPCS)} -> ${JSON.stringify(outputPCS)}`);
}

function createProfile(filePath: string): CmsProfile {
  return cmsOpenProfileFromMem(new Uint8Array(readFileSync(filePath)));
}

describe("cmsxform bootstrap", () => {
  it("applies null transforms as pass-through and copies alpha when requested", () => {
    const profile = createProfile(srgbPath);
    const transform = cmsCreateTransform(profile, TYPE_ARGB_8, profile, TYPE_ARGB_8, 0, cmsFLAGS_NULLTRANSFORM | cmsFLAGS_COPY_ALPHA);
    const input = Uint8Array.from([0xaa, 0x10, 0x20, 0x30, 0xbb, 0x40, 0x50, 0x60]);
    const output = new Uint8Array(input.length);

    cmsDoTransform(transform, input, output, 2);

    expect(Array.from(output)).toEqual(Array.from(input));
  });

  it("matches manual pipeline composition for a representative RGB transform", () => {
    const inputProfile = createProfile(srgbPath);
    const outputProfile = createProfile(displayP3Path);
    const transform = cmsCreateTransform(inputProfile, TYPE_RGB_8, outputProfile, TYPE_RGB_8, 0, 0);
    const inputPipeline = cmsReadInputLUT(inputProfile, 0);
    const outputPipeline = cmsReadOutputLUT(outputProfile, 0);
    const pixel = [32, 120, 224] as const;

    if (!inputPipeline || !outputPipeline) {
      throw new Error("Expected both transform pipelines to exist");
    }

    const normalized = normalizeRgb8(pixel);
    const pcs = cmsPipelineEvalFloat(normalized, inputPipeline);
    const bridged = bridgePCS(pcs, cmsGetPCS(inputProfile), cmsGetPCS(outputProfile));
    const device = cmsPipelineEvalFloat(bridged, outputPipeline);
    const expectedBytes = Array.from(
      packChunky16To8(
        TYPE_RGB_8,
        device.map((value) => Math.round(Math.max(0, Math.min(1, value)) * 65535)),
      ),
    );

    const output = new Uint8Array(3);
    cmsDoTransform(transform, Uint8Array.from(pixel), output, 1);

    expect(Array.from(output)).toEqual(expectedBytes);
  });

  it("round-trips same-profile RGB transforms without large drift", () => {
    const profile = createProfile(srgbPath);
    const transform = cmsCreateTransform(profile, TYPE_RGB_8, profile, TYPE_RGB_8, 0, 0);
    const input = Uint8Array.from([15, 75, 160, 220, 120, 45]);
    const output = new Uint8Array(input.length);

    cmsDoTransform(transform, input, output, 2);

    const decodedInput = Array.from(unpackChunky8To16(TYPE_RGB_8, input.subarray(0, 3)));
    const decodedOutput = Array.from(unpackChunky8To16(TYPE_RGB_8, output.subarray(0, 3)));
    decodedOutput.forEach((value, index) => {
      expect(Math.abs(value - (decodedInput[index] ?? 0))).toBeLessThanOrEqual(4096);
    });
  });
});
