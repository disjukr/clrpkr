import type { CmsMAT3 } from "../math/matrix.js";
import { cmsMAT3eval, cmsVEC3init } from "../math/matrix.js";
import {
  parseIccLutTag,
  type CmsLut16TagValue,
  type CmsLut8TagValue,
  type CmsMultiProcessElementTagValue,
} from "../profile/lut.js";
import type { CmsIccTagEntry } from "../profile/tag-table.js";
import {
  cmsBuildParametricToneCurve,
  cmsBuildTabulatedToneCurve16,
  cmsEvalToneCurveFloat,
  type CmsToneCurve,
} from "../tone-curve/index.js";

export type CmsPipelineStage =
  | {
      readonly kind: "tone-curves";
      readonly channels: number;
      readonly curves: readonly CmsToneCurve[];
    }
  | {
      readonly kind: "matrix";
      readonly rows: number;
      readonly cols: number;
      readonly matrix: CmsMAT3;
      readonly offset: readonly number[];
    }
  | {
      readonly kind: "clut16";
      readonly inputChannels: number;
      readonly outputChannels: number;
      readonly gridPoints: readonly number[];
      readonly values: Uint16Array;
    }
  | {
      readonly kind: "clut8";
      readonly inputChannels: number;
      readonly outputChannels: number;
      readonly gridPoints: readonly number[];
      readonly values: Uint8Array;
    };

export interface CmsPipeline {
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly stages: readonly CmsPipelineStage[];
}

export interface CmsPipelineEvalOptions {
  readonly interpolation?: "auto" | "multilinear" | "tetrahedral";
}

function clampUnit(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function readSignature(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset]!,
    data[offset + 1]!,
    data[offset + 2]!,
    data[offset + 3]!,
  );
}

function readU16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, false);
}

function readS15Fixed16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(offset, false) / 65536;
}

function isIdentityMatrix(flat: readonly number[]): boolean {
  return (
    flat.length >= 9 &&
    flat[0] === 1 &&
    flat[1] === 0 &&
    flat[2] === 0 &&
    flat[3] === 0 &&
    flat[4] === 1 &&
    flat[5] === 0 &&
    flat[6] === 0 &&
    flat[7] === 0 &&
    flat[8] === 1
  );
}

function curvesAreIdentity(curves: readonly CmsToneCurve[]): boolean {
  return curves.every((curve) => curve.parametricType === 1 && curve.params?.[0] === 1);
}

function buildPipelineFromLut16(tag: CmsLut16TagValue): CmsPipeline {
  const stages: CmsPipelineStage[] = [];
  const inputCurves = Array.from({ length: tag.inputChannels }, (_, index) => {
    const start = index * tag.inputTableEntries;
    return cmsBuildTabulatedToneCurve16(tag.inputTableEntries, tag.inputTables.slice(start, start + tag.inputTableEntries));
  });
  const outputCurves = Array.from({ length: tag.outputChannels }, (_, index) => {
    const start = index * tag.outputTableEntries;
    return cmsBuildTabulatedToneCurve16(tag.outputTableEntries, tag.outputTables.slice(start, start + tag.outputTableEntries));
  });

  stages.push({ kind: "tone-curves", channels: tag.inputChannels, curves: inputCurves });

  if (!isIdentityMatrix(tag.matrix)) {
    stages.push({
      kind: "matrix",
      rows: 3,
      cols: 3,
      matrix: {
        v: [
          { n: [tag.matrix[0]!, tag.matrix[1]!, tag.matrix[2]!] },
          { n: [tag.matrix[3]!, tag.matrix[4]!, tag.matrix[5]!] },
          { n: [tag.matrix[6]!, tag.matrix[7]!, tag.matrix[8]!] },
        ],
      },
      offset: [0, 0, 0],
    });
  }

  stages.push({
    kind: "clut16",
    inputChannels: tag.inputChannels,
    outputChannels: tag.outputChannels,
    gridPoints: new Array(tag.inputChannels).fill(tag.gridPoints),
    values: tag.clutValues,
  });
  stages.push({ kind: "tone-curves", channels: tag.outputChannels, curves: outputCurves });

  return {
    inputChannels: tag.inputChannels,
    outputChannels: tag.outputChannels,
    stages,
  };
}

