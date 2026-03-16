import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const packageDir = process.cwd();
const upstreamDir = path.join(packageDir, "tmp", "Little-CMS");
const srcDir = path.join(upstreamDir, "src");
const includeDir = path.join(upstreamDir, "include");
const oracleDir = path.join(packageDir, "oracle");
const outDir = path.join(packageDir, "tmp", "oracle");
const outputPath = path.join(outDir, "packing_oracle.exe");

const sourceFiles = [
  "cmsalpha.c",
  "cmscam02.c",
  "cmscgats.c",
  "cmscnvrt.c",
  "cmserr.c",
  "cmsgamma.c",
  "cmsgmt.c",
  "cmshalf.c",
  "cmsintrp.c",
  "cmsio0.c",
  "cmsio1.c",
  "cmslut.c",
  "cmsmd5.c",
  "cmsmtrx.c",
  "cmsnamed.c",
  "cmsopt.c",
  "cmspack.c",
  "cmspcs.c",
  "cmsplugin.c",
  "cmsps2.c",
  "cmssamp.c",
  "cmssm.c",
  "cmstypes.c",
  "cmsvirt.c",
  "cmswtpnt.c",
  "cmsxform.c",
].map((file) => path.join(srcDir, file));

await mkdir(outDir, { recursive: true });

const args = [
  "cc",
  "-O2",
  "-std=c99",
  "-DCMS_NO_PTHREADS=1",
  "-I",
  includeDir,
  "-I",
  srcDir,
  "-o",
  outputPath,
  path.join(oracleDir, "packing_oracle.c"),
  ...sourceFiles,
  "-lm",
];

await new Promise((resolve, reject) => {
  const child = spawn("zig", args, {
    cwd: packageDir,
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`zig cc failed with exit code ${code}`));
  });

  child.on("error", reject);
});

console.log(`Built oracle at ${outputPath}`);
