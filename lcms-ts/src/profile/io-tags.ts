import type { CmsIccXYZNumber } from "./header.js";
import {
  type CmsIccDateTime,
  writeDateTime,
  writeProfileId,
  writeS15Fixed16,
  writeSignature,
  writeU16,
  writeU32,
  writeU64,
} from "./io-base.js";
import {
  serializeIccLutTag,
  type CmsLut16TagValue,
  type CmsLut8TagValue,
  type CmsMultiProcessElementTagValue,
} from "./lut.js";
import type {
  CmsCurveTagValue,
  CmsCrdInfoTagValue,
  CmsChromaticityTagValue,
  CmsColorantTableTagValue,
  CmsDataTagValue,
  CmsDateTimeTagValue,
  CmsDescTagValue,
  CmsEmbeddedTextTagValue,
  CmsLocalizedString,
  CmsMeasurementTagValue,
  CmsMlucTagValue,
  CmsParametricCurveTagValue,
  CmsParsedTagValue,
  CmsProfileSequenceDescTagValue,
  CmsProfileSequenceIdTagValue,
  CmsScreeningTagValue,
  CmsSignatureTagValue,
  CmsTextTagValue,
  CmsUcrBgTagValue,
  CmsViewingConditionsTagValue,
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

function serializeDateTimeValue(buffer: Uint8Array, offset: number, value: CmsIccDateTime): void {
  writeDateTime(buffer, offset, value);
}

function serializeDataTag(value: CmsDataTagValue): Uint8Array {
  const buffer = new Uint8Array(12 + value.bytes.byteLength);
  writeSignature(buffer, 0, "data");
  writeU32(buffer, 8, value.flag);
  buffer.set(value.bytes, 12);
  return buffer;
}

function serializeDateTimeTag(value: CmsDateTimeTagValue): Uint8Array {
  const buffer = new Uint8Array(20);
  writeSignature(buffer, 0, "dtim");
  serializeDateTimeValue(buffer, 8, value.value);
  return buffer;
}

function serializeMeasurementTag(value: CmsMeasurementTagValue): Uint8Array {
  const buffer = new Uint8Array(36);
  writeSignature(buffer, 0, "meas");
  writeU32(buffer, 8, value.observer);
  writeXyzNumber(buffer, 12, value.backing);
  writeU32(buffer, 24, value.geometry);
  writeS15Fixed16(buffer, 28, value.flare);
  writeU32(buffer, 32, value.illuminantType);
  return buffer;
}

function serializeSignatureTag(value: CmsSignatureTagValue): Uint8Array {
  const buffer = new Uint8Array(12);
  writeSignature(buffer, 0, "sig ");
  writeSignature(buffer, 8, value.signature);
  return buffer;
}

function serializeViewingConditionsTag(value: CmsViewingConditionsTagValue): Uint8Array {
  const buffer = new Uint8Array(36);
  writeSignature(buffer, 0, "view");
  writeXyzNumber(buffer, 8, value.illuminant);
  writeXyzNumber(buffer, 20, value.surround);
  writeU32(buffer, 32, value.illuminantType);
  return buffer;
}

function serializeChromaticityPoint(buffer: Uint8Array, offset: number, x: number, y: number): void {
  writeS15Fixed16(buffer, offset, x);
  writeS15Fixed16(buffer, offset + 4, y);
}

function serializeChromaticityTag(value: CmsChromaticityTagValue): Uint8Array {
  if (value.channels !== 3) {
    throw new Error(`Unsupported chromaticity channel count: ${value.channels}`);
  }

  const buffer = new Uint8Array(36);
  writeSignature(buffer, 0, "chrm");
  writeU16(buffer, 8, value.channels);
  writeU16(buffer, 10, value.phosphorOrColorantType);
  serializeChromaticityPoint(buffer, 12, value.red.x, value.red.y);
  serializeChromaticityPoint(buffer, 20, value.green.x, value.green.y);
  serializeChromaticityPoint(buffer, 28, value.blue.x, value.blue.y);
  return buffer;
}

function serializeColorantTableTag(value: CmsColorantTableTagValue): Uint8Array {
  const buffer = new Uint8Array(12 + value.entries.length * 38);
  writeSignature(buffer, 0, "clrt");
  writeU32(buffer, 8, value.entries.length);

  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = value.entries[index]!;
    const offset = 12 + index * 38;
    const nameBytes = encodeAscii(entry.name.slice(0, 31), true);
    buffer.set(nameBytes.slice(0, 32), offset);
    writeU16(buffer, offset + 32, entry.pcs[0] ?? 0);
    writeU16(buffer, offset + 34, entry.pcs[1] ?? 0);
    writeU16(buffer, offset + 36, entry.pcs[2] ?? 0);
  }

  return buffer;
}

