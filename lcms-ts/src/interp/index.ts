export const CMS_LERP_FLAGS_FLOAT = 0x0001;
export const CMS_LERP_FLAGS_TRILINEAR = 0x0100;

export type CmsInterpTable = Uint8Array | Uint16Array | Float32Array | readonly number[];

export interface CmsInterpParams {
  readonly dwFlags: number;
  readonly nInputs: number;
  readonly nOutputs: number;
  readonly nSamples: readonly number[];
  readonly domain: readonly number[];
  readonly opta: readonly number[];
  readonly table: CmsInterpTable;
}

export type CmsInterpMethod = "tetrahedral" | "trilinear";

function clampUnit(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function computeOpta(nSamples: readonly number[], nOutputs: number): number[] {
  const opta = new Array(nSamples.length).fill(0);
  let stride = nOutputs;

  for (let index = nSamples.length - 1; index >= 0; index -= 1) {
    opta[index] = stride;
    stride *= nSamples[index] ?? 1;
  }

  return opta;
}

export function _cmsComputeInterpParamsEx(
  nSamples: readonly number[],
  inputChannels: number,
  outputChannels: number,
  table: CmsInterpTable,
  dwFlags: number,
): CmsInterpParams {
  const samples = nSamples.slice(0, inputChannels);
  if (samples.length !== inputChannels) {
    throw new Error(`Expected ${inputChannels} sample dimensions, got ${samples.length}`);
  }

  if (inputChannels <= 0) {
    throw new Error("Interpolation requires at least one input channel");
  }
  if (outputChannels <= 0) {
    throw new Error("Interpolation requires at least one output channel");
  }
  if (samples.some((sample) => sample <= 0)) {
    throw new Error("Interpolation sample counts must be positive");
  }

  return {
    dwFlags,
    nInputs: inputChannels,
    nOutputs: outputChannels,
    nSamples: samples,
    domain: samples.map((sample) => sample - 1),
    opta: computeOpta(samples, outputChannels),
    table,
  };
}

export function _cmsComputeInterpParams(
  nSamplesPerInput: number,
  inputChannels: number,
  outputChannels: number,
  table: CmsInterpTable,
  dwFlags: number,
): CmsInterpParams {
  return _cmsComputeInterpParamsEx(
    new Array(inputChannels).fill(nSamplesPerInput),
    inputChannels,
    outputChannels,
    table,
    dwFlags,
  );
}

export function _cmsFreeInterpParams(_params: CmsInterpParams): void {
  // No-op in TypeScript; retained for upstream structure parity.
}

function sampleValue(table: ArrayLike<number>, baseOffset: number, coords: readonly number[], opta: readonly number[], outputIndex: number): number {
  let index = baseOffset + outputIndex;
  for (let axis = 0; axis < coords.length; axis += 1) {
    index += (coords[axis] ?? 0) * (opta[axis] ?? 0);
  }
  return table[index] ?? 0;
}

function scaleForTable(table: CmsInterpTable): number {
  if (table instanceof Uint8Array) {
    return 255;
  }
  if (table instanceof Uint16Array) {
    return 65535;
  }
  return 1;
}

function evalLinear1D(
  input: readonly number[],
  params: CmsInterpParams,
  baseOffset: number,
  outputScale: number,
): number[] {
  const scaled = clampUnit(input[0] ?? 0) * (params.domain[0] ?? 0);
  const lower = Math.floor(scaled);
  const upper = clampUnit(input[0] ?? 0) >= 1 ? lower : lower + 1;
  const fraction = scaled - lower;
  const output = new Array(params.nOutputs).fill(0);

  for (let outIndex = 0; outIndex < params.nOutputs; outIndex += 1) {
    const y0 = sampleValue(params.table, baseOffset, [lower], params.opta, outIndex) / outputScale;
    const y1 = sampleValue(params.table, baseOffset, [upper], params.opta, outIndex) / outputScale;
    output[outIndex] = y0 + (y1 - y0) * fraction;
  }

  return output;
}

function evalBilinear(
  input: readonly number[],
  params: CmsInterpParams,
  baseOffset: number,
  outputScale: number,
): number[] {
  const x = clampUnit(input[0] ?? 0) * (params.domain[0] ?? 0);
  const y = clampUnit(input[1] ?? 0) * (params.domain[1] ?? 0);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const x1 = clampUnit(input[0] ?? 0) >= 1 ? x0 : x0 + 1;
  const y1 = clampUnit(input[1] ?? 0) >= 1 ? y0 : y0 + 1;
  const output = new Array(params.nOutputs).fill(0);

  for (let outIndex = 0; outIndex < params.nOutputs; outIndex += 1) {
    const d00 = sampleValue(params.table, baseOffset, [x0, y0], params.opta, outIndex) / outputScale;
    const d01 = sampleValue(params.table, baseOffset, [x0, y1], params.opta, outIndex) / outputScale;
    const d10 = sampleValue(params.table, baseOffset, [x1, y0], params.opta, outIndex) / outputScale;
    const d11 = sampleValue(params.table, baseOffset, [x1, y1], params.opta, outIndex) / outputScale;
    const dx0 = d00 + (d10 - d00) * fx;
    const dx1 = d01 + (d11 - d01) * fx;
    output[outIndex] = dx0 + (dx1 - dx0) * fy;
  }

  return output;
}

function evalMultilinear(
  input: readonly number[],
  params: CmsInterpParams,
  baseOffset: number,
  outputScale: number,
): number[] {
  const lowerCoords = params.nSamples.map((points, index) => {
    const scaled = clampUnit(input[index] ?? 0) * (points - 1);
    return Math.min(Math.floor(scaled), points - 1);
  });
  const fractions = params.nSamples.map((points, index) => {
    const scaled = clampUnit(input[index] ?? 0) * (points - 1);
    const lower = Math.min(Math.floor(scaled), points - 1);
    return lower >= points - 1 ? 0 : scaled - lower;
  });
  const vertices = 1 << params.nInputs;
  const output = new Array(params.nOutputs).fill(0);

  for (let vertex = 0; vertex < vertices; vertex += 1) {
    const coords = lowerCoords.slice();
    let weight = 1;

    for (let axis = 0; axis < params.nInputs; axis += 1) {
      const useUpper = (vertex & (1 << axis)) !== 0;
      const fraction = fractions[axis] ?? 0;
      const points = params.nSamples[axis] ?? 1;

      if (useUpper) {
        coords[axis] = Math.min((coords[axis] ?? 0) + 1, points - 1);
        weight *= fraction;
      } else {
        weight *= 1 - fraction;
      }
    }

    for (let outIndex = 0; outIndex < params.nOutputs; outIndex += 1) {
      output[outIndex] += (sampleValue(params.table, baseOffset, coords, params.opta, outIndex) / outputScale) * weight;
    }
  }

  return output;
}

function evalTetrahedral3D(
  input: readonly number[],
  params: CmsInterpParams,
  baseOffset: number,
  outputScale: number,
): number[] {
  const x = clampUnit(input[0] ?? 0) * (params.domain[0] ?? 0);
  const y = clampUnit(input[1] ?? 0) * (params.domain[1] ?? 0);
  const z = clampUnit(input[2] ?? 0) * (params.domain[2] ?? 0);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const rx = x - x0;
  const ry = y - y0;
  const rz = z - z0;
  const x1 = clampUnit(input[0] ?? 0) >= 1 ? x0 : x0 + 1;
  const y1 = clampUnit(input[1] ?? 0) >= 1 ? y0 : y0 + 1;
  const z1 = clampUnit(input[2] ?? 0) >= 1 ? z0 : z0 + 1;
  const output = new Array(params.nOutputs).fill(0);

  for (let outIndex = 0; outIndex < params.nOutputs; outIndex += 1) {
    const dens = (ix: number, iy: number, iz: number) =>
      sampleValue(params.table, baseOffset, [ix, iy, iz], params.opta, outIndex) / outputScale;

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
    } else {
      c1 = dens(x1, y1, z1) - dens(x0, y1, z1);
      c2 = dens(x0, y1, z1) - dens(x0, y0, z1);
      c3 = dens(x0, y0, z1) - c0;
    }

    output[outIndex] = c0 + c1 * rx + c2 * ry + c3 * rz;
  }

  return output;
}

