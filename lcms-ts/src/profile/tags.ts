import { cmsBuildParametricToneCurve, cmsBuildTabulatedToneCurve16, type CmsToneCurve } from "../tone-curve/index.js";
import type { CmsCIExyY } from "../types/color.js";
import type { CmsIccXYZNumber } from "./header.js";
import type { CmsIccDateTime } from "./io-base.js";
import { readDateTime, readS15Fixed16, readSignature, readU16, readU32, readU64, sliceIccRange } from "./io-base.js";
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

export interface CmsDataTagValue {
  readonly kind: "data";
  readonly flag: number;
  readonly bytes: Uint8Array;
}

export interface CmsDateTimeTagValue {
  readonly kind: "dtim";
  readonly value: CmsIccDateTime;
}

export interface CmsMeasurementTagValue {
  readonly kind: "meas";
  readonly observer: number;
  readonly backing: CmsIccXYZNumber;
  readonly geometry: number;
  readonly flare: number;
  readonly illuminantType: number;
}

export interface CmsViewingConditionsTagValue {
  readonly kind: "view";
  readonly illuminant: CmsIccXYZNumber;
  readonly surround: CmsIccXYZNumber;
  readonly illuminantType: number;
}

export interface CmsChromaticityTagValue {
  readonly kind: "chrm";
  readonly channels: number;
  readonly phosphorOrColorantType: number;
  readonly red: CmsCIExyY;
  readonly green: CmsCIExyY;
  readonly blue: CmsCIExyY;
}

export interface CmsSignatureTagValue {
  readonly kind: "sig";
  readonly signature: string;
}

export interface CmsColorantTableEntry {
  readonly name: string;
  readonly pcs: readonly [number, number, number];
}

export interface CmsColorantTableTagValue {
  readonly kind: "clrt";
  readonly entries: readonly CmsColorantTableEntry[];
}

export type CmsEmbeddedTextTagValue = CmsDescTagValue | CmsMlucTagValue | CmsTextTagValue;

export interface CmsProfileSequenceEntry {
  readonly deviceMfg: string;
  readonly deviceModel: string;
  readonly attributes: bigint;
  readonly technology: string;
  readonly manufacturer: CmsEmbeddedTextTagValue;
  readonly model: CmsEmbeddedTextTagValue;
  readonly profileId?: string;
  readonly description?: CmsEmbeddedTextTagValue;
}

export interface CmsProfileSequenceDescTagValue {
  readonly kind: "pseq";
  readonly entries: readonly CmsProfileSequenceEntry[];
}

export interface CmsProfileSequenceIdTagValue {
  readonly kind: "psid";
  readonly entries: readonly CmsProfileSequenceEntry[];
}

export interface CmsUcrBgTagValue {
  readonly kind: "bfd";
  readonly ucr: CmsCurveTagValue;
  readonly bg: CmsCurveTagValue;
  readonly text: string;
}

export interface CmsCrdInfoTagValue {
  readonly kind: "crdi";
  readonly productName: string;
  readonly renderingIntent0: string;
  readonly renderingIntent1: string;
  readonly renderingIntent2: string;
  readonly renderingIntent3: string;
}

export interface CmsScreeningChannel {
  readonly frequency: number;
  readonly screenAngle: number;
  readonly spotShape: number;
}

export interface CmsScreeningTagValue {
  readonly kind: "scrn";
  readonly flag: number;
  readonly channels: readonly CmsScreeningChannel[];
}

export interface CmsNamedColorEntry {
  readonly name: string;
  readonly pcs: readonly [number, number, number];
  readonly deviceCoords: readonly number[];
}

export interface CmsNamedColorTagValue {
  readonly kind: "ncl2";
  readonly vendorFlag: number;
  readonly prefix: string;
  readonly suffix: string;
  readonly entries: readonly CmsNamedColorEntry[];
}

export interface CmsDictionaryEntry {
  readonly name: string;
  readonly value: string;
  readonly displayName?: CmsMlucTagValue;
  readonly displayValue?: CmsMlucTagValue;
}

export interface CmsDictionaryTagValue {
  readonly kind: "dict";
  readonly entries: readonly CmsDictionaryEntry[];
}

export interface CmsS15Fixed16ArrayTagValue {
  readonly kind: "sf32";
  readonly values: readonly number[];
}

