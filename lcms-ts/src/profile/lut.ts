import type { CmsIccTagEntry } from "./tag-table.js";
import {
  readS15Fixed16,
  readSignature,
  readU16,
  readU32,
  sliceIccRange,
  writeS15Fixed16,
  writeSignature,
  writeU16,
  writeU32,
} from "./io-base.js";
import { cmsBuildParametricToneCurve, cmsBuildTabulatedToneCurve16, type CmsToneCurve } from "../tone-curve/index.js";

export interface CmsLut16TagValue {
  readonly kind: "mft2";
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly gridPoints: number;
  readonly matrix: readonly number[];
  readonly inputTableEntries: number;
  readonly outputTableEntries: number;
  readonly clutValues: Uint16Array;
  readonly inputTables: Uint16Array;
  readonly outputTables: Uint16Array;
}

export interface CmsLut8TagValue {
  readonly kind: "mft1";
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly gridPoints: number;
  readonly matrix: readonly number[];
  readonly inputTables: Uint8Array;
  readonly clutValues: Uint8Array;
  readonly outputTables: Uint8Array;
}

export interface CmsMultiProcessElementTagValue {
  readonly kind: "mAB" | "mBA";
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly rawPayload: Uint8Array;
  readonly offsets: {
    readonly bCurves: number;
    readonly matrix: number;
    readonly mCurves: number;
    readonly clut: number;
    readonly aCurves: number;
  };
  readonly hasBcurves: boolean;
  readonly hasMatrix: boolean;
  readonly hasMcurves: boolean;
  readonly hasClut: boolean;
  readonly hasAcurves: boolean;
  readonly clutGridPoints?: readonly number[];
  readonly clutPrecision?: number;
  readonly bCurves?: readonly CmsToneCurve[];
  readonly matrixValues?: readonly number[];
  readonly matrixOffsetValues?: readonly number[];
  readonly mCurves?: readonly CmsToneCurve[];
  readonly clutValuesParsed?: Uint8Array | Uint16Array;
  readonly aCurves?: readonly CmsToneCurve[];
}

export interface CmsGenericMpeCurveSetElement {
  readonly kind: "cvst";
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly curves: readonly CmsToneCurve[];
}

export interface CmsGenericMpeMatrixElement {
  readonly kind: "matf";
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly matrix: readonly number[];
  readonly offset: readonly number[];
}

export interface CmsGenericMpeClutElement {
  readonly kind: "clut";
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly gridPoints: readonly number[];
  readonly values: Float32Array;
}

export interface CmsGenericMpePassthroughElement {
  readonly kind: "bACS" | "eACS";
}

export interface CmsGenericMpeRawElement {
  readonly kind: "raw";
  readonly signature: string;
  readonly rawElement: Uint8Array;
}

export type CmsGenericMpeElement =
  | CmsGenericMpeClutElement
  | CmsGenericMpeCurveSetElement
  | CmsGenericMpeMatrixElement
  | CmsGenericMpePassthroughElement
  | CmsGenericMpeRawElement;

export interface CmsGenericMultiProcessTagValue {
  readonly kind: "mpet";
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly rawPayload: Uint8Array;
  readonly elements: readonly CmsGenericMpeElement[];
}

export type CmsParsedLutTagValue =
  | CmsGenericMultiProcessTagValue
  | CmsLut16TagValue
  | CmsLut8TagValue
  | CmsMultiProcessElementTagValue;

function readU8(data: Uint8Array, offset: number): number {
  return data[offset]!;
}

function integerPow(base: number, exponent: number): number {
  let result = 1;
  for (let i = 0; i < exponent; i += 1) {
    result *= base;
  }
  return result;
}

function align4(value: number): number {
  return (value + 3) & ~3;
}

function getParametricCurveParameterCount(functionType: number): number {
  switch (functionType) {
    case 0:
      return 1;
    case 1:
      return 3;
    case 2:
      return 4;
    case 3:
      return 5;
    case 4:
      return 7;
    default:
      throw new Error(`Unsupported parametric curve function type: ${functionType}`);
  }
}

