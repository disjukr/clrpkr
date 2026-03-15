import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  cmsGetTagOffsetAndSize,
  cmsGetTagCount,
  cmsIsTag,
  cmsLinkTag,
  md5Hex,
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
    const digestInput = new Uint8Array(serialized.bytes);
    digestInput.fill(0, 44, 48);
    digestInput.fill(0, 64, 68);
    digestInput.fill(0, 84, 100);
    expect(serialized.header.profileId).toBe(md5Hex(digestInput));
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
    expect(
      reparsed.records.map((record) => ({
        signature: record.signature,
        value: record.value,
      })),
    ).toEqual(sourceRecords);
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

  it("does not expose raw-written tags as cooked until reopen", () => {
    const { data, header, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const wtpt = tags.find((entry) => entry.signature === "wtpt");
    if (!wtpt) {
      throw new Error("Missing wtpt");
    }

    const profile = cmsOpenProfileFromMem(
      serializeIccProfile(
        { ...header },
        [serializeIccTagRecord("wtpt", parseIccTagValue(data, wtpt))],
      ).bytes,
    );
    const rawWtpt = cmsReadRawTag(profile, "wtpt");
    if (!rawWtpt) {
      throw new Error("Missing raw wtpt");
    }

    const rawOnly = cmsWriteRawTag(profile, "wtpt", rawWtpt);

    expect(cmsReadRawTag(rawOnly, "wtpt")).toEqual(rawWtpt);
    expect(cmsReadTag(rawOnly, "wtpt")).toBeUndefined();
    expect(cmsReadTag(cmsOpenProfileFromMem(cmsSaveProfileToMem(rawOnly)), "wtpt")).toEqual(cmsReadTag(profile, "wtpt"));
  });

  it("keeps linked tags following the target after a raw overwrite", () => {
    const { data, header, tags } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const selected = ["A2B0", "wtpt"] as const;
    const profile = cmsOpenProfileFromMem(
      serializeIccProfile(
        { ...header },
        selected.map((signature) => {
          const tag = tags.find((entry) => entry.signature === signature);
          if (!tag) {
            throw new Error(`Missing tag ${signature}`);
          }
          return serializeIccTagRecord(signature, parseIccTagValue(data, tag));
        }),
      ).bytes,
    );

    const linked = cmsLinkTag(profile, "B2A0", "A2B0");
    const a2b0Raw = cmsReadRawTag(linked, "A2B0");
    if (!a2b0Raw) {
      throw new Error("Missing raw A2B0");
    }

    const overwritten = cmsWriteRawTag(linked, "A2B0", a2b0Raw);

    expect(cmsTagLinkedTo(overwritten, "B2A0")).toBe("A2B0");
    expect(cmsReadRawTag(overwritten, "B2A0")).toEqual(a2b0Raw);
    expect(cmsReadTag(overwritten, "B2A0")).toBeUndefined();
  });

  it("preserves unsupported raw tags across save and reopen", () => {
    const { header } = loadProfile("color/sRGB_v4_ICC_preference.icc");
    const unsupportedRaw = new Uint8Array([
      0x75, 0x6e, 0x6b, 0x6e,
      0x00, 0x00, 0x00, 0x00,
      0x12, 0x34, 0x56, 0x78,
    ]);

    const profile = cmsWriteRawTag(cmsOpenProfileFromMem(serializeIccProfile({ ...header }, []).bytes), "meta", unsupportedRaw);
    const reopened = cmsOpenProfileFromMem(cmsSaveProfileToMem(profile));

    expect(cmsIsTag(reopened, "meta")).toBe(true);
    expect(cmsReadRawTag(reopened, "meta")).toEqual(unsupportedRaw);
    expect(cmsReadTag(reopened, "meta")).toBeUndefined();
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
