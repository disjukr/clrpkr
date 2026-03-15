import type { CmsIccXYZNumber } from "./header.js";
import {
  writeS15Fixed16,
  writeSignature,
  writeU16,
  writeU32,
} from "./io-base.js";
import { serializeIccLutTag, type CmsLut16TagValue, type CmsLut8TagValue } from "./lut.js";
import type {
  CmsCurveTagValue,
  CmsDescTagValue,
  CmsLocalizedString,
  CmsMlucTagValue,
  CmsParametricCurveTagValue,
  CmsParsedTagValue,
  CmsTextTagValue,
  CmsXyzTagValue,
} from "./tags.js";

function align4(value: number): number {
  return (value + 3) & ~3;
}

function encodeAscii(text: string, zeroTerminated = false): Uint8Array {
  const bytes = new Uint8Array(text.length + (zeroTerminated ? 1 : 0));
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0x7f;
  }
  return bytes;
}

function encodeUtf16Be(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    bytes[index * 2] = (codeUnit >>> 8) & 0xff;
    bytes[index * 2 + 1] = codeUnit & 0xff;
  }
  return bytes;
}

function writeXyzNumber(buffer: Uint8Array, offset: number, value: CmsIccXYZNumber): void {
  writeS15Fixed16(buffer, offset, value.X);
  writeS15Fixed16(buffer, offset + 4, value.Y);
  writeS15Fixed16(buffer, offset + 8, value.Z);
}

function serializeDescTag(value: CmsDescTagValue): Uint8Array {
  const textBytes = encodeAscii(value.text, true);
  const size = 12 + textBytes.byteLength;
  const buffer = new Uint8Array(size);
  writeSignature(buffer, 0, "desc");
  writeU32(buffer, 8, textBytes.byteLength);
  buffer.set(textBytes, 12);
  return buffer;
}

function serializeTextTag(value: CmsTextTagValue): Uint8Array {
  const textBytes = encodeAscii(value.text);
  const buffer = new Uint8Array(8 + textBytes.byteLength);
  writeSignature(buffer, 0, "text");
  buffer.set(textBytes, 8);
  return buffer;
}

function serializeMlucTag(value: CmsMlucTagValue): Uint8Array {
  const recordCount = value.entries.length;
  const recordSize = 12;
  const recordsOffset = 16;
  let textOffset = recordsOffset + recordCount * recordSize;
  const encodedEntries = value.entries.map((entry) => ({
    ...entry,
    encodedText: encodeUtf16Be(entry.text),
  }));
  const totalSize = encodedEntries.reduce((size, entry) => align4(size + entry.encodedText.byteLength), textOffset);
  const buffer = new Uint8Array(totalSize);

  writeSignature(buffer, 0, "mluc");
  writeU32(buffer, 8, recordCount);
  writeU32(buffer, 12, recordSize);

  for (let index = 0; index < encodedEntries.length; index += 1) {
    const entry = encodedEntries[index]!;
    const recordOffset = recordsOffset + index * recordSize;
    const paddedOffset = align4(textOffset);

    buffer[recordOffset] = entry.language.charCodeAt(0) & 0x7f;
    buffer[recordOffset + 1] = entry.language.charCodeAt(1) & 0x7f;
    buffer[recordOffset + 2] = entry.country.charCodeAt(0) & 0x7f;
    buffer[recordOffset + 3] = entry.country.charCodeAt(1) & 0x7f;
    writeU32(buffer, recordOffset + 4, entry.encodedText.byteLength);
    writeU32(buffer, recordOffset + 8, paddedOffset);
    buffer.set(entry.encodedText, paddedOffset);
    textOffset = paddedOffset + entry.encodedText.byteLength;
  }

  return buffer;
}

function serializeXyzTag(value: CmsXyzTagValue): Uint8Array {
  const buffer = new Uint8Array(20);
  writeSignature(buffer, 0, "XYZ ");
  writeXyzNumber(buffer, 8, value.value);
  return buffer;
}