function buildPipelineFromLut8(tag: CmsLut8TagValue): CmsPipeline {
  const stages: CmsPipelineStage[] = [];
  const inputCurves = Array.from({ length: tag.inputChannels }, (_, index) =>
    cmsBuildTabulatedToneCurve16(
      256,
      Array.from(tag.inputTables.slice(index * 256, (index + 1) * 256), (value) => value * 257),
    ),
  );
  const outputCurves = Array.from({ length: tag.outputChannels }, (_, index) =>
    cmsBuildTabulatedToneCurve16(
      256,
      Array.from(tag.outputTables.slice(index * 256, (index + 1) * 256), (value) => value * 257),
    ),
  );

  stages.push({ kind: "tone-curves", channels: tag.inputChannels, curves: inputCurves });

  if (!isIdentityMatrix(tag.matrix)) {
    stages.push({
      kind: "matrix",
      rows: 3,
      cols: 3,
      matrix: {
        v: [
          { n: [tag.matrix[0]!, tag.matrix[1]!, tag.matrix[2]!] },
          { n: [tag.matrix[3]!, tag.matrix[4]!, tag.matrix[5]!] },
          { n: [tag.matrix[6]!, tag.matrix[7]!, tag.matrix[8]!] },
        ],
      },
      offset: [0, 0, 0],
    });
  }

  stages.push({
    kind: "clut8",
    inputChannels: tag.inputChannels,
    outputChannels: tag.outputChannels,
    gridPoints: new Array(tag.inputChannels).fill(tag.gridPoints),
    values: tag.clutValues,
  });
  stages.push({ kind: "tone-curves", channels: tag.outputChannels, curves: outputCurves });

  return {
    inputChannels: tag.inputChannels,
    outputChannels: tag.outputChannels,
    stages,
  };
}

function parseCurveBlockSet(payload: Uint8Array, offset: number, channels: number): readonly CmsToneCurve[] {
  const curves: CmsToneCurve[] = [];
  let cursor = offset;

  for (let i = 0; i < channels; i += 1) {
    const type = readSignature(payload, cursor);

    if (type === "curv") {
      const count = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(cursor + 8, false);
      if (count === 0) {
        curves.push(cmsBuildParametricToneCurve(1, [1]));
        cursor += 12;
        continue;
      }
      if (count === 1) {
        curves.push(cmsBuildParametricToneCurve(1, [readU16(payload, cursor + 12) / 256]));
        cursor += 14;
        continue;
      }
      const values = new Uint16Array(count);
      for (let j = 0; j < count; j += 1) {
        values[j] = readU16(payload, cursor + 12 + j * 2);
      }
      curves.push(cmsBuildTabulatedToneCurve16(count, values));
      cursor += 12 + count * 2;
      continue;
    }

    if (type === "para") {
      const functionType = readU16(payload, cursor + 8);
      const paramCount = [1, 3, 4, 5, 7][functionType];
      if (paramCount === undefined) {
        throw new Error(`Unsupported parametric curve function type ${functionType} in MPE curve block`);
      }
      const params: number[] = [];
      for (let j = 0; j < paramCount; j += 1) {
        params.push(readS15Fixed16(payload, cursor + 12 + j * 4));
      }
      curves.push(cmsBuildParametricToneCurve(functionType + 1, params));
      cursor += 12 + paramCount * 4;
      continue;
    }

    throw new Error(`Unsupported MPE curve block type ${JSON.stringify(type)}`);
  }

  return curves;
}

function parseMatrixStage(payload: Uint8Array, offset: number): CmsPipelineStage {
  const values = Array.from({ length: 12 }, (_, index) => readS15Fixed16(payload, offset + index * 4));
  return {
    kind: "matrix",
    rows: 3,
    cols: 3,
    matrix: {
      v: [
        { n: [values[0]!, values[1]!, values[2]!] },
        { n: [values[3]!, values[4]!, values[5]!] },
        { n: [values[6]!, values[7]!, values[8]!] },
      ],
    },
    offset: [values[9]!, values[10]!, values[11]!],
  };
}

function parseClutStage(
  payload: Uint8Array,
  offset: number,
  inputChannels: number,
  outputChannels: number,
): CmsPipelineStage {
  const gridPoints = Array.from({ length: inputChannels }, (_, index) => payload[offset + index]!);
  const precision = payload[offset + 16]!;
  const pointCount = gridPoints.reduce((acc, value) => acc * value, 1);
  const valueCount = pointCount * outputChannels;
  const dataOffset = offset + 20;

  if (precision === 1) {
    return {
      kind: "clut8",
      inputChannels,
      outputChannels,
      gridPoints,
      values: payload.slice(dataOffset, dataOffset + valueCount),
    };
  }

  const values = new Uint16Array(valueCount);
  for (let i = 0; i < valueCount; i += 1) {
    values[i] = readU16(payload, dataOffset + i * 2);
  }
  return {
    kind: "clut16",
    inputChannels,
    outputChannels,
    gridPoints,
    values,
  };
}

