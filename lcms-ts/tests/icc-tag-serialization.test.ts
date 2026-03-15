import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  cmsBuildParametricToneCurve,
  cmsBuildTabulatedToneCurve16,
  buildSerializedTagTable,
  parseIccHeader,
  parseIccTagTable,
  parseIccTagValue,
  parseOptionalIccTagValue,
  serializeIccTagRecord,
  serializeIccTagValue,
  type CmsChromaticityTagValue,
  type CmsColorantOrderTagValue,
  type CmsColorantTableTagValue,
  type CmsCurveTagValue,
  type CmsCrdInfoTagValue,
  type CmsDataTagValue,
  type CmsDateTimeTagValue,
  type CmsDictionaryTagValue,
  type CmsMeasurementTagValue,
  type CmsMhc2TagValue,
  type CmsMlucTagValue,
  type CmsNamedColorTagValue,
  type CmsParsedTagValue,
  type CmsProfileSequenceDescTagValue,
  type CmsProfileSequenceIdTagValue,
  type CmsS15Fixed16ArrayTagValue,
  type CmsScreeningTagValue,
  type CmsSignatureTagValue,
  type CmsTextTagValue,
  type CmsU16Fixed16ArrayTagValue,
  type CmsUInt32ArrayTagValue,
  type CmsUInt64ArrayTagValue,
  type CmsUInt8ArrayTagValue,
  type CmsUcrBgTagValue,
  type CmsVcgtTagValue,
  type CmsVideoSignalTagValue,
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
    const ncl2: CmsNamedColorTagValue = {
      kind: "ncl2",
      vendorFlag: 7,
      prefix: "PFX-",
      suffix: "-SFX",
      entries: [
        { name: "Red", pcs: [100, 200, 300], deviceCoords: [10, 20, 30, 40] },
        { name: "Green", pcs: [400, 500, 600], deviceCoords: [50, 60, 70, 80] },
      ],
    };
    const dict: CmsDictionaryTagValue = {
      kind: "dict",
      entries: [
        { name: "author", value: "lcms-ts" },
        {
          name: "status",
          value: "ok",
          displayValue: { kind: "mluc", entries: [{ language: "en", country: "US", text: "Ready" }] },
        },
        {
          name: "description",
          value: "metadata",
          displayName: { kind: "mluc", entries: [{ language: "en", country: "US", text: "Description" }] },
          displayValue: { kind: "mluc", entries: [{ language: "ko", country: "KR", text: "메타데이터" }] },
        },
      ],
    };
    const sf32: CmsS15Fixed16ArrayTagValue = {
      kind: "sf32",
      values: [1.25, -0.5, 0.125],
    };
    const uf32: CmsU16Fixed16ArrayTagValue = {
      kind: "uf32",
      values: [1.25, 0.5, 32767.125],
    };
    const clro: CmsColorantOrderTagValue = {
      kind: "clro",
      colorants: [3, 0, 1, 2],
    };
    const ui08: CmsUInt8ArrayTagValue = {
      kind: "ui08",
      values: new Uint8Array([1, 2, 3, 250]),
    };
    const ui32: CmsUInt32ArrayTagValue = {
      kind: "ui32",
      values: [1, 65536, 0xff00ff00],
    };
    const ui64: CmsUInt64ArrayTagValue = {
      kind: "ui64",
      values: [1n, 0x0011223344556677n],
    };
    const cicp: CmsVideoSignalTagValue = {
      kind: "cicp",
      colourPrimaries: 9,
      transferCharacteristics: 16,
      matrixCoefficients: 9,
      videoFullRangeFlag: 1,
    };
    const vcgtFormula: CmsVcgtTagValue = {
      kind: "vcgt",
      storage: "formula",
      curves: [
        cmsBuildParametricToneCurve(5, [2.2, 1, 0, 0, 0, 0.01, 0]),
        cmsBuildParametricToneCurve(5, [2.0, 1, 0, 0, 0, 0.02, 0]),
        cmsBuildParametricToneCurve(5, [1.8, 1, 0, 0, 0, 0.03, 0]),
      ],
    };
    const mhc2: CmsMhc2TagValue = {
      kind: "MHC2",
      curveEntries: 4,
      minLuminance: 0.01,
      peakLuminance: 250,
      xyzToXyzMatrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
      ],
      redCurve: [0, 0.2, 0.6, 1],
      greenCurve: [0, 0.25, 0.65, 1],
      blueCurve: [0, 0.3, 0.7, 1],
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

    expect(reparseSerialized("ncl2", ncl2)).toEqual(ncl2);
    expect(reparseSerialized("meta", dict)).toEqual(dict);
    expect(reparseSerialized("arts", sf32)).toEqual(sf32);
    expect(reparseSerialized("bfd ", uf32)).toEqual(uf32);
    expect(reparseSerialized("clro", clro)).toEqual(clro);
    expect(reparseSerialized("ui08", ui08)).toEqual(ui08);
    expect(reparseSerialized("ui32", ui32)).toEqual(ui32);
    expect(reparseSerialized("ui64", ui64)).toEqual(ui64);
    expect(reparseSerialized("cicp", cicp)).toEqual(cicp);

    const reparsedVcgt = reparseSerialized("vcgt", vcgtFormula) as CmsVcgtTagValue;
    expect(reparsedVcgt.kind).toBe("vcgt");
    expect(reparsedVcgt.storage).toBe("formula");
    expect(reparsedVcgt.curves[0].parametricType).toBe(5);
    expect(reparsedVcgt.curves[0].params?.[0]).toBeCloseTo(2.2, 4);
    expect(reparsedVcgt.curves[1].params?.[5]).toBeCloseTo(0.02, 4);

    const reparsedMhc2 = reparseSerialized("MHC2", mhc2) as CmsMhc2TagValue;
    expect(reparsedMhc2.kind).toBe("MHC2");
    expect(reparsedMhc2.curveEntries).toBe(mhc2.curveEntries);
    expect(reparsedMhc2.minLuminance).toBeCloseTo(mhc2.minLuminance, 4);
    expect(reparsedMhc2.peakLuminance).toBeCloseTo(mhc2.peakLuminance, 4);
    expect(reparsedMhc2.xyzToXyzMatrix).toEqual(mhc2.xyzToXyzMatrix);
    reparsedMhc2.redCurve.forEach((value, index) => expect(value).toBeCloseTo(mhc2.redCurve[index]!, 4));
    reparsedMhc2.greenCurve.forEach((value, index) => expect(value).toBeCloseTo(mhc2.greenCurve[index]!, 4));
    reparsedMhc2.blueCurve.forEach((value, index) => expect(value).toBeCloseTo(mhc2.blueCurve[index]!, 4));
  });

  it("accepts upstream broken cmstypes aliases", () => {
    const xyzPayload = serializeIccTagValue({
      kind: "XYZ",
      value: { X: 0.9642, Y: 1, Z: 0.8249 },
    });
    xyzPayload[0] = 0x17;
    xyzPayload[1] = 0xa5;
    xyzPayload[2] = 0x05;
    xyzPayload[3] = 0xb8;

    const curvePayload = serializeIccTagValue({
      kind: "curv",
      curve: cmsBuildTabulatedToneCurve16(3, [0, 32768, 65535]),
      entryCount: 3,
    });
    curvePayload[0] = 0x94;
    curvePayload[1] = 0x78;
    curvePayload[2] = 0xee;
    curvePayload[3] = 0x00;

    expect(parseIccTagValue(xyzPayload, { signature: "wtpt", offset: 0, size: xyzPayload.byteLength })).toEqual({
      kind: "XYZ",
      value: { X: 0.964202880859375, Y: 1, Z: 0.8249053955078125 },
    });
    expect(parseIccTagValue(curvePayload, { signature: "rTRC", offset: 0, size: curvePayload.byteLength })).toEqual({
      kind: "curv",
      curve: cmsBuildTabulatedToneCurve16(3, [0, 32768, 65535]),
      entryCount: 3,
    });
  });

  it("round-trips embedded text sequence records that use text tags", () => {
    const pseq: CmsProfileSequenceDescTagValue = {
      kind: "pseq",
      entries: [
        {
          deviceMfg: "TEST",
          deviceModel: "TEXT",
          attributes: 0n,
          technology: "CRT ",
          manufacturer: { kind: "text", text: "Maker" },
          model: { kind: "text", text: "Model" },
        },
      ],
    };

    expect(reparseSerialized("pseq", pseq)).toEqual(pseq);
  });
});
