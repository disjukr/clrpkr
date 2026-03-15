import { describe, expect, it } from "vitest";

import {
  cmsCreateProfilePlaceholder,
  cmsGetProfileInfo,
  cmsGetProfileInfoASCII,
  cmsGetProfileInfoUTF8,
  cmsInfoCopyright,
  cmsInfoDescription,
  cmsInfoManufacturer,
  cmsInfoModel,
} from "../src/index.js";

const BASE_HEADER = {
  cmmId: "lcms",
  version: 0x04300000,
  deviceClass: "mntr",
  colorSpace: "RGB ",
  pcs: "XYZ ",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  fileSignature: "acsp",
  platform: "APPL",
  flags: 0,
  manufacturer: "test",
  model: "demo",
  attributes: 0n,
  renderingIntent: 0,
  illuminant: { X: 0.9642, Y: 1, Z: 0.8249 },
  creator: "ts  ",
  profileId: "00000000000000000000000000000000",
};

describe("profile info", () => {
  it("reads localized mluc info with language fallback", () => {
    const profile = cmsCreateProfilePlaceholder(BASE_HEADER, [
      {
        signature: "desc",
        value: {
          kind: "mluc",
          entries: [
            { language: "en", country: "US", text: "Demo profile" },
            { language: "ko", country: "KR", text: "데모 프로파일" },
          ],
        },
      },
      {
        signature: "dmnd",
        value: {
          kind: "text",
          text: "OpenAI",
        },
      },
      {
        signature: "dmdd",
        value: {
          kind: "desc",
          text: "Model 1",
        },
      },
      {
        signature: "cprt",
        value: {
          kind: "text",
          text: "Copyright 2026",
        },
      },
    ]);

    expect(cmsGetProfileInfo(profile, cmsInfoDescription, "ko", "KR")).toBe("데모 프로파일");
    expect(cmsGetProfileInfo(profile, cmsInfoDescription, "fr", "FR")).toBe("Demo profile");
    expect(cmsGetProfileInfo(profile, cmsInfoManufacturer, "en", "US")).toBe("OpenAI");
    expect(cmsGetProfileInfo(profile, cmsInfoModel, "en", "US")).toBe("Model 1");
    expect(cmsGetProfileInfo(profile, cmsInfoCopyright, "en", "US")).toBe("Copyright 2026");
  });

  it("exposes ASCII and UTF-8 profile info variants", () => {
    const profile = cmsCreateProfilePlaceholder(BASE_HEADER, [
      {
        signature: "desc",
        value: {
          kind: "mluc",
          entries: [{ language: "ko", country: "KR", text: "데모" }],
        },
      },
    ]);

    expect(cmsGetProfileInfoASCII(profile, cmsInfoDescription, "ko", "KR")).toBe("??");
    expect(cmsGetProfileInfoUTF8(profile, cmsInfoDescription, "ko", "KR")).toBe("데모");
  });
});