function serializeCurveTag(value: CmsCurveTagValue): Uint8Array {
  if (value.entryCount === 0) {
    const buffer = new Uint8Array(12);
    writeSignature(buffer, 0, "curv");
    writeU32(buffer, 8, 0);
    return buffer;
  }

  if (value.entryCount === 1) {
    const gamma = value.curve.parametricType === 1 && value.curve.params ? (value.curve.params[0] ?? 1) : 1;
    const buffer = new Uint8Array(14);
    writeSignature(buffer, 0, "curv");
    writeU32(buffer, 8, 1);
    writeU16(buffer, 12, Math.max(0, Math.min(65535, Math.round(gamma * 256))));
    return buffer;
  }

  const entryCount = value.entryCount || value.curve.table16.length;
  const buffer = new Uint8Array(12 + entryCount * 2);
  writeSignature(buffer, 0, "curv");
  writeU32(buffer, 8, entryCount);
  for (let index = 0; index < entryCount; index += 1) {
    writeU16(buffer, 12 + index * 2, value.curve.table16[index] ?? 0);
  }
  return buffer;
}

function getParametricParameterCount(functionType: number): number {
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

function serializeParametricCurveTag(value: CmsParametricCurveTagValue): Uint8Array {
  const paramCount = getParametricParameterCount(value.functionType);
  if (value.parameters.length !== paramCount) {
    throw new Error(
      `Parametric curve function type ${value.functionType} requires ${paramCount} parameters, got ${value.parameters.length}`,
    );
  }

  const buffer = new Uint8Array(12 + paramCount * 4);
  writeSignature(buffer, 0, "para");
  writeU16(buffer, 8, value.functionType);
  for (let index = 0; index < paramCount; index += 1) {
    writeS15Fixed16(buffer, 12 + index * 4, value.parameters[index]!);
  }
  return buffer;
}

export function serializeIccTagValue(
  value:
    | CmsCurveTagValue
    | CmsDescTagValue
    | CmsLut16TagValue
    | CmsLut8TagValue
    | CmsMlucTagValue
    | CmsParametricCurveTagValue
    | CmsTextTagValue
    | CmsXyzTagValue,
): Uint8Array {
  switch (value.kind) {
    case "desc":
      return serializeDescTag(value);
    case "text":
      return serializeTextTag(value);
    case "mft1":
    case "mft2":
      return serializeIccLutTag(value);
    case "mluc":
      return serializeMlucTag(value);
    case "XYZ":
      return serializeXyzTag(value);
    case "curv":
      return serializeCurveTag(value);
    case "para":
      return serializeParametricCurveTag(value);
  }
}

export interface CmsSerializedTagRecord {
  readonly signature: string;
  readonly payload: Uint8Array;
}

export function serializeIccTagRecord(signature: string, value: Parameters<typeof serializeIccTagValue>[0]): CmsSerializedTagRecord {
  return {
    signature,
    payload: serializeIccTagValue(value),
  };
}

export function buildSerializedTagTable(
  records: readonly CmsSerializedTagRecord[],
  payloadOffset = 132 + records.length * 12,
): {
  readonly tagTable: Uint8Array;
  readonly payloadBytes: Uint8Array;
  readonly entries: readonly { signature: string; offset: number; size: number }[];
} {
  const entries: { signature: string; offset: number; size: number }[] = [];
  let offset = payloadOffset;

  for (const record of records) {
    entries.push({
      signature: record.signature,
      offset,
      size: record.payload.byteLength,
    });
    offset = align4(offset + record.payload.byteLength);
  }

  const tagTable = new Uint8Array(records.length * 12);
  const payloadBytes = new Uint8Array(offset - payloadOffset);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const record = records[index]!;
    const tableOffset = index * 12;
    const payloadWriteOffset = entry.offset - payloadOffset;
    writeSignature(tagTable, tableOffset, entry.signature);
    writeU32(tagTable, tableOffset + 4, entry.offset);
    writeU32(tagTable, tableOffset + 8, entry.size);
    payloadBytes.set(record.payload, payloadWriteOffset);
  }

  return { tagTable, payloadBytes, entries };
}
