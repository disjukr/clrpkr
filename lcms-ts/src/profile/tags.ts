import { cmsBuildParametricToneCurve, cmsBuildTabulatedToneCurve16, type CmsToneCurve } from "../tone-curve/index.js";
import type { CmsIccXYZNumber } from "./header.js";
import { parseIccLutTag, type CmsParsedLutTagValue } from "./lut.js";
import type { CmsIccTagEntry } from "./tag-table.js";

export interface CmsLocalizedString {
  readonly language: string;
  readonly country: string;
  readonly text: string;
}

export interface CmsDescTagValue {
  readonly kind: "desc";
  readonly text: string;
}

export interface CmsTextTagValue {
  readonly kind: "text";
  readonly text: string;
}

export interface CmsMlucTagValue {
  readonly kind: "mluc";
  readonly entries: readonly CmsLocalizedString[];
}

export interface CmsXyzTagValue {
  readonly kind: "XYZ";
  readonly value: CmsIccXYZNumber;
}

export interface CmsCurveTagValue {
  readonly kind: "curv";
  readonly curve: CmsToneCurve;
  readonly entryCount: number;
}

export interface CmsParametricCurveTagValue {
  readonly kind: "para";
  readonly functionType: number;
  readonly parameters: readonly number[];
  readonly curve: CmsToneCurve;
}

export type CmsParsedTagValue =
  | CmsCurveTagValue
  | CmsDescTagValue
  | CmsParsedLutTagValue
  | CmsMlucTagValue
  | CmsParametricCurveTagValue
  | CmsTextTagValue
  | CmsXyzTagValue;

function readTagType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset]!,
    data[offset + 1]!,
    data[offset + 2]!,
    data[offset + 3]!,
  );
}

function readAscii(data: Uint8Array, offset: number, length: number): string {
  let text = "";
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(data[offset + i]!);
  }
  return text;
}

function readUtf16Be(data: Uint8Array, offset: number, length: number): string {
  const chars: number[] = [];
  for (let i = 0; i < length; i += 2) {
    chars.push((data[offset + i]! << 8) | data[offset + i + 1]!);
  }
  return String.fromCharCode(...chars).replace(/\0+$/u, "");
}

function readU32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, false);
}

function readU16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, false);
}

function readS15Fixed16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(offset, false) / 65536;
}

function trimTrailingNul(text: string): string {
  return text.replace(/\0+$/u, "");
}

export function getTagEntry(tags: readonly CmsIccTagEntry[], signature: string): CmsIccTagEntry | undefined {
  return tags.find((tag) => tag.signature === signature);
}

export function parseIccTagValue(data: Uint8Array, tag: CmsIccTagEntry): CmsParsedTagValue {
  const payload = data.slice(tag.offset, tag.offset + tag.size);
  const type = readTagType(payload, 0);

  switch (type) {
    case "desc":
      return parseDescTag(payload);
    case "text":
      return parseTextTag(payload);
    case "mluc":
      return parseMlucTag(payload);
    case "XYZ ":
      return parseXyzTag(payload);
    case "curv":
      return parseCurveTag(payload);
    case "para":
      return parseParametricCurveTag(payload);
    case "mft1":
    case "mft2":
    case "mAB ":
    case "mBA ":
      return parseIccLutTag(data, tag);
    default:
      throw new Error(`Unsupported ICC tag type ${JSON.stringify(type)} for tag ${tag.signature}`);
  }
}

export function parseOptionalIccTagValue(
  data: Uint8Array,
  tags: readonly CmsIccTagEntry[],
  signature: string,
): CmsParsedTagValue | undefined {
  const entry = getTagEntry(tags, signature);
  return entry ? parseIccTagValue(data, entry) : undefined;
}

function parseDescTag(payload: Uint8Array): CmsDescTagValue {
  const asciiLength = readU32(payload, 8);
  const text = trimTrailingNul(readAscii(payload, 12, Math.max(0, asciiLength - 1)));
  return { kind: "desc", text };
}

function parseTextTag(payload: Uint8Array): CmsTextTagValue {
  const text = trimTrailingNul(readAscii(payload, 8, payload.byteLength - 8));
  return { kind: "text", text };
}

function parseMlucTag(payload: Uint8Array): CmsMlucTagValue {
  const recordCount = readU32(payload, 8);
  const recordSize = readU32(payload, 12);
  const entries: CmsLocalizedString[] = [];

  for (let i = 0; i < recordCount; i += 1) {
    const recordOffset = 16 + i * recordSize;
    const language = readAscii(payload, recordOffset, 2);
    const country = readAscii(payload, recordOffset + 2, 2);
    const length = readU32(payload, recordOffset + 4);
    const offset = readU32(payload, recordOffset + 8);
    entries.push({
      language,
      country,
      text: readUtf16Be(payload, offset, length),
    });
  }

  return { kind: "mluc", entries };
}

function parseXyzTag(payload: Uint8Array): CmsXyzTagValue {
  return {
    kind: "XYZ",
    value: {
      X: readS15Fixed16(payload, 8),
      Y: readS15Fixed16(payload, 12),
      Z: readS15Fixed16(payload, 16),
    },
  };
}

function parseCurveTag(payload: Uint8Array): CmsCurveTagValue {
  const count = readU32(payload, 8);

  if (count === 0) {
    return {
      kind: "curv",
      curve: cmsBuildTabulatedToneCurve16(2, [0, 65535]),
      entryCount: 0,
    };
  }

  if (count === 1) {
    const gamma = readU16(payload, 12) / 256;
    return {
      kind: "curv",
      curve: cmsBuildParametricToneCurve(1, [gamma]),
      entryCount: 1,
    };
  }

  const values = new Uint16Array(count);
  for (let i = 0; i < count; i += 1) {
    values[i] = readU16(payload, 12 + i * 2);
  }

  return {
    kind: "curv",
    curve: cmsBuildTabulatedToneCurve16(count, values),
    entryCount: count,
  };
}

function parseParametricCurveTag(payload: Uint8Array): CmsParametricCurveTagValue {
  const functionType = readU16(payload, 8);
  const paramCount = getParametricCurveParameterCount(functionType);
  const parameters: number[] = [];

  for (let i = 0; i < paramCount; i += 1) {
    parameters.push(readS15Fixed16(payload, 12 + i * 4));
  }

  return {
    kind: "para",
    functionType,
    parameters,
    curve: cmsBuildParametricToneCurve(functionType + 1, parameters),
  };
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