export interface CmsU16Fixed16ArrayTagValue {
  readonly kind: "uf32";
  readonly values: readonly number[];
}

export interface CmsColorantOrderTagValue {
  readonly kind: "clro";
  readonly colorants: readonly number[];
}

export interface CmsUInt8ArrayTagValue {
  readonly kind: "ui08";
  readonly values: Uint8Array;
}

export interface CmsUInt32ArrayTagValue {
  readonly kind: "ui32";
  readonly values: readonly number[];
}

export interface CmsUInt64ArrayTagValue {
  readonly kind: "ui64";
  readonly values: readonly bigint[];
}

export interface CmsVideoSignalTagValue {
  readonly kind: "cicp";
  readonly colourPrimaries: number;
  readonly transferCharacteristics: number;
  readonly matrixCoefficients: number;
  readonly videoFullRangeFlag: number;
}

export interface CmsVcgtTagValue {
  readonly kind: "vcgt";
  readonly storage: "formula" | "table";
  readonly curves: readonly [CmsToneCurve, CmsToneCurve, CmsToneCurve];
}

export interface CmsMhc2TagValue {
  readonly kind: "MHC2";
  readonly curveEntries: number;
  readonly minLuminance: number;
  readonly peakLuminance: number;
  readonly xyzToXyzMatrix: readonly number[];
  readonly redCurve: readonly number[];
  readonly greenCurve: readonly number[];
  readonly blueCurve: readonly number[];
}

export interface CmsParametricCurveTagValue {
  readonly kind: "para";
  readonly functionType: number;
  readonly parameters: readonly number[];
  readonly curve: CmsToneCurve;
}

export type CmsParsedTagValue =
  | CmsChromaticityTagValue
  | CmsColorantOrderTagValue
  | CmsColorantTableTagValue
  | CmsCurveTagValue
  | CmsCrdInfoTagValue
  | CmsDataTagValue
  | CmsDateTimeTagValue
  | CmsDictionaryTagValue
  | CmsDescTagValue
  | CmsMeasurementTagValue
  | CmsMhc2TagValue
  | CmsParsedLutTagValue
  | CmsMlucTagValue
  | CmsNamedColorTagValue
  | CmsParametricCurveTagValue
  | CmsProfileSequenceDescTagValue
  | CmsProfileSequenceIdTagValue
  | CmsS15Fixed16ArrayTagValue
  | CmsScreeningTagValue
  | CmsSignatureTagValue
  | CmsTextTagValue
  | CmsU16Fixed16ArrayTagValue
  | CmsUInt32ArrayTagValue
  | CmsUInt64ArrayTagValue
  | CmsUInt8ArrayTagValue
  | CmsUcrBgTagValue
  | CmsVcgtTagValue
  | CmsVideoSignalTagValue
  | CmsViewingConditionsTagValue
  | CmsXyzTagValue;

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

function trimTrailingNul(text: string): string {
  return text.replace(/\0+$/u, "");
}

function align4(value: number): number {
  return (value + 3) & ~3;
}

export function getTagEntry(tags: readonly CmsIccTagEntry[], signature: string): CmsIccTagEntry | undefined {
  return tags.find((tag) => tag.signature === signature);
}

