import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildSerializedTagTable,
  parseIccHeader,
  parseIccLutTag,
  parseIccTagTable,
  serializeIccLutTag,
  serializeIccTagRecord,
  type CmsLut16TagValue,
  type CmsLut8TagValue,
  type CmsMultiProcessElementTagValue,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function loadLutTag(relativePath: string, signature: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  const tag = tags.find((entry) => entry.signature === signature);

  if (!tag) {
    throw new Error(`Tag ${signature} not found in ${relativePath}`);
  }

  return { data, tag };
}

describe("ICC LUT serialization", () => {
  it("round-trips mft2 tags through serialization", () => {
    const { data, tag } = loadLutTag("eci/eciCMYK_v2.icc", "A2B0");
    const parsed = parseIccLutTag(data, tag) as CmsLut16TagValue;
    const payload = serializeIccLutTag(parsed);
    const reparsed = parseIccLutTag(payload, { signature: tag.signature, offset: 0, size: payload.byteLength });

    expect(reparsed).toEqual(parsed);
  });

  it("round-trips mft1 tags through serialization", () => {
    const { data, tag } = loadLutTag("eci/eciCMYK_v2.icc", "B2A2");
    const parsed = parseIccLutTag(data, tag) as CmsLut8TagValue;
    const payload = serializeIccLutTag(parsed);
    const reparsed = parseIccLutTag(payload, { signature: tag.signature, offset: 0, size: payload.byteLength });

    expect(reparsed).toEqual(parsed);
  });

  it("builds a tag table containing serialized LUT payloads", () => {
    const { data: a2b0Data, tag: a2b0Tag } = loadLutTag("eci/eciCMYK_v2.icc", "A2B0");
    const { data: b2a2Data, tag: b2a2Tag } = loadLutTag("eci/eciCMYK_v2.icc", "B2A2");
    const a2b0 = parseIccLutTag(a2b0Data, a2b0Tag) as CmsLut16TagValue;
    const b2a2 = parseIccLutTag(b2a2Data, b2a2Tag) as CmsLut8TagValue;

    const built = buildSerializedTagTable([
      serializeIccTagRecord("A2B0", a2b0),
      serializeIccTagRecord("B2A2", b2a2),
    ]);
    const profileBytes = new Uint8Array(132 + built.tagTable.byteLength + built.payloadBytes.byteLength);
    profileBytes.set(built.tagTable, 132);
    profileBytes.set(built.payloadBytes, 132 + built.tagTable.byteLength);

    const reparsedTags = parseIccTagTable(profileBytes, { tagCount: built.entries.length } as never);
    expect(parseIccLutTag(profileBytes, reparsedTags[0]!)).toEqual(a2b0);
    expect(parseIccLutTag(profileBytes, reparsedTags[1]!)).toEqual(b2a2);
  });

  it("round-trips mAB and mBA tags through raw payload serialization", () => {
    const { data: a2b0Data, tag: a2b0Tag } = loadLutTag("color/sRGB_v4_ICC_preference.icc", "A2B0");
    const { data: b2a0Data, tag: b2a0Tag } = loadLutTag("color/sRGB_v4_ICC_preference.icc", "B2A0");
    const a2b0 = parseIccLutTag(a2b0Data, a2b0Tag) as CmsMultiProcessElementTagValue;
    const b2a0 = parseIccLutTag(b2a0Data, b2a0Tag) as CmsMultiProcessElementTagValue;

    const serializedA2b0 = serializeIccLutTag(a2b0);
    const serializedB2a0 = serializeIccLutTag(b2a0);

    expect(parseIccLutTag(serializedA2b0, { signature: "A2B0", offset: 0, size: serializedA2b0.byteLength })).toEqual(a2b0);
    expect(parseIccLutTag(serializedB2a0, { signature: "B2A0", offset: 0, size: serializedB2a0.byteLength })).toEqual(b2a0);
  });
});