function evalRecursiveTetrahedral(
  input: readonly number[],
  params: CmsInterpParams,
  baseOffset: number,
  outputScale: number,
): number[] {
  if (params.nInputs === 1) {
    return evalLinear1D(input, params, baseOffset, outputScale);
  }
  if (params.nInputs === 2) {
    return evalBilinear(input, params, baseOffset, outputScale);
  }
  if (params.nInputs === 3) {
    return evalTetrahedral3D(input, params, baseOffset, outputScale);
  }

  const scaled = clampUnit(input[0] ?? 0) * (params.domain[0] ?? 0);
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  const upper = clampUnit(input[0] ?? 0) >= 1 ? lower : lower + 1;
  const lowerOffset = baseOffset + lower * (params.opta[0] ?? 0);
  const upperOffset = baseOffset + upper * (params.opta[0] ?? 0);
  const childParams: CmsInterpParams = {
    ...params,
    nInputs: params.nInputs - 1,
    nSamples: params.nSamples.slice(1),
    domain: params.domain.slice(1),
    opta: params.opta.slice(1),
  };
  const lowerValues = evalRecursiveTetrahedral(input.slice(1), childParams, lowerOffset, outputScale);
  const upperValues = evalRecursiveTetrahedral(input.slice(1), childParams, upperOffset, outputScale);

  return lowerValues.map((value, index) => value + ((upperValues[index] ?? value) - value) * fraction);
}

export function cmsEvalInterpFloat(
  input: readonly number[],
  params: CmsInterpParams,
  method: CmsInterpMethod = (params.dwFlags & CMS_LERP_FLAGS_TRILINEAR) !== 0 ? "trilinear" : "tetrahedral",
): number[] {
  if (input.length < params.nInputs) {
    throw new Error(`Expected at least ${params.nInputs} input channels, got ${input.length}`);
  }

  const outputScale = scaleForTable(params.table);
  if (method === "trilinear") {
    return params.nInputs <= 2
      ? evalRecursiveTetrahedral(input, params, 0, outputScale)
      : evalMultilinear(input, params, 0, outputScale);
  }

  return evalRecursiveTetrahedral(input, params, 0, outputScale);
}

export function cmsEvalInterp16(
  input: readonly number[],
  params: CmsInterpParams,
  method?: CmsInterpMethod,
): Uint16Array {
  const unitInput = input.slice(0, params.nInputs).map((value) => clampUnit(value / 65535));
  const values = cmsEvalInterpFloat(unitInput, params, method);
  return Uint16Array.from(values, (value) => Math.round(clampUnit(value) * 65535));
}