function parseEmbeddedCurve(payload: Uint8Array, offset: number): { curve: CmsToneCurve; nextOffset: number } {
  const type = readSignature(payload, offset);

  if (type === "curv") {
    const count = readU32(payload, offset + 8);
    if (count === 0) {
      return {
        curve: cmsBuildParametricToneCurve(1, [1]),
        nextOffset: align4(offset + 12),
      };
    }
    if (count === 1) {
      return {
        curve: cmsBuildParametricToneCurve(1, [readU16(payload, offset + 12) / 256]),
        nextOffset: align4(offset + 14),
      };
    }

    const values = new Uint16Array(count);
    for (let index = 0; index < count; index += 1) {
      values[index] = readU16(payload, offset + 12 + index * 2);
    }
    return {
      curve: cmsBuildTabulatedToneCurve16(count, values),
      nextOffset: align4(offset + 12 + count * 2),
    };
  }

  if (type === "para") {
    const functionType = readU16(payload, offset + 8);
    const paramCount = getParametricCurveParameterCount(functionType);
    const params: number[] = [];
    for (let index = 0; index < paramCount; index += 1) {
      params.push(readS15Fixed16(payload, offset + 12 + index * 4));
    }
    return {
      curve: cmsBuildParametricToneCurve(functionType + 1, params),
      nextOffset: align4(offset + 12 + paramCount * 4),
    };
  }

  throw new Error(`Unsupported embedded MPE curve type ${JSON.stringify(type)}`);
}

function parseCurveSet(payload: Uint8Array, offset: number, count: number): readonly CmsToneCurve[] {
  const curves: CmsToneCurve[] = [];
  let cursor = offset;
  for (let index = 0; index < count; index += 1) {
    const parsed = parseEmbeddedCurve(payload, cursor);
    curves.push(parsed.curve);
    cursor = parsed.nextOffset;
  }
  return curves;
}

function parseMatrixBlock(payload: Uint8Array, offset: number): { matrixValues: readonly number[]; offsetValues: readonly number[] } {
  const values = Array.from({ length: 12 }, (_, index) => readS15Fixed16(payload, offset + index * 4));
  return {
    matrixValues: values.slice(0, 9),
    offsetValues: values.slice(9, 12),
  };
}

function parseClutBlock(
  payload: Uint8Array,
  offset: number,
  inputChannels: number,
  outputChannels: number,
): { gridPoints: readonly number[]; precision: number; values: Uint8Array | Uint16Array } {
  const gridPoints = Array.from({ length: inputChannels }, (_, index) => readU8(payload, offset + index));
  const precision = readU8(payload, offset + 16);
  const pointCount = gridPoints.reduce((acc, value) => acc * value, 1);
  const valueCount = pointCount * outputChannels;
  const dataOffset = offset + 20;

  if (precision === 1) {
    return {
      gridPoints,
      precision,
      values: payload.slice(dataOffset, dataOffset + valueCount),
    };
  }

  if (precision === 2) {
    const values = new Uint16Array(valueCount);
    for (let index = 0; index < valueCount; index += 1) {
      values[index] = readU16(payload, dataOffset + index * 2);
    }
    return {
      gridPoints,
      precision,
      values,
    };
  }

  throw new Error(`Unsupported mAB/mBA CLUT precision: ${precision}`);
}

function readFloat32(payload: Uint8Array, offset: number): number {
  return new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getFloat32(offset, false);
}

function writeFloat32(payload: Uint8Array, offset: number, value: number): void {
  new DataView(payload.buffer, payload.byteOffset, payload.byteLength).setFloat32(offset, value, false);
}

