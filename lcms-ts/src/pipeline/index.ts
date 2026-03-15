import { CMS_D50_XYZ } from "../color/conversions.js";
import type { CmsMAT3 } from "../math/matrix.js";
import { cmsMAT3inverse } from "../math/matrix.js";
import {
  cmsGetDeviceClass,
  cmsGetColorSpace,
  cmsGetPCS,
  cmsIsTag,
  cmsReadTag,
  INTENT_ABSOLUTE_COLORIMETRIC,
  INTENT_PERCEPTUAL,
  type CmsProfile,
} from "../profile/profile.js";
import {
  parseIccLutTag,
  type CmsLut16TagValue,
  type CmsLut8TagValue,
  type CmsMultiProcessElementTagValue,
} from "../profile/lut.js";
import type { CmsIccTagEntry } from "../profile/tag-table.js";
import { cmsBuildParametricToneCurve, cmsReverseToneCurve, cmsBuildTabulatedToneCurve16, cmsEvalToneCurveFloat, type CmsToneCurve } from "../tone-curve/index.js";
import type { CmsCurveTagValue, CmsParsedTagValue, CmsXyzTagValue } from "../profile/tags.js";

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
      readonly matrix: readonly number[];
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
      matrix: tag.matrix,
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
      matrix: tag.matrix,
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

function matrixStageFromValues(matrix: readonly number[], offset: readonly number[]): CmsPipelineStage {
  return {
    kind: "matrix",
    rows: 3,
    cols: 3,
    matrix,
    offset,
  };
}

function buildPipelineFromMpe(tag: CmsMultiProcessElementTagValue): CmsPipeline {
  const stages: CmsPipelineStage[] = [];
  if (tag.bCurves && !curvesAreIdentity(tag.bCurves)) {
    stages.push({ kind: "tone-curves", channels: tag.bCurves.length, curves: tag.bCurves });
  }

  if (tag.matrixValues && tag.matrixOffsetValues) {
    stages.push(matrixStageFromValues(tag.matrixValues, tag.matrixOffsetValues));
  }

  if (tag.mCurves && !curvesAreIdentity(tag.mCurves)) {
    stages.push({ kind: "tone-curves", channels: tag.mCurves.length, curves: tag.mCurves });
  }

  if (tag.clutGridPoints && tag.clutValuesParsed) {
    if (tag.clutValuesParsed instanceof Uint8Array) {
      stages.push({
        kind: "clut8",
        inputChannels: tag.inputChannels,
        outputChannels: tag.outputChannels,
        gridPoints: tag.clutGridPoints,
        values: tag.clutValuesParsed,
      });
    } else {
      stages.push({
        kind: "clut16",
        inputChannels: tag.inputChannels,
        outputChannels: tag.outputChannels,
        gridPoints: tag.clutGridPoints,
        values: tag.clutValuesParsed,
      });
    }
  }

  if (tag.aCurves && !curvesAreIdentity(tag.aCurves)) {
    stages.push({ kind: "tone-curves", channels: tag.aCurves.length, curves: tag.aCurves });
  }

  return {
    inputChannels: tag.inputChannels,
    outputChannels: tag.outputChannels,
    stages,
  };
}

export function buildPipelineFromParsedTag(tag: Extract<CmsParsedTagValue, CmsLut16TagValue | CmsLut8TagValue | CmsMultiProcessElementTagValue>): CmsPipeline {
  switch (tag.kind) {
    case "mft2":
      return buildPipelineFromLut16(tag);
    case "mft1":
      return buildPipelineFromLut8(tag);
    case "mAB":
    case "mBA":
      return buildPipelineFromMpe(tag);
  }
}

export function buildPipelineFromTag(data: Uint8Array, tag: CmsIccTagEntry): CmsPipeline {
  const parsed = parseIccLutTag(data, tag);
  return buildPipelineFromParsedTag(parsed);
}

function evaluateToneCurveStage(stage: Extract<CmsPipelineStage, { kind: "tone-curves" }>, input: readonly number[]): number[] {
  return stage.curves.map((curve, index) => cmsEvalToneCurveFloat(curve, input[index] ?? 0));
}

