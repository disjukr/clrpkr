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
    const a2b0 = parseIccLutTag(...Object.values(loadLutTag("eci/eciCMYK_v2.icc", "A2B0")) as [Uint8Array, { signature: string; offset: number; size: number }]) as CmsLut16TagValue;
    const b2a2 = parseIccLutTag(...Object.values(loadLutTag("eci/eciCMYK_v2.icc", "B2A2")) as [Uint8Array, { signature: string; offset: number; size: number }]) as CmsLut8TagValue;

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
});
