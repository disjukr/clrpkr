import type { CmsContext } from "../core/context.js";
import { CMS_D50_XYZ, cmsLab2XYZ, cmsXYZ2Lab } from "../color/conversions.js";
import {
  _cmsFormatterIsFloat,
  cmsChannelsOfColorSpace,
  packChunky16To8,
  packChunkyFloat32,
  T_CHANNELS,
  T_EXTRA,
  unpackChunky8To16,
  unpackChunkyFloat32,
} from "../format/packing.js";
import { cmsPipelineEvalFloat, cmsReadDevicelinkLUT, cmsReadInputLUT, cmsReadOutputLUT, type CmsPipeline } from "../pipeline/index.js";
import {
  cmsGetColorSpace,
  cmsGetPCS,
  INTENT_ABSOLUTE_COLORIMETRIC,
  type CmsProfile,
} from "../profile/profile.js";
import type { CmsHandle } from "../types/primitives.js";

export const cmsFLAGS_NOCACHE = 0x0040;
export const cmsFLAGS_NULLTRANSFORM = 0x0200;
export const cmsFLAGS_COPY_ALPHA = 0x04000000;

export interface CmsTransform extends CmsHandle<"transform"> {
  readonly context: CmsContext | null;
  readonly inputProfile: CmsProfile;
  readonly outputProfile: CmsProfile | null;
  readonly inputFormat: number;
  readonly outputFormat: number;
  readonly intent: number;
  readonly flags: number;
  readonly inputPipeline: CmsPipeline | null;
  readonly outputPipeline: CmsPipeline | null;
  readonly devicelinkPipeline: CmsPipeline | null;
}

let nextTransformId = 1;