function evaluateMatrixStage(stage: Extract<CmsPipelineStage, { kind: "matrix" }>, input: readonly number[]): number[] {
  return Array.from({ length: stage.rows }, (_, row) => {
    let value = stage.offset[row] ?? 0;
    for (let col = 0; col < stage.cols; col += 1) {
      value += (stage.matrix[row * stage.cols + col] ?? 0) * (input[col] ?? 0);
    }
    return clampUnit(value);
  });
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

const DEVICE_TO_PCS_16 = ["A2B0", "A2B1", "A2B2", "A2B1"] as const;
const PCS_TO_DEVICE_16 = ["B2A0", "B2A1", "B2A2", "B2A1"] as const;

export function cmsReadInputLUT(profile: CmsProfile, intent: number): CmsPipeline | null {
  if (intent <= INTENT_ABSOLUTE_COLORIMETRIC) {
    let signature = DEVICE_TO_PCS_16[intent] ?? DEVICE_TO_PCS_16[INTENT_PERCEPTUAL];
    if (!cmsIsTag(profile, signature)) {
      signature = DEVICE_TO_PCS_16[INTENT_PERCEPTUAL];
    }

    const tag = cmsReadTag(profile, signature);
    if (tag && isLutTag(tag)) {
      return buildPipelineFromParsedTag(tag);
    }
  }

  if (cmsGetColorSpace(profile) === "GRAY") {
    return buildGrayInputMatrixPipeline(profile);
  }

  return cmsGetColorSpace(profile) === "RGB " ? buildRgbInputMatrixShaper(profile) : null;
}

export function cmsReadOutputLUT(profile: CmsProfile, intent: number): CmsPipeline | null {
  if (intent <= INTENT_ABSOLUTE_COLORIMETRIC) {
    let signature = PCS_TO_DEVICE_16[intent] ?? PCS_TO_DEVICE_16[INTENT_PERCEPTUAL];
    if (!cmsIsTag(profile, signature)) {
      signature = PCS_TO_DEVICE_16[INTENT_PERCEPTUAL];
    }

    const tag = cmsReadTag(profile, signature);
    if (tag && isLutTag(tag)) {
      return buildPipelineFromParsedTag(tag);
    }
  }

  if (cmsGetColorSpace(profile) === "GRAY") {
    return buildGrayOutputPipeline(profile);
  }

  return cmsGetColorSpace(profile) === "RGB " ? buildRgbOutputMatrixShaper(profile) : null;
}

export function cmsReadDevicelinkLUT(profile: CmsProfile, intent: number): CmsPipeline | null {
  if (cmsGetDeviceClass(profile) !== "link" || intent > INTENT_ABSOLUTE_COLORIMETRIC) {
    return null;
  }

  let signature = DEVICE_TO_PCS_16[intent] ?? DEVICE_TO_PCS_16[INTENT_PERCEPTUAL];
  if (!cmsIsTag(profile, signature)) {
    signature = DEVICE_TO_PCS_16[INTENT_PERCEPTUAL];
  }

  const tag = cmsReadTag(profile, signature);
  return tag && isLutTag(tag) ? buildPipelineFromParsedTag(tag) : null;
}

function isLutTag(tag: CmsParsedTagValue): tag is CmsLut16TagValue | CmsLut8TagValue | CmsMultiProcessElementTagValue {
  return tag.kind === "mft1" || tag.kind === "mft2" || tag.kind === "mAB" || tag.kind === "mBA";
}

function buildRgbInputMatrixShaper(profile: CmsProfile): CmsPipeline | null {
  const rXyz = cmsReadTag(profile, "rXYZ");
  const gXyz = cmsReadTag(profile, "gXYZ");
  const bXyz = cmsReadTag(profile, "bXYZ");
  const rTrc = cmsReadTag(profile, "rTRC");
  const gTrc = cmsReadTag(profile, "gTRC");
  const bTrc = cmsReadTag(profile, "bTRC");

  if (!isXyzTag(rXyz) || !isXyzTag(gXyz) || !isXyzTag(bXyz) || !isCurveLikeTag(rTrc) || !isCurveLikeTag(gTrc) || !isCurveLikeTag(bTrc)) {
    return null;
  }

  const stages: CmsPipelineStage[] = [
    {
      kind: "tone-curves",
      channels: 3,
      curves: [extractCurve(rTrc), extractCurve(gTrc), extractCurve(bTrc)],
    },
    {
      kind: "matrix",
      rows: 3,
      cols: 3,
      matrix: [
        rXyz.value.X,
        gXyz.value.X,
        bXyz.value.X,
        rXyz.value.Y,
        gXyz.value.Y,
        bXyz.value.Y,
        rXyz.value.Z,
        gXyz.value.Z,
        bXyz.value.Z,
      ],
      offset: [0, 0, 0],
    },
  ];

  return {
    inputChannels: 3,
    outputChannels: 3,
    stages,
  };
}

function buildRgbOutputMatrixShaper(profile: CmsProfile): CmsPipeline | null {
  const input = buildRgbInputMatrixShaper(profile);
  if (!input) {
    return null;
  }

  const matrix = input.stages.find((stage) => stage.kind === "matrix");
  const curves = input.stages.find((stage) => stage.kind === "tone-curves");
  if (!matrix || !curves) {
    return null;
  }

  const matrix3 = matrixStageToMat3(matrix);
  if (!matrix3) {
    return null;
  }

  const inverse = cmsMAT3inverse(matrix3);
  if (!inverse) {
    return null;
  }

  return {
    inputChannels: 3,
    outputChannels: 3,
    stages: [
      {
        kind: "matrix",
        rows: 3,
        cols: 3,
        matrix: flattenMat3(inverse),
        offset: [0, 0, 0],
      },
      {
        kind: "tone-curves",
        channels: 3,
        curves: curves.curves.map((curve) => cmsReverseToneCurve(curve)),
      },
    ],
  };
}

function buildGrayInputMatrixPipeline(profile: CmsProfile): CmsPipeline | null {
  const grayTrc = cmsReadTag(profile, "kTRC");
  if (!isCurveLikeTag(grayTrc)) {
    return null;
  }

  const curve = extractCurve(grayTrc);

  if (cmsGetPCS(profile) === "Lab ") {
    return {
      inputChannels: 1,
      outputChannels: 3,
      stages: [
        {
          kind: "tone-curves",
          channels: 1,
          curves: [curve],
        },
        {
          kind: "matrix",
          rows: 3,
          cols: 1,
          matrix: [1, 0, 0],
          offset: [0, 0.5, 0.5],
        },
      ],
    };
  }

  return {
    inputChannels: 1,
    outputChannels: 3,
    stages: [
      {
        kind: "tone-curves",
        channels: 1,
        curves: [curve],
      },
      {
        kind: "matrix",
        rows: 3,
        cols: 1,
        matrix: [CMS_D50_XYZ.X, CMS_D50_XYZ.Y, CMS_D50_XYZ.Z],
        offset: [0, 0, 0],
      },
    ],
  };
}

function buildGrayOutputPipeline(profile: CmsProfile): CmsPipeline | null {
  const grayTrc = cmsReadTag(profile, "kTRC");
  if (!isCurveLikeTag(grayTrc)) {
    return null;
  }

  const reverse = cmsReverseToneCurve(extractCurve(grayTrc));
  const matrix =
    cmsGetPCS(profile) === "Lab "
      ? [1, 0, 0]
      : [0, 1 / CMS_D50_XYZ.Y, 0];

  return {
    inputChannels: 3,
    outputChannels: 1,
    stages: [
      {
        kind: "matrix",
        rows: 1,
        cols: 3,
        matrix,
        offset: [0],
      },
      {
        kind: "tone-curves",
        channels: 1,
        curves: [reverse],
      },
    ],
  };
}

function flattenMat3(matrix: CmsMAT3): readonly number[] {
  return [
    matrix.v[0]!.n[0]!,
    matrix.v[0]!.n[1]!,
    matrix.v[0]!.n[2]!,
    matrix.v[1]!.n[0]!,
    matrix.v[1]!.n[1]!,
    matrix.v[1]!.n[2]!,
    matrix.v[2]!.n[0]!,
    matrix.v[2]!.n[1]!,
    matrix.v[2]!.n[2]!,
  ];
}

function matrixStageToMat3(stage: Extract<CmsPipelineStage, { kind: "matrix" }>): CmsMAT3 | null {
  if (stage.rows !== 3 || stage.cols !== 3 || stage.matrix.length < 9) {
    return null;
  }

  return {
    v: [
      { n: [stage.matrix[0]!, stage.matrix[1]!, stage.matrix[2]!] },
      { n: [stage.matrix[3]!, stage.matrix[4]!, stage.matrix[5]!] },
      { n: [stage.matrix[6]!, stage.matrix[7]!, stage.matrix[8]!] },
    ],
  };
}

function isXyzTag(tag: CmsParsedTagValue | undefined): tag is CmsXyzTagValue {
  return tag?.kind === "XYZ";
}

function isCurveLikeTag(tag: CmsParsedTagValue | undefined): tag is CmsCurveTagValue | Extract<CmsParsedTagValue, { kind: "para" }> {
  return tag?.kind === "curv" || tag?.kind === "para";
}

function extractCurve(tag: CmsCurveTagValue | Extract<CmsParsedTagValue, { kind: "para" }>): CmsToneCurve {
  return tag.curve;
}
