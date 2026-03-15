import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  cmsBuildTabulatedToneCurve16,
  buildSerializedTagTable,
  parseIccHeader,
  parseIccTagTable,
  parseIccTagValue,
  parseOptionalIccTagValue,
  serializeIccTagRecord,
  serializeIccTagValue,
  type CmsChromaticityTagValue,
  type CmsColorantTableTagValue,
  type CmsCurveTagValue,
  type CmsCrdInfoTagValue,
  type CmsDataTagValue,
  type CmsDateTimeTagValue,
  type CmsMeasurementTagValue,
  type CmsMlucTagValue,
  type CmsParsedTagValue,
  type CmsProfileSequenceDescTagValue,
  type CmsProfileSequenceIdTagValue,
  type CmsScreeningTagValue,
  type CmsSignatureTagValue,
  type CmsTextTagValue,
  type CmsUcrBgTagValue,
  type CmsViewingConditionsTagValue,
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

  it("round-trips cmstypes metadata payloads through serialization", () => {
    const sig: CmsSignatureTagValue = { kind: "sig", signature: "ABCD" };
    const data: CmsDataTagValue = { kind: "data", flag: 1, bytes: new Uint8Array([1, 2, 3, 4]) };
    const dtim: CmsDateTimeTagValue = {
      kind: "dtim",
      value: { year: 2026, month: 3, day: 15, hours: 10, minutes: 20, seconds: 30 },
    };
    const meas: CmsMeasurementTagValue = {
      kind: "meas",
      observer: 1,
      backing: { X: 0.1, Y: 0.2, Z: 0.3 },
      geometry: 2,
      flare: 0.05,
      illuminantType: 1,
    };
    const view: CmsViewingConditionsTagValue = {
      kind: "view",
      illuminant: { X: 0.9642, Y: 1, Z: 0.8249 },
      surround: { X: 0.2, Y: 0.3, Z: 0.4 },
      illuminantType: 2,
    };
    const chrm: CmsChromaticityTagValue = {
      kind: "chrm",
      channels: 3,
      phosphorOrColorantType: 0,
      red: { x: 0.64, y: 0.33, Y: 1 },
      green: { x: 0.3, y: 0.6, Y: 1 },
      blue: { x: 0.15, y: 0.06, Y: 1 },
    };
    const clrt: CmsColorantTableTagValue = {
      kind: "clrt",
      entries: [
        { name: "Cyan", pcs: [100, 200, 300] },
        { name: "Magenta", pcs: [400, 500, 600] },
      ],
    };
    const pseq: CmsProfileSequenceDescTagValue = {
      kind: "pseq",
      entries: [
        {
          deviceMfg: "APPL",
          deviceModel: "RGB ",
          attributes: 1n,
          technology: "CRT ",
          manufacturer: { kind: "mluc", entries: [{ language: "en", country: "US", text: "Apple" }] },
          model: { kind: "desc", text: "Cinema Display" },
        },
      ],
    };
    const psid: CmsProfileSequenceIdTagValue = {
      kind: "psid",
      entries: [
        {
          deviceMfg: "    ",
          deviceModel: "    ",
          attributes: 0n,
          technology: "    ",
          manufacturer: { kind: "text", text: "" },
          model: { kind: "text", text: "" },
          profileId: "00112233445566778899aabbccddeeff",
          description: { kind: "mluc", entries: [{ language: "en", country: "US", text: "Source profile" }] },
        },
      ],
    };
    const bfd: CmsUcrBgTagValue = {
      kind: "bfd",
      ucr: {
        kind: "curv",
        curve: cmsBuildTabulatedToneCurve16(3, [0, 32768, 65535]),
        entryCount: 3,
      },
      bg: {
        kind: "curv",
        curve: cmsBuildTabulatedToneCurve16(3, [65535, 32768, 0]),
        entryCount: 3,
      },
      text: "UCR/BG method",
    };
    const crdi: CmsCrdInfoTagValue = {
      kind: "crdi",
      productName: "PSProduct",
      renderingIntent0: "CRD0",
      renderingIntent1: "CRD1",
      renderingIntent2: "CRD2",
      renderingIntent3: "CRD3",
    };
    const scrn: CmsScreeningTagValue = {
      kind: "scrn",
      flag: 1,
      channels: [
        { frequency: 60, screenAngle: 15, spotShape: 2 },
        { frequency: 75, screenAngle: 45, spotShape: 3 },
      ],
    };

    expect(reparseSerialized("tech", sig)).toEqual(sig);
    expect(reparseSerialized("clro", data)).toEqual(data);
    expect(reparseSerialized("targ", dtim)).toEqual(dtim);

    const reparsedMeas = reparseSerialized("meas", meas) as CmsMeasurementTagValue;
    expect(reparsedMeas.kind).toBe("meas");
    expect(reparsedMeas.observer).toBe(meas.observer);
    expect(reparsedMeas.geometry).toBe(meas.geometry);
    expect(reparsedMeas.illuminantType).toBe(meas.illuminantType);
    expect(reparsedMeas.backing.X).toBeCloseTo(meas.backing.X, 4);
    expect(reparsedMeas.backing.Y).toBeCloseTo(meas.backing.Y, 4);
    expect(reparsedMeas.backing.Z).toBeCloseTo(meas.backing.Z, 4);
    expect(reparsedMeas.flare).toBeCloseTo(meas.flare, 4);

    const reparsedView = reparseSerialized("view", view) as CmsViewingConditionsTagValue;
    expect(reparsedView.kind).toBe("view");
    expect(reparsedView.illuminant.X).toBeCloseTo(view.illuminant.X, 4);
    expect(reparsedView.illuminant.Y).toBeCloseTo(view.illuminant.Y, 4);
    expect(reparsedView.illuminant.Z).toBeCloseTo(view.illuminant.Z, 4);
    expect(reparsedView.surround.X).toBeCloseTo(view.surround.X, 4);
    expect(reparsedView.surround.Y).toBeCloseTo(view.surround.Y, 4);
    expect(reparsedView.surround.Z).toBeCloseTo(view.surround.Z, 4);
    expect(reparsedView.illuminantType).toBe(view.illuminantType);

    const reparsedChrm = reparseSerialized("chrm", chrm) as CmsChromaticityTagValue;
    expect(reparsedChrm.kind).toBe("chrm");
    expect(reparsedChrm.channels).toBe(chrm.channels);
    expect(reparsedChrm.phosphorOrColorantType).toBe(chrm.phosphorOrColorantType);
    expect(reparsedChrm.red.x).toBeCloseTo(chrm.red.x, 4);
    expect(reparsedChrm.red.y).toBeCloseTo(chrm.red.y, 4);
    expect(reparsedChrm.green.x).toBeCloseTo(chrm.green.x, 4);
    expect(reparsedChrm.green.y).toBeCloseTo(chrm.green.y, 4);
    expect(reparsedChrm.blue.x).toBeCloseTo(chrm.blue.x, 4);
    expect(reparsedChrm.blue.y).toBeCloseTo(chrm.blue.y, 4);

    expect(reparseSerialized("clrt", clrt)).toEqual(clrt);
    expect(reparseSerialized("pseq", pseq)).toEqual(pseq);

    const reparsedPsid = reparseSerialized("psid", psid) as CmsProfileSequenceIdTagValue;
    expect(reparsedPsid.kind).toBe("psid");
    expect(reparsedPsid.entries[0]?.profileId).toBe(psid.entries[0]?.profileId);
    expect(reparsedPsid.entries[0]?.description).toEqual(psid.entries[0]?.description);

    const reparsedBfd = reparseSerialized("bfd ", bfd) as CmsUcrBgTagValue;
    expect(reparsedBfd.kind).toBe("bfd");
    expect(reparsedBfd.ucr.entryCount).toBe(3);
    expect(reparsedBfd.bg.entryCount).toBe(3);
    expect(reparsedBfd.text).toBe(bfd.text);

    expect(reparseSerialized("crdi", crdi)).toEqual(crdi);

    const reparsedScrn = reparseSerialized("scrn", scrn) as CmsScreeningTagValue;
    expect(reparsedScrn.kind).toBe("scrn");
    expect(reparsedScrn.flag).toBe(scrn.flag);
    expect(reparsedScrn.channels[0]?.frequency).toBeCloseTo(scrn.channels[0]!.frequency, 4);
    expect(reparsedScrn.channels[0]?.screenAngle).toBeCloseTo(scrn.channels[0]!.screenAngle, 4);
    expect(reparsedScrn.channels[0]?.spotShape).toBe(scrn.channels[0]!.spotShape);
  });
});
