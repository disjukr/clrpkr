import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPipelineFromTag,
  cmsBuildParametricToneCurve,
  cmsCreateProfilePlaceholder,
  cmsPipelineEvalFloat,
  cmsReadDevicelinkLUT,
  cmsReadInputLUT,
  cmsReadOutputLUT,
  parseIccHeader,
  parseIccTagTable,
  parseIccTagValue,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function loadTag(relativePath: string, signature: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  const tag = tags.find((entry) => entry.signature === signature);

  if (!tag) {
    throw new Error(`Tag ${signature} not found in ${relativePath}`);
  }

  return { data, tag };
}

describe("pipeline mapping", () => {
  it("maps mAB tags to a stage sequence", () => {
    const { data, tag } = loadTag("color/sRGB_v4_ICC_preference.icc", "A2B0");
    const pipeline = buildPipelineFromTag(data, tag);

    expect(pipeline.inputChannels).toBe(3);
    expect(pipeline.outputChannels).toBe(3);
    expect(pipeline.stages.map((stage) => stage.kind)).toEqual(["matrix", "clut16"]);
  });

  it("evaluates a matrix/clut RGB pipeline into bounded output", () => {
    const { data, tag } = loadTag("color/sRGB_v4_ICC_preference.icc", "A2B0");
    const pipeline = buildPipelineFromTag(data, tag);
    const output = cmsPipelineEvalFloat([0.25, 0.5, 0.75], pipeline);

    expect(output).toHaveLength(3);
    expect(output.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("maps mft2 tags to tone curves and clut stages", () => {
    const { data, tag } = loadTag("eci/eciCMYK_v2.icc", "A2B0");
    const pipeline = buildPipelineFromTag(data, tag);

    expect(pipeline.inputChannels).toBe(4);
    expect(pipeline.outputChannels).toBe(3);
    expect(pipeline.stages[0]?.kind).toBe("tone-curves");
    expect(pipeline.stages[1]?.kind).toBe("clut16");
    expect(pipeline.stages[2]?.kind).toBe("tone-curves");
  });

  it("evaluates a CMYK mft2 pipeline into bounded Lab-like output", () => {
    const { data, tag } = loadTag("eci/eciCMYK_v2.icc", "A2B0");
    const pipeline = buildPipelineFromTag(data, tag);
    const output = cmsPipelineEvalFloat([0.1, 0.2, 0.3, 0.05], pipeline);

    expect(output).toHaveLength(3);
    expect(output.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("maps mft1 tags to 8-bit clut pipelines", () => {
    const { data, tag } = loadTag("eci/eciCMYK_v2.icc", "B2A2");
    const pipeline = buildPipelineFromTag(data, tag);

    expect(pipeline.inputChannels).toBe(3);
    expect(pipeline.outputChannels).toBe(4);
    expect(pipeline.stages.some((stage) => stage.kind === "clut8")).toBe(true);
  });

  it("evaluates an mft1 pipeline into bounded CMYK-like output", () => {
    const { data, tag } = loadTag("eci/eciCMYK_v2.icc", "B2A2");
    const pipeline = buildPipelineFromTag(data, tag);
    const output = cmsPipelineEvalFloat([0.4, 0.5, 0.6], pipeline);

    expect(output).toHaveLength(4);
    expect(output.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("supports tetrahedral interpolation for 3-channel CLUTs", () => {
    const pipeline = {
      inputChannels: 3,
      outputChannels: 1,
      stages: [
        {
          kind: "clut16" as const,
          inputChannels: 3,
          outputChannels: 1,
          gridPoints: [2, 2, 2] as const,
          values: new Uint16Array([
            0,
            0,
            0,
            0,
            65535,
            0,
            0,
            65535,
          ]),
        },
      ],
    };

    const tetrahedral = cmsPipelineEvalFloat([0.5, 0.5, 0.5], pipeline, {
      interpolation: "tetrahedral",
    });
    const multilinear = cmsPipelineEvalFloat([0.5, 0.5, 0.5], pipeline, {
      interpolation: "multilinear",
    });
    const automatic = cmsPipelineEvalFloat([0.5, 0.5, 0.5], pipeline, {
      interpolation: "auto",
    });

    expect(tetrahedral[0]).toBeCloseTo(0.5, 6);
    expect(multilinear[0]).toBeCloseTo(0.25, 6);
    expect(automatic[0]).toBeCloseTo(tetrahedral[0]!, 6);
  });

  it("selects CLUT pipelines by intent from CMYK profiles", () => {
    const fullPath = path.join(repoRoot, "icc-profiles", "eci/eciCMYK_v2.icc");
    const data = readFileSync(fullPath);
    const header = parseIccHeader(data);
    const tags = parseIccTagTable(data, header);
    const profile = cmsCreateProfilePlaceholder(
      header,
      ["A2B0", "B2A0", "B2A2"].map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Tag ${signature} not found`);
        }
        return { signature, value: parseIccTagValue(data, tag) };
      }),
    );

    const input = cmsReadInputLUT(profile, 0);
    const output = cmsReadOutputLUT(profile, 0);

    expect(input?.stages.some((stage) => stage.kind === "clut16")).toBe(true);
    expect(output?.stages.some((stage) => stage.kind === "clut16" || stage.kind === "clut8")).toBe(true);
  });

  it("falls back to matrix-shaper pipelines for RGB matrix profiles", () => {
    const fullPath = path.join(repoRoot, "icc-profiles", "eci/eciRGB_v2_ICCv4.icc");
    const data = readFileSync(fullPath);
    const header = parseIccHeader(data);
    const tags = parseIccTagTable(data, header);
    const profile = cmsCreateProfilePlaceholder(
      header,
      ["rXYZ", "gXYZ", "bXYZ", "rTRC", "gTRC", "bTRC"].map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Tag ${signature} not found`);
        }
        return { signature, value: parseIccTagValue(data, tag) };
      }),
    );

    const input = cmsReadInputLUT(profile, 0);
    const output = cmsReadOutputLUT(profile, 0);

    expect(input?.stages.map((stage) => stage.kind)).toEqual(["tone-curves", "matrix"]);
    expect(output?.stages.map((stage) => stage.kind)).toEqual(["matrix", "tone-curves"]);

    const forward = cmsPipelineEvalFloat([0.25, 0.5, 0.75], input!);
    const reverse = cmsPipelineEvalFloat(forward, output!);

    expect(forward.every((value) => Number.isFinite(value))).toBe(true);
    expect(reverse).toHaveLength(3);
    expect(reverse.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("builds gray fallback pipelines for gray matrix-shaper profiles", () => {
    const rgbPath = path.join(repoRoot, "icc-profiles", "eci/eciRGB_v2_ICCv4.icc");
    const rgbData = readFileSync(rgbPath);
    const rgbHeader = parseIccHeader(rgbData);
    const profile = cmsCreateProfilePlaceholder(
      {
        ...rgbHeader,
        colorSpace: "GRAY",
        pcs: "XYZ ",
      },
      [
        {
          signature: "kTRC",
          value: {
            kind: "curv",
            curve: cmsBuildParametricToneCurve(1, [2.2]),
            entryCount: 1,
          },
        },
      ],
    );

    const input = cmsReadInputLUT(profile, 0);
    const output = cmsReadOutputLUT(profile, 0);

    expect(input?.stages.map((stage) => stage.kind)).toEqual(["tone-curves", "matrix"]);
    expect(output?.stages.map((stage) => stage.kind)).toEqual(["matrix", "tone-curves"]);

    const xyz = cmsPipelineEvalFloat([0.5], input!);
    const gray = cmsPipelineEvalFloat(xyz, output!);

    expect(xyz).toHaveLength(3);
    expect(gray[0]).toBeCloseTo(0.5, 3);
  });

  it("selects devicelink LUTs by intent", () => {
    const fullPath = path.join(repoRoot, "icc-profiles", "eci/eciCMYK_v2.icc");
    const data = readFileSync(fullPath);
    const header = parseIccHeader(data);
    const tags = parseIccTagTable(data, header);
    const profile = cmsCreateProfilePlaceholder(
      {
        ...header,
        deviceClass: "link",
      },
      ["A2B0", "A2B2"].map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Tag ${signature} not found`);
        }
        return { signature, value: parseIccTagValue(data, tag) };
      }),
    );

    const perceptual = cmsReadDevicelinkLUT(profile, 0);
    const saturation = cmsReadDevicelinkLUT(profile, 2);

    expect(perceptual?.stages.some((stage) => stage.kind === "clut16")).toBe(true);
    expect(saturation?.stages.some((stage) => stage.kind === "clut16")).toBe(true);
  });
});