export function parseIccTagValue(data: Uint8Array, tag: CmsIccTagEntry): CmsParsedTagValue {
  const payload = sliceIccRange(data, tag.offset, tag.size, `Tag ${tag.signature}`);
  const type = readSignature(payload, 0);
  const typeSignature = readU32(payload, 0);

  switch (typeSignature) {
    case 0x17a505b8:
      return parseXyzTag(payload);
    case 0x9478ee00:
      return parseCurveTag(payload);
  }

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
    case "crdi":
      return parseCrdInfoTag(payload);
    case "clrt":
      return parseColorantTableTag(payload);
    case "data":
      return parseDataTag(payload);
    case "dtim":
      return parseDateTimeTag(payload);
    case "dict":
      return parseDictionaryTag(payload);
    case "meas":
      return parseMeasurementTag(payload);
    case "MHC2":
      return parseMhc2Tag(payload);
    case "ncl2":
      return parseNamedColorTag(payload);
    case "para":
      return parseParametricCurveTag(payload);
    case "pseq":
      return parseProfileSequenceDescTag(payload);
    case "psid":
      return parseProfileSequenceIdTag(payload);
    case "sf32":
      return parseS15Fixed16ArrayTag(payload);
    case "scrn":
      return parseScreeningTag(payload);
    case "sig ":
      return parseSignatureTag(payload);
    case "ui08":
      return parseUInt8ArrayTag(payload);
    case "ui32":
      return parseUInt32ArrayTag(payload);
    case "ui64":
      return parseUInt64ArrayTag(payload);
    case "bfd ":
      return parseUcrBgTag(payload);
    case "vcgt":
      return parseVcgtTag(payload);
    case "view":
      return parseViewingConditionsTag(payload);
    case "cicp":
      return parseVideoSignalTag(payload);
    case "chrm":
      return parseChromaticityTag(payload);
    case "clro":
      return parseColorantOrderTag(payload);
    case "mft1":
    case "mft2":
    case "mAB ":
    case "mBA ":
    case "mpet":
      return parseIccLutTag(data, tag);
    case "uf32":
      return parseU16Fixed16ArrayTag(payload);
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

function parseDataTag(payload: Uint8Array): CmsDataTagValue {
  return {
    kind: "data",
    flag: readU32(payload, 8),
    bytes: payload.slice(12),
  };
}

function parseDateTimeTag(payload: Uint8Array): CmsDateTimeTagValue {
  return {
    kind: "dtim",
    value: readDateTime(payload, 8),
  };
}

function parseColorantTableTag(payload: Uint8Array): CmsColorantTableTagValue {
  const count = readU32(payload, 8);
  const entries: CmsColorantTableEntry[] = [];
  let cursor = 12;

  for (let index = 0; index < count; index += 1) {
    const name = trimTrailingNul(readAscii(payload, cursor, 32));
    const pcs: [number, number, number] = [
      readU16(payload, cursor + 32),
      readU16(payload, cursor + 34),
      readU16(payload, cursor + 36),
    ];
    entries.push({ name, pcs });
    cursor += 38;
  }

  return {
    kind: "clrt",
    entries,
  };
}

function parseMeasurementTag(payload: Uint8Array): CmsMeasurementTagValue {
  return {
    kind: "meas",
    observer: readU32(payload, 8),
    backing: {
      X: readS15Fixed16(payload, 12),
      Y: readS15Fixed16(payload, 16),
      Z: readS15Fixed16(payload, 20),
    },
    geometry: readU32(payload, 24),
    flare: readS15Fixed16(payload, 28),
    illuminantType: readU32(payload, 32),
  };
}

function parseSignatureTag(payload: Uint8Array): CmsSignatureTagValue {
  return {
    kind: "sig",
    signature: readSignature(payload, 8),
  };
}

function parseViewingConditionsTag(payload: Uint8Array): CmsViewingConditionsTagValue {
  return {
    kind: "view",
    illuminant: {
      X: readS15Fixed16(payload, 8),
      Y: readS15Fixed16(payload, 12),
      Z: readS15Fixed16(payload, 16),
    },
    surround: {
      X: readS15Fixed16(payload, 20),
      Y: readS15Fixed16(payload, 24),
      Z: readS15Fixed16(payload, 28),
    },
    illuminantType: readU32(payload, 32),
  };
}

function parseChromaticityTag(payload: Uint8Array): CmsChromaticityTagValue {
  let channels = readU16(payload, 8);
  let phosphorOrColorantType = readU16(payload, 10);
  let cursor = 12;

  // Upstream recovers from an early lcms1 bug where the first u16 is zero.
  if (channels === 0 && payload.byteLength === 32) {
    phosphorOrColorantType = readU16(payload, 12);
    channels = readU16(payload, 14);
    cursor = 16;
  }

  if (channels !== 3) {
    throw new Error(`Unsupported chromaticity channel count: ${channels}`);
  }

  return {
    kind: "chrm",
    channels,
    phosphorOrColorantType,
    red: { x: readS15Fixed16(payload, cursor), y: readS15Fixed16(payload, cursor + 4), Y: 1 },
    green: { x: readS15Fixed16(payload, cursor + 8), y: readS15Fixed16(payload, cursor + 12), Y: 1 },
    blue: { x: readS15Fixed16(payload, cursor + 16), y: readS15Fixed16(payload, cursor + 20), Y: 1 },
  };
}

function parseEmbeddedTextTag(payload: Uint8Array, offset: number): { value: CmsEmbeddedTextTagValue; nextOffset: number } {
  const type = readSignature(payload, offset);

  switch (type) {
    case "desc": {
      const asciiLength = readU32(payload, offset + 8);
      const size = 12 + asciiLength;
      return {
        value: parseDescTag(payload.slice(offset, offset + size)),
        nextOffset: offset + size,
      };
    }
    case "text": {
      let size = payload.byteLength - offset;
      const nextTypeOffset = findNextEmbeddedTextOffset(payload, offset + 8);
      if (nextTypeOffset !== undefined) {
        size = nextTypeOffset - offset;
      }
      return {
        value: parseTextTag(payload.slice(offset, offset + size)),
        nextOffset: offset + size,
      };
    }
    case "mluc": {
      const recordCount = readU32(payload, offset + 8);
      const recordSize = readU32(payload, offset + 12);
      let size = 16 + recordCount * recordSize;
      for (let i = 0; i < recordCount; i += 1) {
        const recordOffset = offset + 16 + i * recordSize;
        const length = readU32(payload, recordOffset + 4);
        const textOffset = readU32(payload, recordOffset + 8);
        size = Math.max(size, textOffset + length);
      }
      const alignedSize = align4(size);
      return {
        value: parseMlucTag(payload.slice(offset, offset + alignedSize)),
        nextOffset: offset + alignedSize,
      };
    }
    default:
      throw new Error(`Unsupported embedded text type ${JSON.stringify(type)}`);
  }
}

function findNextEmbeddedTextOffset(payload: Uint8Array, start: number): number | undefined {
  let lastValidOffset: number | undefined;
  for (let offset = start; offset + 4 <= payload.byteLength; offset += 1) {
    const type = readSignature(payload, offset);
    if (!isEmbeddedTextBoundaryCandidate(payload, offset, type)) {
      continue;
    }
    lastValidOffset = offset;
  }

  return lastValidOffset;
}

function isEmbeddedTextBoundaryCandidate(payload: Uint8Array, offset: number, type: string): boolean {
  switch (type) {
    case "desc":
      return isValidDescBoundary(payload, offset);
    case "mluc":
      return isValidMlucBoundary(payload, offset);
    case "text":
      return offset + 8 <= payload.byteLength;
    default:
      return false;
  }
}

function isValidDescBoundary(payload: Uint8Array, offset: number): boolean {
  if (offset + 12 > payload.byteLength) {
    return false;
  }

  const asciiLength = readU32(payload, offset + 8);
  return offset + 12 + asciiLength <= payload.byteLength;
}

function isValidMlucBoundary(payload: Uint8Array, offset: number): boolean {
  if (offset + 16 > payload.byteLength) {
    return false;
  }

  const recordCount = readU32(payload, offset + 8);
  const recordSize = readU32(payload, offset + 12);
  if (recordSize < 12) {
    return false;
  }

  const recordsEnd = offset + 16 + recordCount * recordSize;
  if (recordsEnd > payload.byteLength) {
    return false;
  }

  let size = 16 + recordCount * recordSize;
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = offset + 16 + index * recordSize;
    const length = readU32(payload, recordOffset + 4);
    const textOffset = readU32(payload, recordOffset + 8);
    if (offset + textOffset + length > payload.byteLength) {
      return false;
    }
    size = Math.max(size, textOffset + length);
  }

  return offset + align4(size) <= payload.byteLength;
}