function clampUnit(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function normalizeLab(values: ArrayLike<number>): readonly number[] {
  return [
    clampUnit((values[0] ?? 0) / 100),
    clampUnit(((values[1] ?? 0) + 128) / 255),
    clampUnit(((values[2] ?? 0) + 128) / 255),
  ];
}

function bridgePCS(values: ArrayLike<number>, inputPCS: string, outputPCS: string): number[] {
  if (inputPCS === outputPCS) {
    return Array.from(values);
  }

  if (inputPCS === "Lab " && outputPCS === "XYZ ") {
    const xyz = cmsLab2XYZ(CMS_D50_XYZ, {
      L: clampUnit(values[0] ?? 0) * 100,
      a: clampUnit(values[1] ?? 0) * 255 - 128,
      b: clampUnit(values[2] ?? 0) * 255 - 128,
    });
    return [xyz.X, xyz.Y, xyz.Z];
  }

  if (inputPCS === "XYZ " && outputPCS === "Lab ") {
    const lab = cmsXYZ2Lab(CMS_D50_XYZ, {
      X: values[0] ?? 0,
      Y: values[1] ?? 0,
      Z: values[2] ?? 0,
    });
    return Array.from(normalizeLab([lab.L, lab.a, lab.b]));
  }

  throw new Error(`Unsupported PCS bridge ${JSON.stringify(inputPCS)} -> ${JSON.stringify(outputPCS)}`);
}

function decodePixel(format: number, source: Uint8Array | Float32Array, pixelIndex: number): Float32Array {
  const stride = T_CHANNELS(format) + T_EXTRA(format);

  if (_cmsFormatterIsFloat(format)) {
    if (!(source instanceof Float32Array)) {
      throw new Error("Float format requires Float32Array input");
    }
    return unpackChunkyFloat32(format, source.subarray(pixelIndex * stride, (pixelIndex + 1) * stride));
  }

  if (!(source instanceof Uint8Array)) {
    throw new Error("Integer format requires Uint8Array input");
  }

  const words = unpackChunky8To16(format, source.subarray(pixelIndex * stride, (pixelIndex + 1) * stride));
  return Float32Array.from(words, (value) => value / 65535);
}

function copyAlpha(
  inputFormat: number,
  outputFormat: number,
  source: Uint8Array | Float32Array,
  target: Uint8Array | Float32Array,
  pixelIndex: number,
): void {
  const inputExtra = T_EXTRA(inputFormat);
  const outputExtra = T_EXTRA(outputFormat);
  if (inputExtra === 0 || inputExtra !== outputExtra) {
    return;
  }

  const inputStride = T_CHANNELS(inputFormat) + inputExtra;
  const outputStride = T_CHANNELS(outputFormat) + outputExtra;
  const inputSwapFirst = ((inputFormat >> 14) & 1) !== 0;
  const outputSwapFirst = ((outputFormat >> 14) & 1) !== 0;
  const sourceOffset = pixelIndex * inputStride + (inputSwapFirst ? 0 : T_CHANNELS(inputFormat));
  const targetOffset = pixelIndex * outputStride + (outputSwapFirst ? 0 : T_CHANNELS(outputFormat));

  for (let i = 0; i < inputExtra; i += 1) {
    target[targetOffset + i] = source[sourceOffset + i] as never;
  }
}

function encodePixel(
  format: number,
  target: Uint8Array | Float32Array,
  pixelIndex: number,
  values: readonly number[],
): void {
  const stride = T_CHANNELS(format) + T_EXTRA(format);

  if (_cmsFormatterIsFloat(format)) {
    if (!(target instanceof Float32Array)) {
      throw new Error("Float format requires Float32Array output");
    }
    target.set(packChunkyFloat32(format, values), pixelIndex * stride);
    return;
  }

  if (!(target instanceof Uint8Array)) {
    throw new Error("Integer format requires Uint8Array output");
  }

  target.set(
    packChunky16To8(
      format,
      values.map((value) => Math.round(clampUnit(value) * 65535)),
    ),
    pixelIndex * stride,
  );
}

function validateFormatAgainstProfile(profile: CmsProfile, format: number, role: "input" | "output"): void {
  const expectedChannels = cmsChannelsOfColorSpace(role === "input" ? cmsGetColorSpace(profile) : cmsGetColorSpace(profile));
  const actualChannels = T_CHANNELS(format);
  if (expectedChannels >= 0 && actualChannels !== expectedChannels) {
    throw new Error(`Formatter channel count ${actualChannels} does not match ${role} profile channels ${expectedChannels}`);
  }
}

function evaluateTransformPixel(transform: CmsTransform, input: ArrayLike<number>): number[] {
  if ((transform.flags & cmsFLAGS_NULLTRANSFORM) !== 0) {
    return Array.from(input);
  }

  if (transform.devicelinkPipeline) {
    return cmsPipelineEvalFloat(Array.from(input), transform.devicelinkPipeline);
  }

  if (!transform.inputPipeline || !transform.outputPipeline || !transform.outputProfile) {
    throw new Error("Transform pipeline is not initialized");
  }

  const pcsValues = cmsPipelineEvalFloat(Array.from(input), transform.inputPipeline);
  const bridged = bridgePCS(pcsValues, cmsGetPCS(transform.inputProfile), cmsGetPCS(transform.outputProfile));
  return cmsPipelineEvalFloat(bridged, transform.outputPipeline);
}

export function cmsCreateTransformTHR(
  context: CmsContext | null,
  input: CmsProfile,
  inputFormat: number,
  output: CmsProfile | null,
  outputFormat: number,
  intent: number,
  flags: number,
): CmsTransform {
  validateFormatAgainstProfile(input, inputFormat, "input");
  if (output) {
    validateFormatAgainstProfile(output, outputFormat, "output");
  }

  const devicelinkPipeline = output == null ? cmsReadDevicelinkLUT(input, intent) : null;
  const inputPipeline =
    (flags & cmsFLAGS_NULLTRANSFORM) !== 0 || output == null ? null : cmsReadInputLUT(input, intent <= INTENT_ABSOLUTE_COLORIMETRIC ? intent : 0);
  const outputPipeline =
    (flags & cmsFLAGS_NULLTRANSFORM) !== 0 || output == null ? null : cmsReadOutputLUT(output, intent <= INTENT_ABSOLUTE_COLORIMETRIC ? intent : 0);

  if ((flags & cmsFLAGS_NULLTRANSFORM) === 0 && !devicelinkPipeline && (!inputPipeline || !outputPipeline || !output)) {
    throw new Error("Unable to build transform pipelines for the requested profiles");
  }

  return {
    id: `transform-${nextTransformId++}`,
    kind: "transform",
    context,
    inputProfile: input,
    outputProfile: output,
    inputFormat,
    outputFormat,
    intent,
    flags,
    inputPipeline,
    outputPipeline,
    devicelinkPipeline,
  };
}

export function cmsCreateTransform(
  input: CmsProfile,
  inputFormat: number,
  output: CmsProfile | null,
  outputFormat: number,
  intent: number,
  flags: number,
): CmsTransform {
  return cmsCreateTransformTHR(null, input, inputFormat, output, outputFormat, intent, flags);
}

export function cmsDeleteTransform(_transform: CmsTransform): void {}

export function cmsDoTransform(
  transform: CmsTransform,
  inputBuffer: Uint8Array | Float32Array,
  outputBuffer: Uint8Array | Float32Array,
  size: number,
): void {
  for (let pixelIndex = 0; pixelIndex < size; pixelIndex += 1) {
    const decoded = decodePixel(transform.inputFormat, inputBuffer, pixelIndex);
    const output = evaluateTransformPixel(transform, decoded);
    encodePixel(transform.outputFormat, outputBuffer, pixelIndex, output);

    if ((transform.flags & cmsFLAGS_COPY_ALPHA) !== 0) {
      copyAlpha(transform.inputFormat, transform.outputFormat, inputBuffer, outputBuffer, pixelIndex);
    }
  }
}
