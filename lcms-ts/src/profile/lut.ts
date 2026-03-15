import type { CmsIccTagEntry } from "./tag-table.js";

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
}

export type CmsParsedLutTagValue = CmsLut16TagValue | CmsLut8TagValue | CmsMultiProcessElementTagValue;

function readSignature(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset]!,
    data[offset + 1]!,
    data[offset + 2]!,
    data[offset + 3]!,
  );
}

function readU8(data: Uint8Array, offset: number): number {
  return data[offset]!;
}

function readU16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, false);
}

function readU32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, false);
}

function readS15Fixed16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(offset, false) / 65536;
}

function integerPow(base: number, exponent: number): number {
  let result = 1;
  for (let i = 0; i < exponent; i += 1) {
    result *= base;
  }
  return result;
}

export function parseIccLutTag(data: Uint8Array, tag: CmsIccTagEntry): CmsParsedLutTagValue {
  const payload = data.slice(tag.offset, tag.offset + tag.size);
  const type = readSignature(payload, 0);

  switch (type) {
    case "mft2":
      return parseLut16(payload);
    case "mft1":
      return parseLut8(payload);
    case "mAB ":
    case "mBA ":
      return parseMultiProcessElements(payload, type.trimEnd() as "mAB" | "mBA");
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
    inputTables: payload.slice(inputTablesOffset, inputTablesOffset + inputTableValues),
    clutValues: payload.slice(clutOffset, clutOffset + clutValuesCount),
    outputTables: payload.slice(outputTablesOffset, outputTablesOffset + outputChannels * 256),
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

  if (offsets.clut !== 0) {
    clutGridPoints = [];
    for (let i = 0; i < inputChannels; i += 1) {
      clutGridPoints.push(readU8(payload, offsets.clut + i));
    }
    clutPrecision = readU8(payload, offsets.clut + 16);
  }

  const base = {
    kind,
    inputChannels,
    outputChannels,
    offsets,
    hasBcurves: offsets.bCurves !== 0,
    hasMatrix: offsets.matrix !== 0,
    hasMcurves: offsets.mCurves !== 0,
    hasClut: offsets.clut !== 0,
    hasAcurves: offsets.aCurves !== 0,
  } satisfies Omit<CmsMultiProcessElementTagValue, "clutGridPoints" | "clutPrecision">;

  return {
    ...base,
    ...(clutGridPoints ? { clutGridPoints } : {}),
    ...(clutPrecision !== undefined ? { clutPrecision } : {}),
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
  }

  return issues;
}