function parseProfileSequenceDescTag(payload: Uint8Array): CmsProfileSequenceDescTagValue {
  const count = readU32(payload, 8);
  const entries: CmsProfileSequenceEntry[] = [];
  let cursor = 12;

  for (let i = 0; i < count; i += 1) {
    const deviceMfg = readSignature(payload, cursor);
    const deviceModel = readSignature(payload, cursor + 4);
    const attributes = readU64(payload, cursor + 8);
    const technology = readSignature(payload, cursor + 16);
    let textCursor = cursor + 20;
    const manufacturer = parseEmbeddedTextTag(payload, textCursor);
    textCursor = manufacturer.nextOffset;
    const model = parseEmbeddedTextTag(payload, textCursor);
    cursor = model.nextOffset;

    entries.push({
      deviceMfg,
      deviceModel,
      attributes,
      technology,
      manufacturer: manufacturer.value,
      model: model.value,
    });
  }

  return { kind: "pseq", entries };
}

function parseProfileSequenceIdTag(payload: Uint8Array): CmsProfileSequenceIdTagValue {
  const count = readU32(payload, 8);
  const entries: CmsProfileSequenceEntry[] = [];
  const tableOffset = 12;
  const baseOffset = 0;

  for (let i = 0; i < count; i += 1) {
    const entryOffset = readU32(payload, tableOffset + i * 8) + baseOffset;
    const size = readU32(payload, tableOffset + i * 8 + 4);
    const slice = payload.slice(entryOffset, entryOffset + size);
    const profileId = Array.from(slice.slice(0, 16), (value) => value.toString(16).padStart(2, "0")).join("");
    const description = parseEmbeddedTextTag(slice, 16).value;

    entries.push({
      deviceMfg: "    ",
      deviceModel: "    ",
      attributes: 0n,
      technology: "    ",
      manufacturer: { kind: "text", text: "" },
      model: { kind: "text", text: "" },
      profileId,
      description,
    });
  }

  return { kind: "psid", entries };
}

