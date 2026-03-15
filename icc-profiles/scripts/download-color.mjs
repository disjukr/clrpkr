import path from "node:path";
import {
  collectIccFiles,
  cleanExtractedTree,
  ROOT_DIR,
  downloadFile,
  emptyDir,
  ensureDir,
  expandZip,
  fileExists,
  removeChildrenExcept,
} from "./lib/download-utils.mjs";

const OUTPUT_DIR = path.join(ROOT_DIR, "color");
const TMP_DIR = path.join(OUTPUT_DIR, "tmp");
const ARCHIVES_DIR = path.join(TMP_DIR, "archives");
const EXTRACT_DIR = path.join(TMP_DIR, "extract");

const profiles = [
  {
    label: "sRGB v4 preference",
    url: "https://registry.color.org/rgb-registry/profiles/sRGB_v4_ICC_preference.icc",
    fileName: "sRGB_v4_ICC_preference.icc",
  },
  {
    label: "sRGB v2",
    url: "https://registry.color.org/rgb-registry/profiles/sRGB2014.icc",
    fileName: "sRGB2014.icc",
  },
  {
    label: "Display P3",
    url: "https://registry.color.org/rgb-registry/profiles/DisplayP3.zip",
    archiveFileName: "DisplayP3.zip",
    extractDir: "display-p3",
  },
  {
    label: "ROMM RGB",
    url: "https://registry.color.org/profile-library/profiles/ISO22028-2_ROMM-RGB.icc",
    fileName: "ISO22028-2_ROMM-RGB.icc",
  },
  {
    label: "Rec.709 reference display",
    url: "https://registry.color.org/profile-library/profiles/ITU-RBT709ReferenceDisplay.icc",
    fileName: "ITU-RBT709ReferenceDisplay.icc",
  },
];

await ensureDir(OUTPUT_DIR);
await ensureDir(TMP_DIR);
await ensureDir(ARCHIVES_DIR);
await removeChildrenExcept(OUTPUT_DIR, ["tmp", ".gitkeep"]);
await emptyDir(EXTRACT_DIR);

for (const profile of profiles) {
  if (profile.archiveFileName && profile.extractDir) {
    const archivePath = path.join(ARCHIVES_DIR, profile.archiveFileName);
    const extractPath = path.join(EXTRACT_DIR, profile.extractDir);

    if (!(await fileExists(archivePath))) {
      console.log(`Downloading ${profile.label}`);
      await downloadFile(profile.url, archivePath);
    } else {
      console.log(`Skipping download for ${profile.label}: archive already exists`);
    }

    console.log(`Extracting ${profile.archiveFileName}`);
    await expandZip(archivePath, extractPath);
    await cleanExtractedTree(extractPath);
    continue;
  }

  const destinationPath = path.join(EXTRACT_DIR, profile.fileName);

  if (await fileExists(destinationPath)) {
    console.log(`Refreshing ${profile.label}`);
  } else {
    console.log(`Downloading ${profile.fileName}`);
  }

  await downloadFile(profile.url, destinationPath);
}

await collectIccFiles(EXTRACT_DIR, OUTPUT_DIR);

console.log(`Done. ICC profiles flattened into ${OUTPUT_DIR}`);