function buildPipelineFromMpe(tag: CmsMultiProcessElementTagValue, payload: Uint8Array): CmsPipeline {
  const stages: CmsPipelineStage[] = [];
  const curveChannels = tag.kind === "mAB" ? tag.outputChannels : tag.inputChannels;
  const aCurveChannels = tag.kind === "mAB" ? tag.inputChannels : tag.outputChannels;

  if (tag.hasBcurves) {
    const curves = parseCurveBlockSet(payload, tag.offsets.bCurves, curveChannels);
    if (!curvesAreIdentity(curves)) {
      stages.push({ kind: "tone-curves", channels: curveChannels, curves });
    }
  }

  if (tag.hasMatrix) {
    stages.push(parseMatrixStage(payload, tag.offsets.matrix));
  }

  if (tag.hasMcurves) {
    const curves = parseCurveBlockSet(payload, tag.offsets.mCurves, curveChannels);
    if (!curvesAreIdentity(curves)) {
      stages.push({ kind: "tone-curves", channels: curveChannels, curves });
    }
  }

  if (tag.hasClut) {
    stages.push(parseClutStage(payload, tag.offsets.clut, tag.inputChannels, tag.outputChannels));
  }

  if (tag.hasAcurves) {
    const curves = parseCurveBlockSet(payload, tag.offsets.aCurves, aCurveChannels);
    if (!curvesAreIdentity(curves)) {
      stages.push({ kind: "tone-curves", channels: aCurveChannels, curves });
    }
  }

  return {
    inputChannels: tag.inputChannels,
    outputChannels: tag.outputChannels,
    stages,
  };
}

export function buildPipelineFromTag(data: Uint8Array, tag: CmsIccTagEntry): CmsPipeline {
  const parsed = parseIccLutTag(data, tag);

  switch (parsed.kind) {
    case "mft2":
      return buildPipelineFromLut16(parsed);
    case "mft1":
      return buildPipelineFromLut8(parsed);
    case "mAB":
    case "mBA":
      return buildPipelineFromMpe(parsed, data.slice(tag.offset, tag.offset + tag.size));
  }
}

function evaluateToneCurveStage(stage: Extract<CmsPipelineStage, { kind: "tone-curves" }>, input: readonly number[]): number[] {
  return stage.curves.map((curve, index) => cmsEvalToneCurveFloat(curve, input[index] ?? 0));
}

function evaluateMatrixStage(stage: Extract<CmsPipelineStage, { kind: "matrix" }>, input: readonly number[]): number[] {
  const result = cmsMAT3eval(stage.matrix, cmsVEC3init(input[0] ?? 0, input[1] ?? 0, input[2] ?? 0));
  return [
    clampUnit(result.n[0] + (stage.offset[0] ?? 0)),
    clampUnit(result.n[1] + (stage.offset[1] ?? 0)),
    clampUnit(result.n[2] + (stage.offset[2] ?? 0)),
  ];
}

function computeStrides(gridPoints: readonly number[], outputChannels: number): number[] {
  const strides = new Array(gridPoints.length).fill(0);
  let stride = outputChannels;

  for (let i = gridPoints.length - 1; i >= 0; i -= 1) {
    strides[i] = stride;
    stride *= gridPoints[i]!;
  }

  return strides;
}

function sampleClutValue(
  values: ArrayLike<number>,
  strides: readonly number[],
  coords: readonly number[],
  outputIndex: number,
): number {
  let index = outputIndex;
  for (let i = 0; i < coords.length; i += 1) {
    index += coords[i]! * strides[i]!;
  }
  return values[index] ?? 0;
}

function evaluateClutStage(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" }>,
  input: readonly number[],
  interpolation: NonNullable<CmsPipelineEvalOptions["interpolation"]>,
): number[] {
  if (interpolation !== "multilinear" && stage.inputChannels === 3) {
    return evaluateClutStageTetrahedral(stage, input);
  }

  return evaluateClutStageMultilinear(stage, input);
}