function parseUcrBgTag(payload: Uint8Array): CmsUcrBgTagValue {
  const countUcr = readU32(payload, 8);
  let cursor = 12;
  const ucrValues = new Uint16Array(countUcr);
  for (let i = 0; i < countUcr; i += 1) {
    ucrValues[i] = readU16(payload, cursor + i * 2);
  }
  cursor += countUcr * 2;

  const countBg = readU32(payload, cursor);
  cursor += 4;
  const bgValues = new Uint16Array(countBg);
  for (let i = 0; i < countBg; i += 1) {
    bgValues[i] = readU16(payload, cursor + i * 2);
  }
  cursor += countBg * 2;

  return {
    kind: "bfd",
    ucr: {
      kind: "curv",
      curve: cmsBuildTabulatedToneCurve16(countUcr, ucrValues),
      entryCount: countUcr,
    },
    bg: {
      kind: "curv",
      curve: cmsBuildTabulatedToneCurve16(countBg, bgValues),
      entryCount: countBg,
    },
    text: trimTrailingNul(readAscii(payload, cursor, payload.byteLength - cursor)),
  };
}

function parseCountAndString(payload: Uint8Array, offset: number): { text: string; nextOffset: number } {
  const count = readU32(payload, offset);
  const text = readAscii(payload, offset + 4, count);
  return {
    text: trimTrailingNul(text),
    nextOffset: offset + 4 + count,
  };
}

function parseCrdInfoTag(payload: Uint8Array): CmsCrdInfoTagValue {
  let cursor = 8;
  const nm = parseCountAndString(payload, cursor);
  cursor = nm.nextOffset;
  const ri0 = parseCountAndString(payload, cursor);
  cursor = ri0.nextOffset;
  const ri1 = parseCountAndString(payload, cursor);
  cursor = ri1.nextOffset;
  const ri2 = parseCountAndString(payload, cursor);
  cursor = ri2.nextOffset;
  const ri3 = parseCountAndString(payload, cursor);

  return {
    kind: "crdi",
    productName: nm.text,
    renderingIntent0: ri0.text,
    renderingIntent1: ri1.text,
    renderingIntent2: ri2.text,
    renderingIntent3: ri3.text,
  };
}

function parseScreeningTag(payload: Uint8Array): CmsScreeningTagValue {
  const flag = readU32(payload, 8);
  const channelCount = readU32(payload, 12);
  const channels: CmsScreeningChannel[] = [];
  let cursor = 16;
  for (let i = 0; i < channelCount; i += 1) {
    channels.push({
      frequency: readS15Fixed16(payload, cursor),
      screenAngle: readS15Fixed16(payload, cursor + 4),
      spotShape: readU32(payload, cursor + 8),
    });
    cursor += 12;
  }
  return {
    kind: "scrn",
    flag,
    channels,
  };
}

