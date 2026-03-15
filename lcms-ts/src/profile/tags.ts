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

export interface CmsParametricCurveTagValue {
  readonly kind: "para";
  readonly functionType: number;
  readonly parameters: readonly number[];
  readonly curve: CmsToneCurve;
}

export type CmsParsedTagValue =
  | CmsChromaticityTagValue
  | CmsColorantTableTagValue
  | CmsCurveTagValue
  | CmsCrdInfoTagValue
  | CmsDataTagValue
  | CmsDateTimeTagValue
  | CmsDescTagValue
  | CmsMeasurementTagValue
  | CmsParsedLutTagValue
  | CmsMlucTagValue
  | CmsParametricCurveTagValue
  | CmsProfileSequenceDescTagValue
  | CmsProfileSequenceIdTagValue
  | CmsScreeningTagValue
  | CmsSignatureTagValue
  | CmsTextTagValue
  | CmsUcrBgTagValue
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
    case "meas":
      return parseMeasurementTag(payload);
    case "para":
      return parseParametricCurveTag(payload);
    case "pseq":
      return parseProfileSequenceDescTag(payload);
    case "psid":
      return parseProfileSequenceIdTag(payload);
    case "scrn":
      return parseScreeningTag(payload);
    case "sig ":
      return parseSignatureTag(payload);
    case "bfd ":
      return parseUcrBgTag(payload);
    case "view":
      return parseViewingConditionsTag(payload);
    case "chrm":
      return parseChromaticityTag(payload);
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
      // Embedded text is last field in current structures, so consume remaining bytes.
      return {
        value: parseTextTag(payload.slice(offset)),
        nextOffset: payload.byteLength,
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
