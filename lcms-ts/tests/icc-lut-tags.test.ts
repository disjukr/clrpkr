import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseIccHeader,
  parseIccLutTag,
  parseIccTagTable,
  serializeIccLutTag,
  type CmsGenericMultiProcessTagValue,
  type CmsLut16TagValue,
  type CmsLut8TagValue,
  type CmsMultiProcessElementTagValue,
  validateLutTagStructure,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function loadProfile(relativePath: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  return { data, tags };
}

describe("ICC LUT tag parsing", () => {
  function writeSignature(buffer: Uint8Array, offset: number, signature: string) {
    for (let index = 0; index < 4; index += 1) {
      buffer[offset + index] = signature.charCodeAt(index) ?? 0x20;
    }
  }

  function writeU32(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = (value >>> 24) & 0xff;
    buffer[offset + 1] = (value >>> 16) & 0xff;
    buffer[offset + 2] = (value >>> 8) & 0xff;
    buffer[offset + 3] = value & 0xff;
  }

  function writeU16(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = (value >>> 8) & 0xff;
    buffer[offset + 1] = value & 0xff;
  }

  function createAlignedCurvePayload(gamma: number): Uint8Array {
    const payload = new Uint8Array(16);
    writeSignature(payload, 0, "curv");
    writeU32(payload, 8, 1);
    writeU16(payload, 12, Math.round(gamma * 256));
    return payload;
  }

  it("parses mAB and mBA tags from v4 profiles", () => {
    const { data, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const a2b0 = tags.find((tag) => tag.signature === "A2B0");
    const b2a0 = tags.find((tag) => tag.signature === "B2A0");

    expect(a2b0).toBeDefined();
    expect(b2a0).toBeDefined();

    const parsedA2b0 = parseIccLutTag(data, a2b0!) as CmsMultiProcessElementTagValue;
    const parsedB2a0 = parseIccLutTag(data, b2a0!) as CmsMultiProcessElementTagValue;

    expect(parsedA2b0.kind).toBe("mAB");
    expect(parsedA2b0.inputChannels).toBe(3);
    expect(parsedA2b0.outputChannels).toBe(3);
    expect(parsedA2b0.hasBcurves).toBe(true);
    expect(parsedA2b0.hasClut).toBe(true);
    expect(parsedA2b0.clutGridPoints?.length).toBe(3);
    expect(parsedA2b0.matrixValues).toHaveLength(9);
    expect(parsedA2b0.matrixOffsetValues).toHaveLength(3);
    expect(parsedA2b0.clutValuesParsed).toBeInstanceOf(Uint16Array);
    expect(validateLutTagStructure(parsedA2b0, a2b0!.size)).toEqual([]);

    expect(parsedB2a0.kind).toBe("mBA");
    expect(parsedB2a0.inputChannels).toBe(3);
    expect(parsedB2a0.outputChannels).toBe(3);
    expect(parsedB2a0.bCurves?.length).toBe(3);
    expect(parsedB2a0.aCurves?.length).toBe(3);
    expect(validateLutTagStructure(parsedB2a0, b2a0!.size)).toEqual([]);
  });

  it("parses mft2 tags from CMYK profiles", () => {
    const { data, tags } = loadProfile("eci/eciCMYK_v2.icc");
    const a2b0 = tags.find((tag) => tag.signature === "A2B0");

    expect(a2b0).toBeDefined();

    const parsed = parseIccLutTag(data, a2b0!) as CmsLut16TagValue;
    expect(parsed.kind).toBe("mft2");
    expect(parsed.inputChannels).toBe(4);
    expect(parsed.outputChannels).toBe(3);
    expect(parsed.gridPoints).toBe(16);
    expect(parsed.inputTableEntries).toBe(256);
    expect(parsed.outputTableEntries).toBe(256);
    expect(parsed.inputTables.length).toBe(1024);
    expect(parsed.outputTables.length).toBe(768);
    expect(parsed.clutValues.length).toBe(16 ** 4 * 3);
    expect(validateLutTagStructure(parsed, a2b0!.size)).toEqual([]);
  });

  it("parses mft1 tags from CMYK profiles", () => {
    const { data, tags } = loadProfile("eci/eciCMYK_v2.icc");
    const b2a2 = tags.find((tag) => tag.signature === "B2A2");

    expect(b2a2).toBeDefined();

    const parsed = parseIccLutTag(data, b2a2!) as CmsLut8TagValue;
    expect(parsed.kind).toBe("mft1");
    expect(parsed.inputChannels).toBe(3);
    expect(parsed.outputChannels).toBe(4);
    expect(parsed.gridPoints).toBe(33);
    expect(parsed.inputTables.length).toBe(768);
    expect(parsed.outputTables.length).toBe(1024);
    expect(parsed.clutValues.length).toBe(33 ** 3 * 4);
    expect(validateLutTagStructure(parsed, b2a2!.size)).toEqual([]);
  });

  it("round-trips structured generic mpet elements", () => {
    const tag: CmsGenericMultiProcessTagValue = {
      kind: "mpet",
      inputChannels: 3,
      outputChannels: 3,
      rawPayload: new Uint8Array(),
      elements: [
        { kind: "bACS" },
        {
          kind: "matf",
          inputChannels: 3,
          outputChannels: 3,
          matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          offset: [0, 0.1, 0.2],
        },
        {
          kind: "clut",
          inputChannels: 3,
          outputChannels: 3,
          gridPoints: [2, 2, 2],
          values: new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,
            1, 1, 0,
            0, 0, 1,
            1, 0, 1,
            0, 1, 1,
            1, 1, 1,
          ]),
        },
        { kind: "eACS" },
      ],
    };

    const payload = serializeIccLutTag(tag);
    const reparsed = parseIccLutTag(payload, { signature: "D2B0", offset: 0, size: payload.byteLength }) as CmsGenericMultiProcessTagValue;

    expect(reparsed.kind).toBe("mpet");
    expect(reparsed.inputChannels).toBe(3);
    expect(reparsed.outputChannels).toBe(3);
    expect(reparsed.elements).toHaveLength(4);
    expect(reparsed.elements[0]).toEqual({ kind: "bACS" });
    expect(reparsed.elements[1]?.kind).toBe("matf");
    expect(reparsed.elements[2]?.kind).toBe("clut");
    expect(reparsed.elements[3]).toEqual({ kind: "eACS" });
  });

  it("preserves unknown generic mpet elements as raw", () => {
    const rawElement = new Uint8Array(12);
    rawElement[0] = "f".charCodeAt(0);
    rawElement[1] = "o".charCodeAt(0);
    rawElement[2] = "o".charCodeAt(0);
    rawElement[3] = " ".charCodeAt(0);
    rawElement[8] = 0xaa;
    rawElement[9] = 0xbb;
    rawElement[10] = 0xcc;
    rawElement[11] = 0xdd;

    const payload = new Uint8Array(16 + 8 + rawElement.byteLength);
    payload[0] = "m".charCodeAt(0);
    payload[1] = "p".charCodeAt(0);
    payload[2] = "e".charCodeAt(0);
    payload[3] = "t".charCodeAt(0);
    payload[9] = 3;
    payload[11] = 3;
    payload[15] = 1;
    payload[23] = rawElement.byteLength;
    payload[19] = 24;
    payload.set(rawElement, 24);

    const parsed = parseIccLutTag(payload, { signature: "D2B0", offset: 0, size: payload.byteLength }) as CmsGenericMultiProcessTagValue;
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0]?.kind).toBe("raw");
    if (parsed.elements[0]?.kind !== "raw") {
      throw new Error("Expected raw element");
    }
    expect(parsed.elements[0].signature).toBe("foo ");
    expect(parsed.elements[0].rawElement).toEqual(rawElement);
    expect(serializeIccLutTag(parsed)).toEqual(payload);
  });

  it("falls back to raw for generic mpet curve-set extensions it cannot decode", () => {
    const curveData = new Uint8Array(36);
    curveData[0] = "c".charCodeAt(0);
    curveData[1] = "u".charCodeAt(0);
    curveData[2] = "r".charCodeAt(0);
    curveData[3] = "f".charCodeAt(0);
    curveData[11] = 1;
    curveData[12] = "p".charCodeAt(0);
    curveData[13] = "a".charCodeAt(0);
    curveData[14] = "r".charCodeAt(0);
    curveData[15] = "f".charCodeAt(0);

    const element = new Uint8Array(20 + curveData.byteLength);
    element[0] = "c".charCodeAt(0);
    element[1] = "v".charCodeAt(0);
    element[2] = "s".charCodeAt(0);
    element[3] = "t".charCodeAt(0);
    element[9] = 1;
    element[11] = 1;
    element[15] = 20;
    element[19] = curveData.byteLength;
    element.set(curveData, 20);

    const payload = new Uint8Array(16 + 8 + element.byteLength);
    payload[0] = "m".charCodeAt(0);
    payload[1] = "p".charCodeAt(0);
    payload[2] = "e".charCodeAt(0);
    payload[3] = "t".charCodeAt(0);
    payload[9] = 1;
    payload[11] = 1;
    payload[15] = 1;
    payload[19] = 24;
    payload[23] = element.byteLength;
    payload.set(element, 24);

    const parsed = parseIccLutTag(payload, { signature: "D2B0", offset: 0, size: payload.byteLength }) as CmsGenericMultiProcessTagValue;
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0]?.kind).toBe("raw");
    if (parsed.elements[0]?.kind !== "raw") {
      throw new Error("Expected raw element");
    }
    expect(parsed.elements[0].signature).toBe("cvst");
    expect(parsed.elements[0].rawElement).toEqual(element);
    expect(serializeIccLutTag(parsed)).toEqual(payload);
  });

  it("parses asymmetric mBA curve sets with the correct channel arity", () => {
    const bCurvePayload = createAlignedCurvePayload(1);
    const mCurvePayload = createAlignedCurvePayload(1);
    const aCurvePayload = createAlignedCurvePayload(1);
    const bCurvesOffset = 32;
    const mCurvesOffset = bCurvesOffset + bCurvePayload.byteLength * 3;
    const aCurvesOffset = mCurvesOffset + mCurvePayload.byteLength * 3;
    const payload = new Uint8Array(aCurvesOffset + aCurvePayload.byteLength * 4);

    writeSignature(payload, 0, "mBA ");
    payload[8] = 3;
    payload[9] = 4;
    writeU32(payload, 12, bCurvesOffset);
    writeU32(payload, 20, mCurvesOffset);
    writeU32(payload, 28, aCurvesOffset);

    for (let index = 0; index < 3; index += 1) {
      payload.set(bCurvePayload, bCurvesOffset + index * bCurvePayload.byteLength);
      payload.set(mCurvePayload, mCurvesOffset + index * mCurvePayload.byteLength);
    }
    for (let index = 0; index < 4; index += 1) {
      payload.set(aCurvePayload, aCurvesOffset + index * aCurvePayload.byteLength);
    }

    const parsed = parseIccLutTag(payload, { signature: "B2A0", offset: 0, size: payload.byteLength }) as CmsMultiProcessElementTagValue;

    expect(parsed.kind).toBe("mBA");
    expect(parsed.inputChannels).toBe(3);
    expect(parsed.outputChannels).toBe(4);
    expect(parsed.bCurves).toHaveLength(3);
    expect(parsed.mCurves).toHaveLength(3);
    expect(parsed.aCurves).toHaveLength(4);
    expect(validateLutTagStructure(parsed, payload.byteLength)).toEqual([]);
  });
});