function evaluateClutStageMultilinear(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" }>,
  input: readonly number[],
): number[] {
  const output = new Array(stage.outputChannels).fill(0);
  const lowerCoords = stage.gridPoints.map((points, index) => {
    const scaled = clampUnit(input[index] ?? 0) * (points - 1);
    return Math.min(Math.floor(scaled), points - 1);
  });
  const fractions = stage.gridPoints.map((points, index) => {
    const scaled = clampUnit(input[index] ?? 0) * (points - 1);
    const lower = Math.min(Math.floor(scaled), points - 1);
    return lower >= points - 1 ? 0 : scaled - lower;
  });
  const strides = computeStrides(stage.gridPoints, stage.outputChannels);
  const vertices = 1 << stage.inputChannels;

  for (let vertex = 0; vertex < vertices; vertex += 1) {
    const coords = lowerCoords.slice();
    let weight = 1;

    for (let axis = 0; axis < stage.inputChannels; axis += 1) {
      const useUpper = (vertex & (1 << axis)) !== 0;
      const points = stage.gridPoints[axis]!;
      const fraction = fractions[axis]!;

      if (useUpper) {
        coords[axis] = Math.min(coords[axis]! + 1, points - 1);
        weight *= fraction;
      } else {
        weight *= 1 - fraction;
      }
    }

    for (let outIndex = 0; outIndex < stage.outputChannels; outIndex += 1) {
      output[outIndex] += weight * sampleClutValue(stage.values, strides, coords, outIndex);
    }
  }

  const scale = stage.kind === "clut8" ? 255 : 65535;
  return output.map((value) => clampUnit(value / scale));
}

function evaluateClutStageTetrahedral(
  stage: Extract<CmsPipelineStage, { kind: "clut8" | "clut16" }>,
  input: readonly number[],
): number[] {
  const [gx, gy, gz] = stage.gridPoints;
  const px = clampUnit(input[0] ?? 0) * (gx! - 1);
  const py = clampUnit(input[1] ?? 0) * (gy! - 1);
  const pz = clampUnit(input[2] ?? 0) * (gz! - 1);

  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const z0 = Math.floor(pz);
  const rx = px - x0;
  const ry = py - y0;
  const rz = pz - z0;

  const x1 = x0 + (clampUnit(input[0] ?? 0) >= 1 ? 0 : 1);
  const y1 = y0 + (clampUnit(input[1] ?? 0) >= 1 ? 0 : 1);
  const z1 = z0 + (clampUnit(input[2] ?? 0) >= 1 ? 0 : 1);
  const strides = computeStrides(stage.gridPoints, stage.outputChannels);
  const scale = stage.kind === "clut8" ? 255 : 65535;
  const output = new Array(stage.outputChannels).fill(0);

  for (let outIndex = 0; outIndex < stage.outputChannels; outIndex += 1) {
    const dens = (x: number, y: number, z: number) =>
      sampleClutValue(stage.values, strides, [x, y, z], outIndex) / scale;

    const c0 = dens(x0, y0, z0);
    let c1 = 0;
    let c2 = 0;
    let c3 = 0;

    if (rx >= ry && ry >= rz) {
      c1 = dens(x1, y0, z0) - c0;
      c2 = dens(x1, y1, z0) - dens(x1, y0, z0);
      c3 = dens(x1, y1, z1) - dens(x1, y1, z0);
    } else if (rx >= rz && rz >= ry) {
      c1 = dens(x1, y0, z0) - c0;
      c2 = dens(x1, y1, z1) - dens(x1, y0, z1);
      c3 = dens(x1, y0, z1) - dens(x1, y0, z0);
    } else if (rz >= rx && rx >= ry) {
      c1 = dens(x1, y0, z1) - dens(x0, y0, z1);
      c2 = dens(x1, y1, z1) - dens(x1, y0, z1);
      c3 = dens(x0, y0, z1) - c0;
    } else if (ry >= rx && rx >= rz) {
      c1 = dens(x1, y1, z0) - dens(x0, y1, z0);
      c2 = dens(x0, y1, z0) - c0;
      c3 = dens(x1, y1, z1) - dens(x1, y1, z0);
    } else if (ry >= rz && rz >= rx) {
      c1 = dens(x1, y1, z1) - dens(x0, y1, z1);
      c2 = dens(x0, y1, z0) - c0;
      c3 = dens(x0, y1, z1) - dens(x0, y1, z0);
    } else if (rz >= ry && ry >= rx) {
      c1 = dens(x1, y1, z1) - dens(x0, y1, z1);
      c2 = dens(x0, y1, z1) - dens(x0, y0, z1);
      c3 = dens(x0, y0, z1) - c0;
    }

    output[outIndex] = clampUnit(c0 + c1 * rx + c2 * ry + c3 * rz);
  }

  return output;
}

export function cmsPipelineEvalFloat(
  input: readonly number[],
  pipeline: CmsPipeline,
  options: CmsPipelineEvalOptions = {},
): number[] {
  const interpolation = options.interpolation ?? "auto";
  let current = [...input];

  for (const stage of pipeline.stages) {
    switch (stage.kind) {
      case "tone-curves":
        current = evaluateToneCurveStage(stage, current);
        break;
      case "matrix":
        current = evaluateMatrixStage(stage, current);
        break;
      case "clut8":
      case "clut16":
        current = evaluateClutStage(stage, current, interpolation);
        break;
    }
  }

  return current;
}