function parseGenericMultiProcessElements(payload: Uint8Array): CmsGenericMultiProcessTagValue {
  const inputChannels = readU16(payload, 8);
  const outputChannels = readU16(payload, 10);
  const elementCount = readU32(payload, 12);
  const elements: CmsGenericMpeElement[] = [];

  for (let index = 0; index < elementCount; index += 1) {
    const elementOffset = readU32(payload, 16 + index * 8);
    const elementSize = readU32(payload, 16 + index * 8 + 4);
    const signature = readSignature(payload, elementOffset);
    const bodyOffset = elementOffset + 8;

    switch (signature) {
      case "cvst": {
        const elementInput = readU16(payload, bodyOffset);
        const elementOutput = readU16(payload, bodyOffset + 2);
        elements.push({
          kind: "cvst",
          inputChannels: elementInput,
          outputChannels: elementOutput,
          curves: parseCurveSet(payload, bodyOffset + 4 + elementInput * 8, elementInput),
        });
        break;
      }
      case "matf": {
        const elementInput = readU16(payload, bodyOffset);
        const elementOutput = readU16(payload, bodyOffset + 2);
        const matrixCount = elementInput * elementOutput;
        elements.push({
          kind: "matf",
          inputChannels: elementInput,
          outputChannels: elementOutput,
          matrix: Array.from({ length: matrixCount }, (_, matrixIndex) => readFloat32(payload, bodyOffset + 4 + matrixIndex * 4)),
          offset: Array.from({ length: elementOutput }, (_, offsetIndex) => readFloat32(payload, bodyOffset + 4 + matrixCount * 4 + offsetIndex * 4)),
        });
        break;
      }
      case "clut": {
        const elementInput = readU16(payload, bodyOffset);
        const elementOutput = readU16(payload, bodyOffset + 2);
        const gridPoints = Array.from({ length: elementInput }, (_, gridIndex) => readU8(payload, bodyOffset + 4 + gridIndex));
        const pointCount = gridPoints.reduce((acc, value) => acc * value, 1);
        const valueCount = pointCount * elementOutput;
        const values = new Float32Array(valueCount);
        for (let valueIndex = 0; valueIndex < valueCount; valueIndex += 1) {
          values[valueIndex] = readFloat32(payload, bodyOffset + 20 + valueIndex * 4);
        }
        elements.push({
          kind: "clut",
          inputChannels: elementInput,
          outputChannels: elementOutput,
          gridPoints,
          values,
        });
        break;
      }
      case "bACS":
      case "eACS":
        elements.push({ kind: signature });
        break;
      default:
        elements.push({
          kind: "raw",
          signature,
          rawElement: payload.slice(elementOffset, elementOffset + elementSize),
        });
    }
  }

  return {
    kind: "mpet",
    inputChannels,
    outputChannels,
    rawPayload: new Uint8Array(payload),
    elements,
  };
}

export function parseIccLutTag(data: Uint8Array, tag: CmsIccTagEntry): CmsParsedLutTagValue {
  const payload = sliceIccRange(data, tag.offset, tag.size, `LUT tag ${tag.signature}`);
  const type = readSignature(payload, 0);

  switch (type) {
    case "mft2":
      return parseLut16(payload);
    case "mft1":
      return parseLut8(payload);
    case "mAB ":
    case "mBA ":
      return parseMultiProcessElements(payload, type.trimEnd() as "mAB" | "mBA");
    case "mpet":
      return parseGenericMultiProcessElements(payload);
    default:
      throw new Error(`Unsupported LUT tag type ${JSON.stringify(type)} for tag ${tag.signature}`);
  }
}

function parseLut16(payload: Uint8Array): CmsLut16TagValue {
  const inputChannels = readU8(payload, 8);
  const outputChannels = readU8(payload, 9);
  const gridPoints = readU8(payload, 10);
  const matrix = [];

  for (let i = 0; i < 9; i += 1) {
    matrix.push(readS15Fixed16(payload, 12 + i * 4));
  }

  const inputTableEntries = readU16(payload, 48);
  const outputTableEntries = readU16(payload, 50);
  const inputTableValues = inputChannels * inputTableEntries;
  const clutValuesCount = integerPow(gridPoints, inputChannels) * outputChannels;
  const inputTablesOffset = 52;
  const clutOffset = inputTablesOffset + inputTableValues * 2;
  const outputTablesOffset = clutOffset + clutValuesCount * 2;
  const inputTables = new Uint16Array(inputTableValues);
  const clutValues = new Uint16Array(clutValuesCount);
  const outputTables = new Uint16Array(outputChannels * outputTableEntries);

  for (let i = 0; i < inputTableValues; i += 1) {
    inputTables[i] = readU16(payload, inputTablesOffset + i * 2);
  }
  for (let i = 0; i < clutValuesCount; i += 1) {
    clutValues[i] = readU16(payload, clutOffset + i * 2);
  }
  for (let i = 0; i < outputTables.length; i += 1) {
    outputTables[i] = readU16(payload, outputTablesOffset + i * 2);
  }

  return {
    kind: "mft2",
    inputChannels,
    outputChannels,
    gridPoints,
    matrix,
    inputTableEntries,
    outputTableEntries,
    clutValues,
    inputTables,
    outputTables,
  };
}

