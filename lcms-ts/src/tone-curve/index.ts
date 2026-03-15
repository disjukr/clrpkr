const MAX_NODES_IN_CURVE = 4097;
const LINEAR_TOLERANCE = 0x0f;

export interface CmsToneCurve {
  readonly table16: Uint16Array;
  readonly tableFloat?: Float32Array;
  readonly parametricType?: number;
  readonly params?: readonly number[];
}

function clampUnit(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function almostZero(value: number): boolean {
  return Math.abs(value) < 1e-9;
}

function saturateWord(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 65535) {
    return 65535;
  }
  return Math.round(value);
}

function quantizeTo16Bit(value: number): number {
  return saturateWord(clampUnit(value) * 65535);
}

function dequantizeFrom16Bit(value: number): number {
  return value / 65535;
}

function quantizeVal(index: number, entries: number): number {
  if (entries <= 1) {
    return 0;
  }
  return saturateWord((index * 65535) / (entries - 1));
}

function interpolateTable16(table: Uint16Array, input: number): number {
  if (table.length === 0) {
    return 0;
  }
  if (table.length === 1) {
    return table[0]!;
  }

  const position = (input / 65535) * (table.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, table.length - 1);
  const fraction = position - lower;
  const lowValue = table[lower]!;
  const highValue = table[upper]!;
  return saturateWord(lowValue + (highValue - lowValue) * fraction);
}

function interpolateTableFloat(table: Float32Array, input: number): number {
  if (table.length === 0) {
    return 0;
  }
  if (table.length === 1) {
    return clampUnit(table[0]!);
  }

  const position = clampUnit(input) * (table.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, table.length - 1);
  const fraction = position - lower;
  const lowValue = table[lower]!;
  const highValue = table[upper]!;
  return clampUnit(lowValue + (highValue - lowValue) * fraction);
}

function evalParametric(type: number, params: readonly number[], input: number): number {
  if (Math.abs(type) < 1 || Math.abs(type) > 5 || params.length < 1) {
    throw new Error(`Unsupported parametric tone curve type: ${type}`);
  }

  const x = clampUnit(input);
  return type > 0
    ? clampUnit(evalParametricForward(type, params, x))
    : clampUnit(evalParametricInverse(-type, params, x));
}

function evalParametricForward(type: number, params: readonly number[], x: number): number {
  const gamma = params[0]!;

  switch (type) {
    case 1:
      if (almostZero(gamma)) {
        throw new Error("Gamma must not be zero");
      }
      return x ** gamma;

    case 2: {
      const a = params[1]!;
      const b = params[2]!;
      return x >= -b / a ? (a * x + b) ** gamma : 0;
    }

    case 3: {
      const a = params[1]!;
      const b = params[2]!;
      const c = params[3]!;
      return x >= -b / a ? (a * x + b) ** gamma + c : c;
    }

    case 4: {
      const a = params[1]!;
      const b = params[2]!;
      const c = params[3]!;
      const d = params[4]!;
      return x >= d ? (a * x + b) ** gamma : c * x;
    }

    case 5: {
      const a = params[1]!;
      const b = params[2]!;
      const c = params[3]!;
      const d = params[4]!;
      const e = params[5]!;
      const f = params[6]!;
      return x >= d ? (a * x + b) ** gamma + e : c * x + f;
    }

    default:
      throw new Error(`Unsupported parametric tone curve type: ${type}`);
  }
}

function evalParametricInverse(type: number, params: readonly number[], y: number): number {
  const gamma = params[0]!;

  switch (type) {
    case 1:
      if (almostZero(gamma)) {
        throw new Error("Gamma must not be zero");
      }
      return y ** (1 / gamma);

    case 2: {
      const a = params[1]!;
      const b = params[2]!;
      return ((y ** (1 / gamma)) - b) / a;
    }

    case 3: {
      const a = params[1]!;
      const b = params[2]!;
      const c = params[3]!;
      return y <= c ? 0 : (((y - c) ** (1 / gamma)) - b) / a;
    }

    case 4: {
      const a = params[1]!;
      const b = params[2]!;
      const c = params[3]!;
      const d = params[4]!;
      const breakpoint = c * d;
      return y >= breakpoint ? ((y ** (1 / gamma)) - b) / a : y / c;
    }

    case 5: {
      const a = params[1]!;
      const b = params[2]!;
      const c = params[3]!;
      const d = params[4]!;
      const e = params[5]!;
      const f = params[6]!;
      const breakpoint = c * d + f;
      return y >= breakpoint ? (((y - e) ** (1 / gamma)) - b) / a : (y - f) / c;
    }

    default:
      throw new Error(`Unsupported parametric tone curve type: ${type}`);
  }
}

function sampleParametric(type: number, params: readonly number[], entries: number): Uint16Array {
  const out = new Uint16Array(entries);
  for (let i = 0; i < entries; i += 1) {
    const input = entries <= 1 ? 0 : i / (entries - 1);
    out[i] = quantizeTo16Bit(evalParametric(type, params, input));
  }
  return out;
}

function getInterval(value: number, table: Uint16Array): number {
  if (table.length < 2) {
    return -1;
  }

  const ascending = table[0]! <= table[table.length - 1]!;
  for (let i = table.length - 2; i >= 0; i -= 1) {
    const y0 = table[i]!;
    const y1 = table[i + 1]!;

    if (ascending) {
      if (value >= y0 && value <= y1) {
        return i;
      }
    } else if (value <= y0 && value >= y1) {
      return i;
    }
  }

  return -1;
}