function parseNamedColorTag(payload: Uint8Array): CmsNamedColorTagValue {
  const vendorFlag = readU32(payload, 8);
  const count = readU32(payload, 12);
  const deviceCoordCount = readU32(payload, 16);
  const prefix = trimTrailingNul(readAscii(payload, 20, 32));
  const suffix = trimTrailingNul(readAscii(payload, 52, 32));
  const entries: CmsNamedColorEntry[] = [];
  let cursor = 84;

  for (let index = 0; index < count; index += 1) {
    const name = trimTrailingNul(readAscii(payload, cursor, 32));
    const pcs: [number, number, number] = [
      readU16(payload, cursor + 32),
      readU16(payload, cursor + 34),
      readU16(payload, cursor + 36),
    ];
    const deviceCoords = Array.from({ length: deviceCoordCount }, (_, coordIndex) => readU16(payload, cursor + 38 + coordIndex * 2));
    entries.push({ name, pcs, deviceCoords });
    cursor += 38 + deviceCoordCount * 2;
  }

  return {
    kind: "ncl2",
    vendorFlag,
    prefix,
    suffix,
    entries,
  };
}

function readUtf16BeString(payload: Uint8Array, offset: number, byteLength: number): string {
  return readUtf16Be(payload, offset, byteLength);
}

function parseDictionaryTag(payload: Uint8Array): CmsDictionaryTagValue {
  const count = readU32(payload, 8);
  const recordLength = readU32(payload, 12);
  if (recordLength !== 16 && recordLength !== 24 && recordLength !== 32) {
    throw new Error(`Unsupported dictionary record length: ${recordLength}`);
  }

  const entries: CmsDictionaryEntry[] = [];
  let cursor = 16;

  for (let index = 0; index < count; index += 1) {
    const nameOffset = readU32(payload, cursor);
    const nameSize = readU32(payload, cursor + 4);
    const valueOffset = readU32(payload, cursor + 8);
    const valueSize = readU32(payload, cursor + 12);
    let displayName: CmsMlucTagValue | undefined;
    let displayValue: CmsMlucTagValue | undefined;

    if (recordLength > 16) {
      const displayNameOffset = readU32(payload, cursor + 16);
      const displayNameSize = readU32(payload, cursor + 20);
      if (displayNameOffset !== 0 && displayNameSize !== 0) {
        const parsed = parseMlucTag(payload.slice(displayNameOffset, displayNameOffset + displayNameSize));
        displayName = parsed;
      }
    }

    if (recordLength > 24) {
      const displayValueOffset = readU32(payload, cursor + 24);
      const displayValueSize = readU32(payload, cursor + 28);
      if (displayValueOffset !== 0 && displayValueSize !== 0) {
        const parsed = parseMlucTag(payload.slice(displayValueOffset, displayValueOffset + displayValueSize));
        displayValue = parsed;
      }
    }

    entries.push({
      name: trimTrailingNul(readUtf16BeString(payload, nameOffset, nameSize)),
      value: trimTrailingNul(readUtf16BeString(payload, valueOffset, valueSize)),
      ...(displayName ? { displayName } : {}),
      ...(displayValue ? { displayValue } : {}),
    });

    cursor += recordLength;
  }

  return {
    kind: "dict",
    entries,
  };
}

function parseS15Fixed16ArrayTag(payload: Uint8Array): CmsS15Fixed16ArrayTagValue {
  const count = (payload.byteLength - 8) / 4;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(readS15Fixed16(payload, 8 + index * 4));
  }
  return {
    kind: "sf32",
    values,
  };
}

function parseU16Fixed16ArrayTag(payload: Uint8Array): CmsU16Fixed16ArrayTagValue {
  const count = (payload.byteLength - 8) / 4;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(readU32(payload, 8 + index * 4) / 65536);
  }
  return {
    kind: "uf32",
    values,
  };
}

function parseColorantOrderTag(payload: Uint8Array): CmsColorantOrderTagValue {
  const count = readU32(payload, 8);
  const colorants: number[] = [];
  for (let index = 0; index < count; index += 1) {
    colorants.push(payload[12 + index] ?? 0);
  }
  return {
    kind: "clro",
    colorants,
  };
}

function parseUInt8ArrayTag(payload: Uint8Array): CmsUInt8ArrayTagValue {
  return {
    kind: "ui08",
    values: payload.slice(8),
  };
}

function parseUInt32ArrayTag(payload: Uint8Array): CmsUInt32ArrayTagValue {
  const count = (payload.byteLength - 8) / 4;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(readU32(payload, 8 + index * 4));
  }
  return {
    kind: "ui32",
    values,
  };
}