function parseLut8(payload: Uint8Array): CmsLut8TagValue {
  const inputChannels = readU8(payload, 8);
  const outputChannels = readU8(payload, 9);
  const gridPoints = readU8(payload, 10);
  const matrix = [];

  for (let i = 0; i < 9; i += 1) {
    matrix.push(readS15Fixed16(payload, 12 + i * 4));
  }

  const inputTablesOffset = 48;
  const inputTableValues = inputChannels * 256;
  const clutOffset = inputTablesOffset + inputTableValues;
  const clutValuesCount = integerPow(gridPoints, inputChannels) * outputChannels;
  const outputTablesOffset = clutOffset + clutValuesCount;

  return {
    kind: "mft1",
    inputChannels,
    outputChannels,
    gridPoints,
    matrix,
    inputTables: new Uint8Array(payload.slice(inputTablesOffset, inputTablesOffset + inputTableValues)),
    clutValues: new Uint8Array(payload.slice(clutOffset, clutOffset + clutValuesCount)),
    outputTables: new Uint8Array(payload.slice(outputTablesOffset, outputTablesOffset + outputChannels * 256)),
  };
}

function parseMultiProcessElements(
  payload: Uint8Array,
  kind: "mAB" | "mBA",
): CmsMultiProcessElementTagValue {
  const inputChannels = readU8(payload, 8);
  const outputChannels = readU8(payload, 9);
  const offsets = {
    bCurves: readU32(payload, 12),
    matrix: readU32(payload, 16),
    mCurves: readU32(payload, 20),
    clut: readU32(payload, 24),
    aCurves: readU32(payload, 28),
  };

  let clutGridPoints: number[] | undefined;
  let clutPrecision: number | undefined;
  let bCurves: readonly CmsToneCurve[] | undefined;
  let matrixValues: readonly number[] | undefined;
  let matrixOffsetValues: readonly number[] | undefined;
  let mCurves: readonly CmsToneCurve[] | undefined;
  let clutValuesParsed: Uint8Array | Uint16Array | undefined;
  let aCurves: readonly CmsToneCurve[] | undefined;

  if (offsets.bCurves !== 0) {
    bCurves = parseCurveSet(payload, offsets.bCurves, outputChannels);
  }

  if (offsets.matrix !== 0) {
    const parsedMatrix = parseMatrixBlock(payload, offsets.matrix);
    matrixValues = parsedMatrix.matrixValues;
    matrixOffsetValues = parsedMatrix.offsetValues;
  }

  if (offsets.mCurves !== 0) {
    mCurves = parseCurveSet(payload, offsets.mCurves, outputChannels);
  }

  if (offsets.clut !== 0) {
    const parsedClut = parseClutBlock(payload, offsets.clut, inputChannels, outputChannels);
    clutGridPoints = [...parsedClut.gridPoints];
    clutPrecision = parsedClut.precision;
    clutValuesParsed = parsedClut.values;
  }

  if (offsets.aCurves !== 0) {
    aCurves = parseCurveSet(payload, offsets.aCurves, inputChannels);
  }

  const base = {
    kind,
    inputChannels,
    outputChannels,
    rawPayload: new Uint8Array(payload),
    offsets,
    hasBcurves: offsets.bCurves !== 0,
    hasMatrix: offsets.matrix !== 0,
    hasMcurves: offsets.mCurves !== 0,
    hasClut: offsets.clut !== 0,
    hasAcurves: offsets.aCurves !== 0,
  } satisfies Omit<CmsMultiProcessElementTagValue, "clutGridPoints" | "clutPrecision">;

  return {
    ...base,
    ...(bCurves ? { bCurves } : {}),
    ...(matrixValues ? { matrixValues } : {}),
    ...(matrixOffsetValues ? { matrixOffsetValues } : {}),
    ...(mCurves ? { mCurves } : {}),
    ...(clutGridPoints ? { clutGridPoints } : {}),
    ...(clutPrecision !== undefined ? { clutPrecision } : {}),
    ...(clutValuesParsed ? { clutValuesParsed } : {}),
    ...(aCurves ? { aCurves } : {}),
  };
}