function serializeEmbeddedTextTag(value: CmsEmbeddedTextTagValue): Uint8Array {
  switch (value.kind) {
    case "desc":
      return serializeDescTag(value);
    case "text":
      return serializeTextTag(value);
    case "mluc":
      return serializeMlucTag(value);
  }
}

function serializeProfileSequenceDescTag(value: CmsProfileSequenceDescTagValue): Uint8Array {
  const entryPayloads = value.entries.map((entry) => {
    const manufacturer = serializeEmbeddedTextTag(entry.manufacturer);
    const model = serializeEmbeddedTextTag(entry.model);
    const payload = new Uint8Array(20 + manufacturer.byteLength + model.byteLength);
    writeSignature(payload, 0, entry.deviceMfg);
    writeSignature(payload, 4, entry.deviceModel);
    writeU64(payload, 8, entry.attributes);
    writeSignature(payload, 16, entry.technology);
    payload.set(manufacturer, 20);
    payload.set(model, 20 + manufacturer.byteLength);
    return payload;
  });

  const total = 12 + entryPayloads.reduce((sum, payload) => sum + payload.byteLength, 0);
  const buffer = new Uint8Array(total);
  writeSignature(buffer, 0, "pseq");
  writeU32(buffer, 8, value.entries.length);
  let cursor = 12;
  for (const payload of entryPayloads) {
    buffer.set(payload, cursor);
    cursor += payload.byteLength;
  }
  return buffer;
}

function serializeProfileSequenceIdTag(value: CmsProfileSequenceIdTagValue): Uint8Array {
  const entryPayloads = value.entries.map((entry) => {
    const description = serializeEmbeddedTextTag(entry.description ?? { kind: "text", text: "" });
    const payload = new Uint8Array(16 + description.byteLength);
    writeProfileId(payload, 0, entry.profileId ?? "00000000000000000000000000000000");
    payload.set(description, 16);
    return payload;
  });

  const directorySize = value.entries.length * 8;
  const entryBase = 12 + directorySize;
  const total = entryBase + entryPayloads.reduce((sum, payload) => sum + payload.byteLength, 0);
  const buffer = new Uint8Array(total);
  writeSignature(buffer, 0, "psid");
  writeU32(buffer, 8, value.entries.length);

  let cursor = entryBase;
  for (let index = 0; index < entryPayloads.length; index += 1) {
    const payload = entryPayloads[index]!;
    writeU32(buffer, 12 + index * 8, cursor);
    writeU32(buffer, 12 + index * 8 + 4, payload.byteLength);
    buffer.set(payload, cursor);
    cursor += payload.byteLength;
  }

  return buffer;
}

function serializeUcrBgTag(value: CmsUcrBgTagValue): Uint8Array {
  const ucrCount = value.ucr.entryCount;
  const bgCount = value.bg.entryCount;
  const textBytes = encodeAscii(value.text, true);
  const buffer = new Uint8Array(16 + ucrCount * 2 + bgCount * 2 + textBytes.byteLength);
  writeSignature(buffer, 0, "bfd ");
  writeU32(buffer, 8, ucrCount);
  let cursor = 12;
  for (let i = 0; i < ucrCount; i += 1) {
    writeU16(buffer, cursor + i * 2, value.ucr.curve.table16[i] ?? 0);
  }
  cursor += ucrCount * 2;
  writeU32(buffer, cursor, bgCount);
  cursor += 4;
  for (let i = 0; i < bgCount; i += 1) {
    writeU16(buffer, cursor + i * 2, value.bg.curve.table16[i] ?? 0);
  }
  cursor += bgCount * 2;
  buffer.set(textBytes, cursor);
  return buffer;
}

function serializeCountAndString(buffer: Uint8Array, offset: number, text: string): number {
  const bytes = encodeAscii(text, true);
  writeU32(buffer, offset, bytes.byteLength);
  buffer.set(bytes, offset + 4);
  return offset + 4 + bytes.byteLength;
}

