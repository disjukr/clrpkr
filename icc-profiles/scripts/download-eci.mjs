import path from "node:path";
import {
  ROOT_DIR,
  collectIccFiles,
  cleanExtractedTree,
  downloadFile,
  emptyDir,
  ensureDir,
  expandZip,
  fileExists,
  removeChildrenExcept,
} from "./lib/download-utils.mjs";

const OUTPUT_DIR = path.join(ROOT_DIR, "eci");
const TMP_DIR = path.join(OUTPUT_DIR, "tmp");
const ARCHIVES_DIR = path.join(TMP_DIR, "archives");
const EXTRACT_DIR = path.join(TMP_DIR, "extract");

const packages = [
  {
    label: "PSO Coated v3",
    url: "https://eci.org/lib/exe/pso-coated_v3.zip",
    fileName: "pso-coated_v3.zip",
    extractDir: "pso-coated_v3",
  },
  {
    label: "PSO Uncoated v3 (FOGRA52)",
    url: "https://eci.org/lib/exe/pso-uncoated_v3_fogra52.zip",
    fileName: "pso-uncoated_v3_fogra52.zip",
    extractDir: "pso-uncoated_v3_fogra52",
  },
  {
    label: "PSO SC-B Paper v3",
    url: "https://eci.org/lib/exe/pso_sc-b_paper_v3.zip",
    fileName: "pso_sc-b_paper_v3.zip",
    extractDir: "pso_sc-b_paper_v3",
  },
  {
    label: "PSR v2 M1 gravure profiles",
    url: "https://eci.org/lib/exe/eci_gravure_psr_v2_m1_2020.zip",
    fileName: "eci_gravure_psr_v2_m1_2020.zip",
    extractDir: "eci_gravure_psr_v2_m1_2020",
  },
  {
    label: "eciRGB v2",
    url: "https://eci.org/lib/exe/ecirgbv20.zip",
    fileName: "ecirgbv20.zip",
    extractDir: "ecirgbv20",
  },
  {
    label: "eciCMYK v2",
    url: "https://eci.org/lib/exe/eci_cmyk_v2.zip",
    fileName: "eci_cmyk_v2.zip",
    extractDir: "eci_cmyk_v2",
  },
  {
    label: "ECI Offset 2009 legacy set",
    url: "https://eci.org/lib/exe/eci_offset_2009.zip",
    fileName: "eci_offset_2009.zip",
    extractDir: "eci_offset_2009",
  },
];

await ensureDir(OUTPUT_DIR);
await ensureDir(TMP_DIR);
await ensureDir(ARCHIVES_DIR);
await removeChildrenExcept(OUTPUT_DIR, ["tmp", ".gitkeep"]);
await emptyDir(EXTRACT_DIR);

for (const pkg of packages) {
  const archivePath = path.join(ARCHIVES_DIR, pkg.fileName);
  const extractPath = path.join(EXTRACT_DIR, pkg.extractDir);

  if (!(await fileExists(archivePath))) {
    console.log(`Downloading ${pkg.label}`);
    await downloadFile(pkg.url, archivePath);
  } else {
    console.log(`Skipping download for ${pkg.label}: archive already exists`);
  }

  console.log(`Extracting ${pkg.fileName}`);
  await expandZip(archivePath, extractPath);
  await cleanExtractedTree(extractPath);
}

await collectIccFiles(EXTRACT_DIR, OUTPUT_DIR);

console.log(`Done. ICC profiles flattened into ${OUTPUT_DIR}`);
