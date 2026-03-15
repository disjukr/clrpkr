import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseIccHeader,
  parseIccTagTable,
  validateIccHeader,
  validateIccTagTable,
} from "../src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const corpusRoot = path.join(repoRoot, "icc-profiles");
const sampleProfiles = [
  "color/Display P3.icc",
  "color/ISO22028-2_ROMM-RGB.icc",
  "color/ITU-RBT709ReferenceDisplay.icc",
  "color/sRGB2014.icc",
  "color/sRGB_v4_ICC_preference.icc",
  "eci/eciCMYK_v2.icc",
  "eci/eciRGB_v2.icc",
  "eci/eciRGB_v2_ICCv4.icc",
  "eci/ISOcoated_v2_300_eci.icc",
  "eci/ISOcoated_v2_eci.icc",
  "eci/ISOuncoatedyellowish.icc",
  "eci/PSOcoated_v3.icc",
  "eci/PSOsc-b_paper_v3_FOGRA54.icc",
  "eci/PSOuncoated_v3_FOGRA52.icc",
  "eci/PSO_Coated_300_NPscreen_ISO12647_eci.icc",
  "eci/PSO_Coated_NPscreen_ISO12647_eci.icc",
  "eci/PSO_LWC_Improved_eci.icc",
  "eci/PSO_LWC_Standard_eci.icc",
  "eci/PSO_MFC_Paper_eci.icc",
  "eci/PSO_SNP_Paper_eci.icc",
  "eci/PSO_Uncoated_ISO12647_eci.icc",
  "eci/PSO_Uncoated_NPscreen_ISO12647_eci.icc",
  "eci/PSR_LWC_PLUS_V2_M1_v2.icc",
  "eci/PSR_LWC_STD_V2_M1.icc",
  "eci/PSR_MF_V2_M1.icc",
  "eci/PSR_SC_PLUS_V2_M1.icc",
  "eci/PSR_SC_STD_V2_M1.icc",
  "eci/SC_paper_eci.icc",
] as const;

describe("ICC sample corpus", () => {
  it("parses and validates all checked-in sample profiles", () => {
    const failures: string[] = [];

    for (const relativePath of sampleProfiles) {
      const fullPath = path.join(corpusRoot, relativePath);
      const data = readFileSync(fullPath);
      const header = parseIccHeader(data);
      const tags = parseIccTagTable(data, header);
      const issues = [
        ...validateIccHeader(header, data.byteLength),
        ...validateIccTagTable(header, tags, data.byteLength),
      ];

      if (issues.length > 0) {
        failures.push(`${relativePath}: ${issues.join("; ")}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("covers both ICC v2/v3-era and v4 profiles in the sample corpus", () => {
    const majors = new Set<number>();

    for (const relativePath of sampleProfiles) {
      const fullPath = path.join(corpusRoot, relativePath);
      const data = readFileSync(fullPath);
      majors.add(parseIccHeader(data).versionMajor);
    }

    expect(majors.has(2)).toBe(true);
    expect(majors.has(4)).toBe(true);
  });

  it("shows tag table diversity across the corpus", () => {
    const signatures = new Set<string>();

    for (const relativePath of sampleProfiles) {
      const fullPath = path.join(corpusRoot, relativePath);
      const data = readFileSync(fullPath);
      const header = parseIccHeader(data);
      const tags = parseIccTagTable(data, header);

      for (const tag of tags) {
        signatures.add(tag.signature);
      }
    }

    expect(signatures.has("A2B0")).toBe(true);
    expect(signatures.has("wtpt")).toBe(true);
    expect(signatures.has("desc")).toBe(true);
    expect(signatures.has("cprt")).toBe(true);
  });
});