export function validateLutTagStructure(
  tag: CmsParsedLutTagValue,
  payloadSize: number,
): readonly string[] {
  const issues: string[] = [];

  switch (tag.kind) {
    case "mft2":
      if (tag.inputChannels < 1 || tag.outputChannels < 1) {
        issues.push("mft2 must declare at least one input and output channel");
      }
      if (tag.gridPoints < 2) {
        issues.push("mft2 grid points must be at least 2");
      }
      if (tag.inputTableEntries < 2 || tag.outputTableEntries < 2) {
        issues.push("mft2 input/output tables must have at least 2 entries");
      }
      break;

    case "mft1":
      if (tag.inputChannels < 1 || tag.outputChannels < 1) {
        issues.push("mft1 must declare at least one input and output channel");
      }
      if (tag.gridPoints < 2) {
        issues.push("mft1 grid points must be at least 2");
      }
      break;

    case "mAB":
    case "mBA": {
      const offsets = Object.values(tag.offsets).filter((value) => value !== 0);
      for (const offset of offsets) {
        if (offset < 32 || offset >= payloadSize) {
          issues.push(`${tag.kind} offset ${offset} is outside payload`);
        }
      }
      if (tag.hasClut && (!tag.clutGridPoints || !tag.clutPrecision)) {
        issues.push(`${tag.kind} CLUT offset is present but CLUT header could not be parsed`);
      }
      if (tag.clutPrecision !== undefined && tag.clutPrecision !== 1 && tag.clutPrecision !== 2) {
        issues.push(`${tag.kind} CLUT precision must be 1 or 2 bytes, got ${tag.clutPrecision}`);
      }
      break;
    }
    case "mpet":
      if (tag.elements.length === 0) {
        issues.push("mpet must contain at least one element");
      }
      break;
  }

  return issues;
}

export function serializeIccLutTag(value: CmsParsedLutTagValue): Uint8Array {
  switch (value.kind) {
    case "mft1":
      return serializeLut8(value);
    case "mft2":
      return serializeLut16(value);
    case "mAB":
    case "mBA":
      return new Uint8Array(value.rawPayload);
    case "mpet":
      return serializeGenericMultiProcessTag(value);
  }
}

function canSerializeGenericMpeElement(element: CmsGenericMpeElement): boolean {
  return element.kind === "bACS" || element.kind === "eACS" || element.kind === "matf" || element.kind === "clut" || element.kind === "raw";
}

function serializeGenericMpeElement(element: CmsGenericMpeElement): Uint8Array {
  switch (element.kind) {
    case "bACS":
    case "eACS": {
      const payload = new Uint8Array(8);
      writeSignature(payload, 0, element.kind);
      return payload;
    }
    case "matf": {
      const matrixCount = element.inputChannels * element.outputChannels;
      const payload = new Uint8Array(12 + (matrixCount + element.outputChannels) * 4);
      writeSignature(payload, 0, "matf");
      writeU16(payload, 8, element.inputChannels);
      writeU16(payload, 10, element.outputChannels);
      for (let index = 0; index < matrixCount; index += 1) {
        writeFloat32(payload, 12 + index * 4, element.matrix[index] ?? 0);
      }
      for (let index = 0; index < element.outputChannels; index += 1) {
        writeFloat32(payload, 12 + matrixCount * 4 + index * 4, element.offset[index] ?? 0);
      }
      return payload;
    }
    case "clut": {
      const pointCount = element.gridPoints.reduce((acc, value) => acc * value, 1);
      const valueCount = pointCount * element.outputChannels;
      const payload = new Uint8Array(28 + valueCount * 4);
      writeSignature(payload, 0, "clut");
      writeU16(payload, 8, element.inputChannels);
      writeU16(payload, 10, element.outputChannels);
      for (let index = 0; index < element.inputChannels; index += 1) {
        payload[12 + index] = element.gridPoints[index] ?? 0;
      }
      for (let index = 0; index < valueCount; index += 1) {
        writeFloat32(payload, 28 + index * 4, element.values[index] ?? 0);
      }
      return payload;
    }
    case "raw":
      return new Uint8Array(element.rawElement);
    case "cvst":
      throw new Error("Structured serialization for generic MPE curve-set elements is not implemented");
  }
}