function serializeCrdInfoTag(value: CmsCrdInfoTagValue): Uint8Array {
  const sizes = [
    encodeAscii(value.productName, true).byteLength,
    encodeAscii(value.renderingIntent0, true).byteLength,
    encodeAscii(value.renderingIntent1, true).byteLength,
    encodeAscii(value.renderingIntent2, true).byteLength,
    encodeAscii(value.renderingIntent3, true).byteLength,
  ];
  const buffer = new Uint8Array(8 + sizes.reduce((sum, size) => sum + 4 + size, 0));
  writeSignature(buffer, 0, "crdi");
  let cursor = 8;
  cursor = serializeCountAndString(buffer, cursor, value.productName);
  cursor = serializeCountAndString(buffer, cursor, value.renderingIntent0);
  cursor = serializeCountAndString(buffer, cursor, value.renderingIntent1);
  cursor = serializeCountAndString(buffer, cursor, value.renderingIntent2);
  serializeCountAndString(buffer, cursor, value.renderingIntent3);
  return buffer;
}

function serializeScreeningTag(value: CmsScreeningTagValue): Uint8Array {
  const buffer = new Uint8Array(16 + value.channels.length * 12);
  writeSignature(buffer, 0, "scrn");
  writeU32(buffer, 8, value.flag);
  writeU32(buffer, 12, value.channels.length);
  let cursor = 16;
  for (const channel of value.channels) {
    writeS15Fixed16(buffer, cursor, channel.frequency);
    writeS15Fixed16(buffer, cursor + 4, channel.screenAngle);
    writeU32(buffer, cursor + 8, channel.spotShape);
    cursor += 12;
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
    | CmsCrdInfoTagValue
    | CmsChromaticityTagValue
    | CmsColorantTableTagValue
    | CmsDataTagValue
    | CmsDateTimeTagValue
    | CmsDescTagValue
    | CmsLut16TagValue
    | CmsLut8TagValue
    | CmsMeasurementTagValue
    | CmsMultiProcessElementTagValue
    | CmsMlucTagValue
    | CmsParametricCurveTagValue
    | CmsProfileSequenceDescTagValue
    | CmsProfileSequenceIdTagValue
    | CmsScreeningTagValue
    | CmsSignatureTagValue
    | CmsTextTagValue
    | CmsUcrBgTagValue
    | CmsViewingConditionsTagValue
    | CmsXyzTagValue,
): Uint8Array {
  switch (value.kind) {
    case "chrm":
      return serializeChromaticityTag(value);
    case "clrt":
      return serializeColorantTableTag(value);
    case "desc":
      return serializeDescTag(value);
    case "crdi":
      return serializeCrdInfoTag(value);
    case "data":
      return serializeDataTag(value);
    case "dtim":
      return serializeDateTimeTag(value);
    case "text":
      return serializeTextTag(value);
    case "mft1":
    case "mft2":
    case "mAB":
    case "mBA":
      return serializeIccLutTag(value);
    case "mluc":
      return serializeMlucTag(value);
    case "meas":
      return serializeMeasurementTag(value);
    case "XYZ":
      return serializeXyzTag(value);
    case "curv":
      return serializeCurveTag(value);
    case "para":
      return serializeParametricCurveTag(value);
    case "pseq":
      return serializeProfileSequenceDescTag(value);
    case "psid":
      return serializeProfileSequenceIdTag(value);
    case "scrn":
      return serializeScreeningTag(value);
    case "sig":
      return serializeSignatureTag(value);
    case "bfd":
      return serializeUcrBgTag(value);
    case "view":
      return serializeViewingConditionsTag(value);
  }
}

export interface CmsSerializedTagRecord {
  readonly signature: string;
  readonly payload: Uint8Array;
  readonly payloadKey?: string;
}

export function serializeIccTagRecord(
  signature: string,
  value: Parameters<typeof serializeIccTagValue>[0],
  payloadKey?: string,
): CmsSerializedTagRecord {
  return {
    signature,
    payload: serializeIccTagValue(value),
    ...(payloadKey ? { payloadKey } : {}),
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
  const payloadOffsets = new Map<string, { offset: number; size: number }>();
  let offset = payloadOffset;

  for (const record of records) {
    const key = record.payloadKey ?? `unique:${entries.length}`;
    const shared = payloadOffsets.get(key);

    if (shared) {
      entries.push({
        signature: record.signature,
        offset: shared.offset,
        size: shared.size,
      });
      continue;
    }

    const entry = {
      signature: record.signature,
      offset,
      size: record.payload.byteLength,
    };
    entries.push(entry);
    payloadOffsets.set(key, { offset: entry.offset, size: entry.size });
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
    if (payloadBytes.slice(payloadWriteOffset, payloadWriteOffset + record.payload.byteLength).some((value) => value !== 0)) {
      continue;
    }
    payloadBytes.set(record.payload, payloadWriteOffset);
  }

  return { tagTable, payloadBytes, entries };
}
