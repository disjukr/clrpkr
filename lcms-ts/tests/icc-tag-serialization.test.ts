import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildSerializedTagTable,
  parseIccHeader,
  parseIccTagTable,
  parseIccTagValue,
  parseOptionalIccTagValue,
  serializeIccTagRecord,
  serializeIccTagValue,
  type CmsCurveTagValue,
  type CmsMlucTagValue,
  type CmsParsedTagValue,
  type CmsTextTagValue,
  type CmsXyzTagValue,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function readProfile(relativePath: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  return { data, tags };
}

function reparseSerialized(signature: string, value: Exclude<CmsParsedTagValue, { kind: "mft1" | "mft2" | "mAB" | "mBA" }>) {
  const payload = serializeIccTagValue(value);
  return parseIccTagValue(payload, { signature, offset: 0, size: payload.byteLength });
}

describe("ICC tag serialization", () => {
  it("round-trips mluc and XYZ tags through serialization", () => {
    const { data, tags } = readProfile("color/sRGB_v4_ICC_preference.icc");
    const desc = parseOptionalIccTagValue(data, tags, "desc") as CmsMlucTagValue;
    const wtpt = parseOptionalIccTagValue(data, tags, "wtpt") as CmsXyzTagValue;

    expect(reparseSerialized("desc", desc)).toEqual(desc);
    expect(reparseSerialized("wtpt", wtpt)).toEqual(wtpt);
  });

  it("round-trips text, desc, and curve tags through serialization", () => {
    const { data, tags } = readProfile("eci/eciCMYK_v2.icc");
    const cprt = parseOptionalIccTagValue(data, tags, "cprt") as CmsTextTagValue;
    const desc = parseOptionalIccTagValue(data, tags, "desc");
    const kTrc = parseOptionalIccTagValue(data, tags, "kTRC") as CmsCurveTagValue;

    expect(reparseSerialized("cprt", cprt)).toEqual(cprt);
    expect(desc && reparseSerialized("desc", desc)).toEqual(desc);
    expect(reparseSerialized("kTRC", kTrc)).toEqual(kTrc);
  });

  it("builds a writable tag table and reparses serialized payloads", () => {
    const { data, tags } = readProfile("eci/eciRGB_v2_ICCv4.icc");
    const desc = parseOptionalIccTagValue(data, tags, "desc");
    const wtpt = parseOptionalIccTagValue(data, tags, "wtpt");
    const rTrc = parseOptionalIccTagValue(data, tags, "rTRC");

    if (!desc || !wtpt || !rTrc || desc.kind === "mft1" || desc.kind === "mft2" || desc.kind === "mAB" || desc.kind === "mBA") {
      throw new Error("Expected serializable tag values");
    }
    if (wtpt.kind === "mft1" || wtpt.kind === "mft2" || wtpt.kind === "mAB" || wtpt.kind === "mBA") {
      throw new Error("Expected serializable tag values");
    }
    if (rTrc.kind === "mft1" || rTrc.kind === "mft2" || rTrc.kind === "mAB" || rTrc.kind === "mBA") {
      throw new Error("Expected serializable tag values");
    }

    const built = buildSerializedTagTable([
      serializeIccTagRecord("desc", desc),
      serializeIccTagRecord("wtpt", wtpt),
      serializeIccTagRecord("rTRC", rTrc),
    ]);
    const profileBytes = new Uint8Array(132 + built.tagTable.byteLength + built.payloadBytes.byteLength);
    profileBytes.set(built.tagTable, 132);
    profileBytes.set(built.payloadBytes, 132 + built.tagTable.byteLength);

    const reparsedTags = parseIccTagTable(profileBytes, { tagCount: built.entries.length } as never);
    expect(reparsedTags).toEqual(built.entries);
    expect(parseIccTagValue(profileBytes, reparsedTags[0]!)).toEqual(desc);
    expect(parseIccTagValue(profileBytes, reparsedTags[1]!)).toEqual(wtpt);
    expect(parseIccTagValue(profileBytes, reparsedTags[2]!)).toEqual(rTrc);
  });
});
