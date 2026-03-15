import type { CmsIccXYZNumber } from "./header.js";
import { cmsEvalToneCurveFloat, type CmsToneCurve } from "../tone-curve/index.js";
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
  CmsDictionaryTagValue,
  CmsDescTagValue,
  CmsEmbeddedTextTagValue,
  CmsLocalizedString,
  CmsMhc2TagValue,
  CmsMeasurementTagValue,
  CmsMlucTagValue,
  CmsNamedColorTagValue,
  CmsParametricCurveTagValue,
  CmsParsedTagValue,
  CmsProfileSequenceDescTagValue,
  CmsProfileSequenceIdTagValue,
  CmsS15Fixed16ArrayTagValue,
  CmsScreeningTagValue,
  CmsSignatureTagValue,
  CmsTextTagValue,
  CmsUInt32ArrayTagValue,
  CmsUInt64ArrayTagValue,
  CmsUInt8ArrayTagValue,
  CmsUcrBgTagValue,
  CmsVcgtTagValue,
  CmsVideoSignalTagValue,
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

function encodeAsciiFixed(text: string, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const limit = Math.min(text.length, length - 1);
  for (let index = 0; index < limit; index += 1) {
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

function serializeNamedColorTag(value: CmsNamedColorTagValue): Uint8Array {
  const deviceCoordCount = value.entries[0]?.deviceCoords.length ?? 0;
  for (const entry of value.entries) {
    if (entry.deviceCoords.length !== deviceCoordCount) {
      throw new Error("Named color entries must use a consistent device coordinate count");
    }
  }

  const recordSize = 38 + deviceCoordCount * 2;
  const buffer = new Uint8Array(84 + value.entries.length * recordSize);
  writeSignature(buffer, 0, "ncl2");
  writeU32(buffer, 8, value.vendorFlag);
  writeU32(buffer, 12, value.entries.length);
  writeU32(buffer, 16, deviceCoordCount);
  buffer.set(encodeAsciiFixed(value.prefix, 32), 20);
  buffer.set(encodeAsciiFixed(value.suffix, 32), 52);

  let cursor = 84;
  for (const entry of value.entries) {
    buffer.set(encodeAsciiFixed(entry.name, 32), cursor);
    writeU16(buffer, cursor + 32, entry.pcs[0] ?? 0);
    writeU16(buffer, cursor + 34, entry.pcs[1] ?? 0);
    writeU16(buffer, cursor + 36, entry.pcs[2] ?? 0);
    for (let index = 0; index < deviceCoordCount; index += 1) {
      writeU16(buffer, cursor + 38 + index * 2, entry.deviceCoords[index] ?? 0);
    }
    cursor += recordSize;
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

function serializeDictionaryTag(value: CmsDictionaryTagValue): Uint8Array {
  const anyDisplayName = value.entries.some((entry) => entry.displayName);
  const anyDisplayValue = value.entries.some((entry) => entry.displayValue);
  const recordLength = 16 + (anyDisplayName ? 8 : 0) + (anyDisplayValue ? 8 : 0);
  const directorySize = value.entries.length * recordLength;
  const variableChunks: Uint8Array[] = [];
  const buffer = new Uint8Array(16 + directorySize + value.entries.reduce((sum, entry) => {
    const nameBytes = encodeUtf16Be(entry.name);
    const valueBytes = encodeUtf16Be(entry.value);
    const displayNameBytes = entry.displayName ? serializeMlucTag(entry.displayName) : undefined;
    const displayValueBytes = entry.displayValue ? serializeMlucTag(entry.displayValue) : undefined;
    variableChunks.push(nameBytes, valueBytes);
    if (displayNameBytes) {
      variableChunks.push(displayNameBytes);
    }
    if (displayValueBytes) {
      variableChunks.push(displayValueBytes);
    }
    let total = align4(nameBytes.byteLength) + align4(valueBytes.byteLength);
    if (displayNameBytes) {
      total += align4(displayNameBytes.byteLength);
    }
    if (displayValueBytes) {
      total += align4(displayValueBytes.byteLength);
    }
    return sum + total;
  }, 0));

  writeSignature(buffer, 0, "dict");
  writeU32(buffer, 8, value.entries.length);
  writeU32(buffer, 12, recordLength);

  let recordOffset = 16;
  let dataOffset = 16 + directorySize;

  function writeChunk(chunk: Uint8Array): { offset: number; size: number } {
    const offset = dataOffset;
    buffer.set(chunk, offset);
    dataOffset = align4(offset + chunk.byteLength);
    return { offset, size: chunk.byteLength };
  }

  for (const entry of value.entries) {
    const nameChunk = writeChunk(encodeUtf16Be(entry.name));
    const valueChunk = writeChunk(encodeUtf16Be(entry.value));
    writeU32(buffer, recordOffset, nameChunk.offset);
    writeU32(buffer, recordOffset + 4, nameChunk.size);
    writeU32(buffer, recordOffset + 8, valueChunk.offset);
    writeU32(buffer, recordOffset + 12, valueChunk.size);

    let optionalOffset = recordOffset + 16;
    if (anyDisplayName) {
      if (entry.displayName) {
        const chunk = writeChunk(serializeMlucTag(entry.displayName));
        writeU32(buffer, optionalOffset, chunk.offset);
        writeU32(buffer, optionalOffset + 4, chunk.size);
      }
      optionalOffset += 8;
    }
    if (anyDisplayValue && entry.displayValue) {
      const chunk = writeChunk(serializeMlucTag(entry.displayValue));
      writeU32(buffer, optionalOffset, chunk.offset);
      writeU32(buffer, optionalOffset + 4, chunk.size);
    }

    recordOffset += recordLength;
  }

  return buffer;
}

function serializeS15Fixed16ArrayTag(value: CmsS15Fixed16ArrayTagValue): Uint8Array {
  const buffer = new Uint8Array(8 + value.values.length * 4);
  writeSignature(buffer, 0, "sf32");
  for (let index = 0; index < value.values.length; index += 1) {
    writeS15Fixed16(buffer, 8 + index * 4, value.values[index]!);
  }
  return buffer;
}

function serializeUInt8ArrayTag(value: CmsUInt8ArrayTagValue): Uint8Array {
  const buffer = new Uint8Array(8 + value.values.byteLength);
  writeSignature(buffer, 0, "ui08");
  buffer.set(value.values, 8);
  return buffer;
}

function serializeUInt32ArrayTag(value: CmsUInt32ArrayTagValue): Uint8Array {
  const buffer = new Uint8Array(8 + value.values.length * 4);
  writeSignature(buffer, 0, "ui32");
  for (let index = 0; index < value.values.length; index += 1) {
    writeU32(buffer, 8 + index * 4, value.values[index]!);
  }
  return buffer;
}

function serializeUInt64ArrayTag(value: CmsUInt64ArrayTagValue): Uint8Array {
  const buffer = new Uint8Array(8 + value.values.length * 8);
  writeSignature(buffer, 0, "ui64");
  for (let index = 0; index < value.values.length; index += 1) {
    writeU64(buffer, 8 + index * 8, value.values[index]!);
  }
  return buffer;
}

function isVcgtFormulaCurve(curve: CmsToneCurve): curve is CmsToneCurve & { readonly parametricType: 5; readonly params: readonly number[] } {
  return curve.parametricType === 5 && Array.isArray(curve.params) && curve.params.length >= 6;
}

function serializeVcgtTag(value: CmsVcgtTagValue): Uint8Array {
  const [red, green, blue] = value.curves;
  const allFormula = isVcgtFormulaCurve(red) && isVcgtFormulaCurve(green) && isVcgtFormulaCurve(blue);

  if (value.storage === "formula" && allFormula) {
    const buffer = new Uint8Array(48);
    writeSignature(buffer, 0, "vcgt");
    writeU32(buffer, 8, 1);
    for (let index = 0; index < 3; index += 1) {
      const curve = value.curves[index]!;
      if (!isVcgtFormulaCurve(curve)) {
        throw new Error("VCGT formula storage requires parametric type 5 curves");
      }
      const gamma = curve.params[0]!;
      const min = curve.params[5] ?? 0;
      const max = (curve.params[1] ?? 0) ** gamma + min;
      const offset = 12 + index * 12;
      writeS15Fixed16(buffer, offset, gamma);
      writeS15Fixed16(buffer, offset + 4, min);
      writeS15Fixed16(buffer, offset + 8, max);
    }
    return buffer;
  }

  const tableEntryCount = 256;
  const buffer = new Uint8Array(18 + 3 * tableEntryCount * 2);
  writeSignature(buffer, 0, "vcgt");
  writeU32(buffer, 8, 0);
  writeU16(buffer, 12, 3);
  writeU16(buffer, 14, tableEntryCount);
  writeU16(buffer, 16, 2);

  let cursor = 18;
  for (const curve of value.curves) {
    for (let index = 0; index < tableEntryCount; index += 1) {
      const sample = cmsEvalToneCurveFloat(curve, index / (tableEntryCount - 1));
      writeU16(buffer, cursor, Math.max(0, Math.min(65535, Math.round(sample * 65535))));
      cursor += 2;
    }
  }

  return buffer;
}

function serializeVideoSignalTag(value: CmsVideoSignalTagValue): Uint8Array {
  const buffer = new Uint8Array(12);
  writeSignature(buffer, 0, "cicp");
  buffer[8] = value.colourPrimaries & 0xff;
  buffer[9] = value.transferCharacteristics & 0xff;
  buffer[10] = value.matrixCoefficients & 0xff;
  buffer[11] = value.videoFullRangeFlag & 0xff;
  return buffer;
}

function matrixIsIdentity(values: readonly number[]): boolean {
  return (
    values.length >= 12 &&
    values[0] === 1 &&
    values[1] === 0 &&
    values[2] === 0 &&
    values[3] === 0 &&
    values[4] === 0 &&
    values[5] === 1 &&
    values[6] === 0 &&
    values[7] === 0 &&
    values[8] === 0 &&
    values[9] === 0 &&
    values[10] === 1 &&
    values[11] === 0
  );
}

function serializeMhc2Tag(value: CmsMhc2TagValue): Uint8Array {
  const hasMatrix = !matrixIsIdentity(value.xyzToXyzMatrix);
  const matrixSize = hasMatrix ? 12 * 4 : 0;
  const curveBlockSize = 8 + value.curveEntries * 4;
  const matrixOffset = hasMatrix ? 36 : 0;
  const redOffset = 36 + matrixSize;
  const greenOffset = redOffset + curveBlockSize;
  const blueOffset = greenOffset + curveBlockSize;
  const buffer = new Uint8Array(blueOffset + curveBlockSize);

  writeSignature(buffer, 0, "MHC2");
  writeU32(buffer, 8, value.curveEntries);
  writeS15Fixed16(buffer, 12, value.minLuminance);
  writeS15Fixed16(buffer, 16, value.peakLuminance);
  writeU32(buffer, 20, matrixOffset);
  writeU32(buffer, 24, redOffset);
  writeU32(buffer, 28, greenOffset);
  writeU32(buffer, 32, blueOffset);

  if (hasMatrix) {
    for (let index = 0; index < 12; index += 1) {
      writeS15Fixed16(buffer, matrixOffset + index * 4, value.xyzToXyzMatrix[index] ?? 0);
    }
  }

  function writeCurve(offset: number, samples: readonly number[]): void {
    if (samples.length !== value.curveEntries) {
      throw new Error(`MHC2 curve sample count mismatch: expected ${value.curveEntries}, got ${samples.length}`);
    }
    writeSignature(buffer, offset, "sf32");
    writeU32(buffer, offset + 4, 0);
    for (let index = 0; index < value.curveEntries; index += 1) {
      writeS15Fixed16(buffer, offset + 8 + index * 4, samples[index] ?? 0);
    }
  }

  writeCurve(redOffset, value.redCurve);
  writeCurve(greenOffset, value.greenCurve);
  writeCurve(blueOffset, value.blueCurve);

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
    | CmsDictionaryTagValue
    | CmsDescTagValue
    | CmsLut16TagValue
    | CmsLut8TagValue
    | CmsMhc2TagValue
    | CmsMeasurementTagValue
    | CmsMultiProcessElementTagValue
    | CmsMlucTagValue
    | CmsNamedColorTagValue
    | CmsParametricCurveTagValue
    | CmsProfileSequenceDescTagValue
    | CmsProfileSequenceIdTagValue
    | CmsS15Fixed16ArrayTagValue
    | CmsScreeningTagValue
    | CmsSignatureTagValue
    | CmsTextTagValue
    | CmsUInt32ArrayTagValue
    | CmsUInt64ArrayTagValue
    | CmsUInt8ArrayTagValue
    | CmsUcrBgTagValue
    | CmsVcgtTagValue
    | CmsVideoSignalTagValue
    | CmsViewingConditionsTagValue
    | CmsXyzTagValue,
): Uint8Array {
  switch (value.kind) {
    case "cicp":
      return serializeVideoSignalTag(value);
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
    case "dict":
      return serializeDictionaryTag(value);
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
    case "MHC2":
      return serializeMhc2Tag(value);
    case "meas":
      return serializeMeasurementTag(value);
    case "ncl2":
      return serializeNamedColorTag(value);
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
    case "sf32":
      return serializeS15Fixed16ArrayTag(value);
    case "scrn":
      return serializeScreeningTag(value);
    case "sig":
      return serializeSignatureTag(value);
    case "ui08":
      return serializeUInt8ArrayTag(value);
    case "ui32":
      return serializeUInt32ArrayTag(value);
    case "ui64":
      return serializeUInt64ArrayTag(value);
    case "bfd":
      return serializeUcrBgTag(value);
    case "vcgt":
      return serializeVcgtTag(value);
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