function parseUInt64ArrayTag(payload: Uint8Array): CmsUInt64ArrayTagValue {
  const count = (payload.byteLength - 8) / 8;
  const values: bigint[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(readU64(payload, 8 + index * 8));
  }
  return {
    kind: "ui64",
    values,
  };
}

function parseVideoSignalTag(payload: Uint8Array): CmsVideoSignalTagValue {
  return {
    kind: "cicp",
    colourPrimaries: payload[8] ?? 0,
    transferCharacteristics: payload[9] ?? 0,
    matrixCoefficients: payload[10] ?? 0,
    videoFullRangeFlag: payload[11] ?? 0,
  };
}

function parseVcgtTag(payload: Uint8Array): CmsVcgtTagValue {
  const tagType = readU32(payload, 8);

  switch (tagType) {
    case 0: {
      const channelCount = readU16(payload, 12);
      const entryCount = readU16(payload, 14);
      let bytesPerEntry = readU16(payload, 16);
      let cursor = 18;

      if (channelCount !== 3) {
        throw new Error(`Unsupported VCGT channel count: ${channelCount}`);
      }

      if (entryCount === 256 && bytesPerEntry === 1 && payload.byteLength === 1576) {
        bytesPerEntry = 2;
      }

      const curves: [CmsToneCurve, CmsToneCurve, CmsToneCurve] = [
        cmsBuildTabulatedToneCurve16(entryCount),
        cmsBuildTabulatedToneCurve16(entryCount),
        cmsBuildTabulatedToneCurve16(entryCount),
      ];

      for (let channel = 0; channel < 3; channel += 1) {
        const table = curves[channel]!.table16;
        for (let index = 0; index < entryCount; index += 1) {
          if (bytesPerEntry === 1) {
            const value = payload[cursor] ?? 0;
            table[index] = value * 257;
            cursor += 1;
          } else if (bytesPerEntry === 2) {
            table[index] = readU16(payload, cursor);
            cursor += 2;
          } else {
            throw new Error(`Unsupported VCGT element width: ${bytesPerEntry}`);
          }
        }
      }

      return {
        kind: "vcgt",
        storage: "table",
        curves,
      };
    }
    case 1: {
      const curves: CmsToneCurve[] = [];

      for (let channel = 0; channel < 3; channel += 1) {
        const gamma = readS15Fixed16(payload, 12 + channel * 12);
        const min = readS15Fixed16(payload, 16 + channel * 12);
        const max = readS15Fixed16(payload, 20 + channel * 12);
        const a = (max - min) ** (1 / gamma);
        curves.push(cmsBuildParametricToneCurve(5, [gamma, a, 0, 0, 0, min, 0]));
      }

      return {
        kind: "vcgt",
        storage: "formula",
        curves: [curves[0]!, curves[1]!, curves[2]!],
      };
    }
    default:
      throw new Error(`Unsupported VCGT storage type: ${tagType}`);
  }
}

function parseMhc2Tag(payload: Uint8Array): CmsMhc2TagValue {
  const curveEntries = readU32(payload, 8);
  const minLuminance = readS15Fixed16(payload, 12);
  const peakLuminance = readS15Fixed16(payload, 16);
  const matrixOffset = readU32(payload, 20);
  const redOffset = readU32(payload, 24);
  const greenOffset = readU32(payload, 28);
  const blueOffset = readU32(payload, 32);

  const xyzToXyzMatrix =
    matrixOffset === 0
      ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]
      : Array.from({ length: 12 }, (_, index) => readS15Fixed16(payload, matrixOffset + index * 4));

  function readCurve(offset: number): readonly number[] {
    const type = readSignature(payload, offset);
    if (type !== "sf32") {
      throw new Error(`Unsupported MHC2 curve payload type ${JSON.stringify(type)}`);
    }
    return Array.from({ length: curveEntries }, (_, index) => readS15Fixed16(payload, offset + 8 + index * 4));
  }

  return {
    kind: "MHC2",
    curveEntries,
    minLuminance,
    peakLuminance,
    xyzToXyzMatrix,
    redCurve: readCurve(redOffset),
    greenCurve: readCurve(greenOffset),
    blueCurve: readCurve(blueOffset),
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
