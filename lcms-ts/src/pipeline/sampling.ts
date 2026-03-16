import { cmsEvalInterp16, cmsEvalInterpFloat } from "../interp/index.js";
import type { CmsInterpMethod, CmsInterpParams } from "../interp/index.js";
import { _cmsComputeInterpParamsEx, CMS_LERP_FLAGS_TRILINEAR } from "../interp/index.js";
import type { CmsPipelineStage } from "./index.js";

export const SAMPLER_INSPECT = 0x01000000;

export type CmsSampler16 = (input: ArrayLike<number>, output: Uint16Array, cargo: unknown) => boolean | number;
export type CmsSamplerFloat = (input: readonly number[], output: number[], cargo: unknown) => boolean | number;

export interface CmsSliceSpaceSample16 {
  readonly input: Uint16Array;
  readonly coords: readonly number[];
}

export interface CmsSliceSpaceSampleFloat {
  readonly input: number[];
  readonly coords: readonly number[];
}

function shouldContinue(result: boolean | number): boolean {
  return result !== false && result !== 0;
}

function coordinateTo16(coord: number, points: number): number {
  if (points <= 1) {
    return 0;
  }
  return Math.round((coord * 65535) / (points - 1));
}

function coordinateToFloat(coord: number, points: number): number {
  if (points <= 1) {
    return 0;
  }
  return coordinateTo16(coord, points) / 65535;
}

function sliceSpaceRecursive(
  nInputs: number,
  clutPoints: readonly number[],
  visit: (coords: readonly number[]) => boolean,
): boolean {
  const coords = new Array(nInputs).fill(0);

  const run = (axis: number): boolean => {
    if (axis >= nInputs) {
      return visit(coords);
    }

    const points = clutPoints[axis] ?? 0;
    for (let coord = 0; coord < points; coord += 1) {
      coords[axis] = coord;
      if (!run(axis + 1)) {
        return false;
      }
    }

    return true;
  };

  return run(0);
}

export function cmsSliceSpace16(
  nInputs: number,
  clutPoints: readonly number[],
  sampler: CmsSampler16,
  cargo: unknown,
): boolean {
  return sliceSpaceRecursive(nInputs, clutPoints, (coords) => {
    const input = Uint16Array.from(coords, (coord, axis) => coordinateTo16(coord, clutPoints[axis] ?? 0));
    return shouldContinue(sampler(input, new Uint16Array(0), cargo));
  });
}

export function cmsSliceSpaceFloat(
  nInputs: number,
  clutPoints: readonly number[],
  sampler: CmsSamplerFloat,
  cargo: unknown,
): boolean {
  return sliceSpaceRecursive(nInputs, clutPoints, (coords) => {
    const input = coords.map((coord, axis) => coordinateToFloat(coord, clutPoints[axis] ?? 0));
    return shouldContinue(sampler(input, [], cargo));
  });
}

function clutStageToInterp(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" | "clutf" }>,
  method: CmsInterpMethod,
): CmsInterpParams {
  return _cmsComputeInterpParamsEx(
    stage.gridPoints,
    stage.inputChannels,
    stage.outputChannels,
    stage.values,
    method === "trilinear" ? CMS_LERP_FLAGS_TRILINEAR : 0,
  );
}

function getNodeOutput16(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" | "clutf" }>,
  coords: readonly number[],
): Uint16Array {
  const input = coords.map((coord, axis) => coordinateTo16(coord, stage.gridPoints[axis] ?? 0));
  if (stage.kind === "clutf") {
    return Uint16Array.from(
      cmsEvalInterpFloat(input.map((value) => value / 65535), clutStageToInterp(stage, "tetrahedral")),
      (value) => Math.round(Math.max(0, Math.min(1, value)) * 65535),
    );
  }
  return cmsEvalInterp16(input, clutStageToInterp(stage, "tetrahedral"));
}