export function cmsBuildTabulatedToneCurve16(
  nEntries: number,
  values?: ArrayLike<number> | null,
): CmsToneCurve {
  const table16 = new Uint16Array(nEntries);
  if (values) {
    for (let i = 0; i < nEntries; i += 1) {
      table16[i] = saturateWord(values[i] ?? 0);
    }
  }
  return { table16 };
}

export function cmsBuildTabulatedToneCurveFloat(
  nEntries: number,
  values: ArrayLike<number>,
): CmsToneCurve {
  const tableFloat = new Float32Array(nEntries);
  const table16 = new Uint16Array(nEntries);

  for (let i = 0; i < nEntries; i += 1) {
    const value = clampUnit(values[i] ?? 0);
    tableFloat[i] = value;
    table16[i] = quantizeTo16Bit(value);
  }

  return { table16, tableFloat };
}

export function cmsBuildParametricToneCurve(
  type: number,
  params: readonly number[],
): CmsToneCurve {
  if (Math.abs(type) < 1 || Math.abs(type) > 5) {
    throw new Error(`Unsupported parametric tone curve type: ${type}`);
  }

  const gamma = params[0]!;
  const entries = Math.abs(gamma - 1) < 0.001 ? 2 : 4096;

  return {
    table16: sampleParametric(type, params, entries),
    parametricType: type,
    params: [...params],
  };
}

export function cmsBuildGamma(gamma: number): CmsToneCurve {
  return cmsBuildParametricToneCurve(1, [gamma]);
}

export function cmsFreeToneCurve(_curve: CmsToneCurve | null | undefined): void {}

export function cmsGetToneCurveParametricType(curve: CmsToneCurve): number {
  return curve.parametricType ?? 0;
}

export function cmsEvalToneCurve16(curve: CmsToneCurve, value: number): number {
  return interpolateTable16(curve.table16, saturateWord(value));
}

export function cmsEvalToneCurveFloat(curve: CmsToneCurve, value: number): number {
  if (curve.parametricType !== undefined && curve.params) {
    return evalParametric(curve.parametricType, curve.params, value);
  }

  if (curve.tableFloat) {
    return interpolateTableFloat(curve.tableFloat, value);
  }

  return dequantizeFrom16Bit(cmsEvalToneCurve16(curve, quantizeTo16Bit(value)));
}

export function cmsIsToneCurveLinear(curve: CmsToneCurve): boolean {
  for (let i = 0; i < curve.table16.length; i += 1) {
    const diff = Math.abs(curve.table16[i]! - quantizeVal(i, curve.table16.length));
    if (diff > LINEAR_TOLERANCE) {
      return false;
    }
  }
  return true;
}

export function cmsIsToneCurveDescending(curve: CmsToneCurve): boolean {
  if (curve.table16.length < 2) {
    return false;
  }
  return curve.table16[0]! > curve.table16[curve.table16.length - 1]!;
}

export function cmsIsToneCurveMonotonic(curve: CmsToneCurve): boolean {
  if (curve.table16.length < 2) {
    return true;
  }

  const descending = cmsIsToneCurveDescending(curve);
  for (let i = 1; i < curve.table16.length; i += 1) {
    if (descending) {
      if (curve.table16[i]! > curve.table16[i - 1]!) {
        return false;
      }
    } else if (curve.table16[i]! < curve.table16[i - 1]!) {
      return false;
    }
  }
  return true;
}

export function cmsReverseToneCurveEx(
  nResultSamples: number,
  inCurve: CmsToneCurve,
): CmsToneCurve {
  if (inCurve.parametricType !== undefined && inCurve.params && Math.abs(inCurve.parametricType) === 1) {
    return cmsBuildParametricToneCurve(-inCurve.parametricType, inCurve.params);
  }

  const out = cmsBuildTabulatedToneCurve16(nResultSamples);
  const ascending = !cmsIsToneCurveDescending(inCurve);

  for (let i = 0; i < nResultSamples; i += 1) {
    const y = nResultSamples <= 1 ? 0 : (i * 65535) / (nResultSamples - 1);
    const interval = getInterval(y, inCurve.table16);

    if (interval < 0) {
      out.table16[i] = ascending ? 0 : 65535;
      continue;
    }

    const x1 = inCurve.table16[interval]!;
    const x2 = inCurve.table16[interval + 1]!;
    const y1 = (interval * 65535) / (inCurve.table16.length - 1);
    const y2 = ((interval + 1) * 65535) / (inCurve.table16.length - 1);

    if (x1 === x2) {
      out.table16[i] = saturateWord(ascending ? y2 : y1);
      continue;
    }

    const a = (y2 - y1) / (x2 - x1);
    const b = y1 - a * x1;
    out.table16[i] = saturateWord(a * y + b);
  }

  return out;
}

export function cmsReverseToneCurve(inCurve: CmsToneCurve): CmsToneCurve {
  return cmsReverseToneCurveEx(4096, inCurve);
}

export function cmsEstimateGamma(curve: CmsToneCurve, precision: number): number {
  let sum = 0;
  let sum2 = 0;
  let n = 0;

  for (let i = 1; i < MAX_NODES_IN_CURVE - 1; i += 1) {
    const x = i / (MAX_NODES_IN_CURVE - 1);
    const y = cmsEvalToneCurveFloat(curve, x);

    if (y > 0 && y < 1 && x > 0.07) {
      const gamma = Math.log(y) / Math.log(x);
      sum += gamma;
      sum2 += gamma * gamma;
      n += 1;
    }
  }

  if (n <= 1) {
    return -1;
  }

  const std = Math.sqrt((n * sum2 - sum * sum) / (n * (n - 1)));
  if (std > precision) {
    return -1;
  }

  return sum / n;
}
