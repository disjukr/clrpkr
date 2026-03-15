import { describe, expect, it } from "vitest";

import {
  createIccWriter,
  parseIccHeader,
  parseIccTagTable,
  readDateTime,
  readProfileId,
  readS15Fixed16,
  readSignature,
  readU16,
  readU32,
  readU64,
  serializeIccHeader,
  serializeIccTagTable,
  writeProfileId,
} from "../src/index.js";

describe("ICC low-level IO", () => {
  it("reads and writes big-endian scalar values", () => {
    const writer = createIccWriter(34);
    writer.writeSignature(0, "acsp");
    writer.writeU16(4, 0x1234);
    writer.writeU32(6, 0x12345678);
    writer.writeU64(10, 0x0123456789abcdefn);
    writer.writeS15Fixed16(18, 1.5);
    writer.writeDateTime(22, {
      year: 2026,
      month: 3,
      day: 15,
      hours: 12,
      minutes: 34,
      seconds: 56,
    });

    expect(readSignature(writer.buffer, 0)).toBe("acsp");
    expect(readU16(writer.buffer, 4)).toBe(0x1234);
    expect(readU32(writer.buffer, 6)).toBe(0x12345678);
    expect(readU64(writer.buffer, 10)).toBe(0x0123456789abcdefn);
    expect(readS15Fixed16(writer.buffer, 18)).toBeCloseTo(1.5, 5);
    expect(readDateTime(writer.buffer, 22)).toEqual({
      year: 2026,
      month: 3,
      day: 15,
      hours: 12,
      minutes: 34,
      seconds: 56,
    });
  });

  it("round-trips profile IDs and ICC header bytes", () => {
    const header = {
      profileSize: 160,
      preferredCmmType: "Lino",
      versionMajor: 4,
      versionMinor: 3,
      versionBugfix: 0,
      deviceClass: "mntr",
      colorSpace: "RGB ",
      pcs: "XYZ ",
      createdAt: {
        year: 2026,
        month: 3,
        day: 15,
        hours: 9,
        minutes: 8,
        seconds: 7,
      },
      magic: "acsp",
      platform: "APPL",
      flags: 0,
      manufacturer: "test",
      model: "demo",
      attributes: 0n,
      renderingIntent: 1,
      illuminant: {
        X: 0.9642,
        Y: 1,
        Z: 0.8249,
      },
      creator: "node",
      profileId: "00112233445566778899aabbccddeeff",
      tagCount: 2,
    } as const;

    const bytes = serializeIccHeader(header);
    const parsed = parseIccHeader(bytes);
    const { illuminant, ...parsedWithoutIlluminant } = parsed;
    const { illuminant: _expectedIlluminant, ...headerWithoutIlluminant } = header;
    expect(parsedWithoutIlluminant).toEqual(headerWithoutIlluminant);
    expect(illuminant.X).toBeCloseTo(header.illuminant.X, 4);
    expect(illuminant.Y).toBeCloseTo(header.illuminant.Y, 4);
    expect(illuminant.Z).toBeCloseTo(header.illuminant.Z, 4);
    expect(readProfileId(bytes.slice(84, 100))).toBe(header.profileId);

    writeProfileId(bytes, 84, "ffeeddccbbaa99887766554433221100");
    expect(readProfileId(bytes.slice(84, 100))).toBe("ffeeddccbbaa99887766554433221100");
  });

  it("serializes tag table entries in ICC layout", () => {
    const bytes = new Uint8Array(132 + 24);
    const table = serializeIccTagTable([
      { signature: "desc", offset: 256, size: 64 },
      { signature: "wtpt", offset: 320, size: 20 },
    ]);
    bytes.set(table, 132);

    expect(parseIccTagTable(bytes, { tagCount: 2 } as never)).toEqual([
      { signature: "desc", offset: 256, size: 64 },
      { signature: "wtpt", offset: 320, size: 20 },
    ]);
  });
});