function getNodeOutputFloat(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" | "clutf" }>,
  coords: readonly number[],
): number[] {
  const input = coords.map((coord, axis) => coordinateToFloat(coord, stage.gridPoints[axis] ?? 0));
  return cmsEvalInterpFloat(input, clutStageToInterp(stage, "tetrahedral"));
}

function writeNodeOutput16(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" | "clutf" }>,
  coords: readonly number[],
  output: Uint16Array,
): void {
  let offset = 0;
  for (let axis = 0; axis < coords.length; axis += 1) {
    let stride = stage.outputChannels;
    for (let nextAxis = axis + 1; nextAxis < coords.length; nextAxis += 1) {
      stride *= stage.gridPoints[nextAxis] ?? 1;
    }
    offset += (coords[axis] ?? 0) * stride;
  }

  if (stage.kind === "clut8") {
    for (let index = 0; index < stage.outputChannels; index += 1) {
      stage.values[offset + index] = Math.round((output[index] ?? 0) / 257);
    }
    return;
  }

  if (stage.kind === "clut16") {
    stage.values.set(output.subarray(0, stage.outputChannels), offset);
    return;
  }

  for (let index = 0; index < stage.outputChannels; index += 1) {
    stage.values[offset + index] = (output[index] ?? 0) / 65535;
  }
}

function writeNodeOutputFloat(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" | "clutf" }>,
  coords: readonly number[],
  output: readonly number[],
): void {
  let offset = 0;
  for (let axis = 0; axis < coords.length; axis += 1) {
    let stride = stage.outputChannels;
    for (let nextAxis = axis + 1; nextAxis < coords.length; nextAxis += 1) {
      stride *= stage.gridPoints[nextAxis] ?? 1;
    }
    offset += (coords[axis] ?? 0) * stride;
  }

  if (stage.kind === "clutf") {
    for (let index = 0; index < stage.outputChannels; index += 1) {
      stage.values[offset + index] = output[index] ?? 0;
    }
    return;
  }

  if (stage.kind === "clut16") {
    for (let index = 0; index < stage.outputChannels; index += 1) {
      stage.values[offset + index] = Math.round(Math.max(0, Math.min(1, output[index] ?? 0)) * 65535);
    }
    return;
  }

  for (let index = 0; index < stage.outputChannels; index += 1) {
    stage.values[offset + index] = Math.round(Math.max(0, Math.min(1, output[index] ?? 0)) * 255);
  }
}

export function cmsStageSampleCLut16bit(
  stage: CmsPipelineStage,
  sampler: CmsSampler16,
  cargo: unknown,
  dwFlags = 0,
): boolean {
  if (stage.kind !== "clut8" && stage.kind !== "clut16" && stage.kind !== "clutf") {
    return false;
  }

  return sliceSpaceRecursive(stage.inputChannels, stage.gridPoints, (coords) => {
    const input = Uint16Array.from(coords, (coord, axis) => coordinateTo16(coord, stage.gridPoints[axis] ?? 0));
    const output = getNodeOutput16(stage, coords);
    const ok = shouldContinue(sampler(input, output, cargo));
    if (!ok) {
      return false;
    }
    if ((dwFlags & SAMPLER_INSPECT) === 0) {
      writeNodeOutput16(stage, coords, output);
    }
    return true;
  });
}

export function cmsStageSampleCLutFloat(
  stage: CmsPipelineStage,
  sampler: CmsSamplerFloat,
  cargo: unknown,
  dwFlags = 0,
): boolean {
  if (stage.kind !== "clut8" && stage.kind !== "clut16" && stage.kind !== "clutf") {
    return false;
  }

  return sliceSpaceRecursive(stage.inputChannels, stage.gridPoints, (coords) => {
    const input = coords.map((coord, axis) => coordinateToFloat(coord, stage.gridPoints[axis] ?? 0));
    const output = getNodeOutputFloat(stage, coords);
    const ok = shouldContinue(sampler(input, output, cargo));
    if (!ok) {
      return false;
    }
    if ((dwFlags & SAMPLER_INSPECT) === 0) {
      writeNodeOutputFloat(stage, coords, output);
    }
    return true;
  });
}
