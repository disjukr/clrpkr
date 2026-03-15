import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  cmsGetTagOffsetAndSize,
  cmsGetTagCount,
  cmsIsTag,
  cmsLinkTag,
  cmsOpenProfileFromMem,
  cmsReadRawTag,
  cmsReadTag,
  cmsSaveProfileToMem,
  cmsSaveProfileToStream,
  cmsTagLinkedTo,
  cmsWriteRawTag,
  cmsWriteTag,
  parseIccHeader,
  parseIccProfile,
  parseIccTagTable,
  parseIccTagValue,
  serializeIccProfile,
  serializeIccTagRecord,
  validateIccHeader,
  validateIccTagTable,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function loadProfile(relativePath: string) {
  const fullPath = path.join(repoRoot, "icc-profiles", relativePath);
  const data = readFileSync(fullPath);
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  return { data, header, tags };
}

describe("ICC profile serialization", () => {
  it("assembles a minimal v4 RGB profile subset into valid ICC bytes", () => {
    const { data, header, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const selected = ["desc", "cprt", "wtpt", "A2B0", "B2A0"] as const;
    const records = selected.map((signature) => {
      const tag = tags.find((entry) => entry.signature === signature);
      if (!tag) {
        throw new Error(`Missing tag ${signature}`);
      }
      return serializeIccTagRecord(signature, parseIccTagValue(data, tag));
    });

    const serialized = serializeIccProfile(
      {
        ...header,
      },
      records,
    );

    expect(validateIccHeader(serialized.header, serialized.bytes.byteLength)).toEqual([]);
    expect(validateIccTagTable(serialized.header, serialized.tags, serialized.bytes.byteLength)).toEqual([]);
    expect(serialized.header.profileSize).toBe(serialized.bytes.byteLength);
    expect(serialized.header.tagCount).toBe(records.length);
  });

  it("parses back records from a serialized minimal profile", () => {
    const { data, header, tags } = loadProfile("eci/eciCMYK_v2.icc");
    const selected = ["desc", "cprt", "wtpt", "A2B0", "B2A0"] as const;
    const sourceRecords = selected.map((signature) => {
      const tag = tags.find((entry) => entry.signature === signature);
      if (!tag) {
        throw new Error(`Missing tag ${signature}`);
      }
      return {
        signature,
        value: parseIccTagValue(data, tag),
      };
    });

    const serialized = serializeIccProfile(
      {
        ...header,
      },
      sourceRecords.map((record) => serializeIccTagRecord(record.signature, record.value)),
    );
    const reparsed = parseIccProfile(serialized.bytes);

    expect(reparsed.header.tagCount).toBe(sourceRecords.length);
    expect(reparsed.records).toEqual(sourceRecords);
  });

  it("supports memory-backed profile tag read/write operations", () => {
    const { data, header, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const selected = ["desc", "cprt", "wtpt", "A2B0", "B2A0"] as const;
    const serialized = serializeIccProfile(
      {
        ...header,
      },
      selected.map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Missing tag ${signature}`);
        }
        return serializeIccTagRecord(signature, parseIccTagValue(data, tag));
      }),
    );
    const profile = cmsOpenProfileFromMem(serialized.bytes);
    const originalDesc = cmsReadTag(profile, "desc");
    const rawWtpt = cmsReadRawTag(profile, "wtpt");

    expect(cmsGetTagCount(profile)).toBeGreaterThan(0);
    expect(cmsIsTag(profile, "desc")).toBe(true);
    expect(originalDesc).toBeDefined();
    expect(rawWtpt).toBeDefined();

    const updated = cmsWriteTag(profile, "desc", {
      kind: "mluc",
      entries: [{ language: "en", country: "US", text: "patched profile" }],
    });
    const reloaded = cmsWriteRawTag(updated, "wtpt", rawWtpt!);
    const bytes = cmsSaveProfileToMem(reloaded);
    const reparsed = cmsOpenProfileFromMem(bytes);

    expect(cmsReadTag(reparsed, "desc")).toEqual({
      kind: "mluc",
      entries: [{ language: "en", country: "US", text: "patched profile" }],
    });
    expect(cmsReadRawTag(reparsed, "wtpt")).toEqual(rawWtpt);
  });

  it("supports linked tags sharing the same payload range", () => {
    const { data, header, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const selected = ["desc", "cprt", "wtpt", "A2B0"] as const;
    const serialized = serializeIccProfile(
      { ...header },
      selected.map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Missing tag ${signature}`);
        }
        return serializeIccTagRecord(signature, parseIccTagValue(data, tag));
      }),
    );

    const linked = cmsLinkTag(cmsOpenProfileFromMem(serialized.bytes), "B2A0", "A2B0");
    const saved = cmsSaveProfileToMem(linked);
    const reopened = cmsOpenProfileFromMem(saved);
    const a2b0Range = cmsGetTagOffsetAndSize(reopened, "A2B0");
    const b2a0Range = cmsGetTagOffsetAndSize(reopened, "B2A0");

    expect(cmsTagLinkedTo(reopened, "B2A0")).toBe("A2B0");
    expect(cmsReadTag(reopened, "B2A0")).toEqual(cmsReadTag(reopened, "A2B0"));
    expect(b2a0Range).toEqual(a2b0Range);
  });

  it("writes serialized profile bytes to a generic stream", () => {
    const { data, header, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const selected = ["desc", "cprt", "wtpt", "A2B0", "B2A0"] as const;
    const serialized = serializeIccProfile(
      { ...header },
      selected.map((signature) => {
        const tag = tags.find((entry) => entry.signature === signature);
        if (!tag) {
          throw new Error(`Missing tag ${signature}`);
        }
        return serializeIccTagRecord(signature, parseIccTagValue(data, tag));
      }),
    );
    const profile = cmsOpenProfileFromMem(serialized.bytes);
    const chunks: Uint8Array[] = [];

    cmsSaveProfileToStream(profile, {
      write(chunk) {
        chunks.push(new Uint8Array(chunk));
      },
    });

    expect(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))).toEqual(Buffer.from(serialized.bytes));
  });
});