function serializeGenericMultiProcessTag(value: CmsGenericMultiProcessTagValue): Uint8Array {
  if (value.elements.some((element) => !canSerializeGenericMpeElement(element))) {
    return new Uint8Array(value.rawPayload);
  }

  const elementPayloads = value.elements.map(serializeGenericMpeElement);
  const directorySize = value.elements.length * 8;
  let dataOffset = 16 + directorySize;
  const entries = elementPayloads.map((payload) => {
    const offset = dataOffset;
    dataOffset = align4(dataOffset + payload.byteLength);
    return { offset, size: payload.byteLength, payload };
  });

  const result = new Uint8Array(dataOffset);
  writeSignature(result, 0, "mpet");
  writeU16(result, 8, value.inputChannels);
  writeU16(result, 10, value.outputChannels);
  writeU32(result, 12, value.elements.length);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    writeU32(result, 16 + index * 8, entry.offset);
    writeU32(result, 16 + index * 8 + 4, entry.size);
    result.set(entry.payload, entry.offset);
  }

  return result;
}

function serializeLut16(value: CmsLut16TagValue): Uint8Array {
  const inputTableValues = value.inputChannels * value.inputTableEntries;
  const clutValuesCount = integerPow(value.gridPoints, value.inputChannels) * value.outputChannels;
  const outputTableValues = value.outputChannels * value.outputTableEntries;
  const payload = new Uint8Array(52 + inputTableValues * 2 + clutValuesCount * 2 + outputTableValues * 2);

  writeSignature(payload, 0, "mft2");
  payload[8] = value.inputChannels & 0xff;
  payload[9] = value.outputChannels & 0xff;
  payload[10] = value.gridPoints & 0xff;

  for (let index = 0; index < 9; index += 1) {
    writeS15Fixed16(payload, 12 + index * 4, value.matrix[index] ?? 0);
  }

  writeU16(payload, 48, value.inputTableEntries);
  writeU16(payload, 50, value.outputTableEntries);

  let offset = 52;
  for (let index = 0; index < inputTableValues; index += 1) {
    writeU16(payload, offset + index * 2, value.inputTables[index] ?? 0);
  }
  offset += inputTableValues * 2;
  for (let index = 0; index < clutValuesCount; index += 1) {
    writeU16(payload, offset + index * 2, value.clutValues[index] ?? 0);
  }
  offset += clutValuesCount * 2;
  for (let index = 0; index < outputTableValues; index += 1) {
    writeU16(payload, offset + index * 2, value.outputTables[index] ?? 0);
  }

  return payload;
}

function serializeLut8(value: CmsLut8TagValue): Uint8Array {
  const inputTableValues = value.inputChannels * 256;
  const clutValuesCount = integerPow(value.gridPoints, value.inputChannels) * value.outputChannels;
  const outputTableValues = value.outputChannels * 256;
  const payload = new Uint8Array(48 + inputTableValues + clutValuesCount + outputTableValues);

  writeSignature(payload, 0, "mft1");
  payload[8] = value.inputChannels & 0xff;
  payload[9] = value.outputChannels & 0xff;
  payload[10] = value.gridPoints & 0xff;

  for (let index = 0; index < 9; index += 1) {
    writeS15Fixed16(payload, 12 + index * 4, value.matrix[index] ?? 0);
  }

  payload.set(value.inputTables, 48);
  payload.set(value.clutValues, 48 + inputTableValues);
  payload.set(value.outputTables, 48 + inputTableValues + clutValuesCount);

  return payload;
}
