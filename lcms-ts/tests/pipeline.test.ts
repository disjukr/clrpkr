import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildPipelineFromTag, cmsPipelineEvalFloat, parseIccHeader, parseIccTagTable } from "../src/index.js";

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
});
