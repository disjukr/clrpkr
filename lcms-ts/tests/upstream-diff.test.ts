import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import {
  cmsGetTagCount,
  cmsGetTagOffsetAndSize,
  cmsGetTagSignature,
  cmsIsCLUT,
  cmsIsIntentSupported,
  cmsIsMatrixShaper,
  cmsOpenProfileFromMem,
  cmsReadDevicelinkLUT,
  cmsReadInputLUT,
  cmsReadOutputLUT,
  cmsSaveProfileToMem,
  cmsTagLinkedTo,
  LCMS_USED_AS_INPUT,
  LCMS_USED_AS_OUTPUT,
  LCMS_USED_AS_PROOF,
  type CmsPipeline,
  type CmsPipelineStage,
  type CmsProfile,
} from "../src/index.js";

const packageDir = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(packageDir, "tmp", "oracle", "profile_diff_oracle.exe");
const helperSource = path.join(packageDir, "oracle", "profile_diff_oracle.c");
const buildScript = path.join(packageDir, "scripts", "build-profile-diff-oracle.mjs");
const profileDir = path.join(packageDir, "tmp", "Little-CMS", "testbed");

const profiles = ["ibm-t61.icc", "crayons.icc", "new.icc"] as const;

interface TagSummary {
  readonly signature: string;
  readonly offset: number;
  readonly size: number;
  readonly linkedTo: string | null;
}

interface PipelineStageSummary {
  readonly kind: string;
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly gridPoints?: readonly number[];
}

interface PipelineSummary {
  readonly inputChannels: number;
  readonly outputChannels: number;
  readonly stages: readonly PipelineStageSummary[];
}

interface ProfileSummary {
  readonly parse: {
    readonly deviceClass: string;
    readonly colorSpace: string;
    readonly pcs: string;
    readonly renderingIntent: number;
    readonly tagCount: number;
    readonly tags: readonly TagSummary[];
  };
  readonly selection: {
    readonly isMatrixShaper: boolean;
    readonly input: readonly {
      readonly intent: number;
      readonly isClut: boolean;
      readonly isSupported: boolean;
      readonly pipeline: PipelineSummary | null;
    }[];
    readonly output: readonly {
      readonly intent: number;
      readonly isClut: boolean;
      readonly isSupported: boolean;
      readonly pipeline: PipelineSummary | null;
    }[];
    readonly proof: readonly {
      readonly intent: number;
      readonly isClut: boolean;
      readonly isSupported: boolean;
    }[];
    readonly devicelink: readonly {
      readonly intent: number;
      readonly pipeline: PipelineSummary | null;
    }[];
  };
}

interface OracleOutput {
  readonly original: ProfileSummary;
  readonly saved: ProfileSummary;
}

function run(command: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `${command} ${args.join(" ")} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

async function ensureHelper(): Promise<void> {
  let needsBuild = false;

  try {
    const [helperStat, sourceStat] = await Promise.all([stat(helperPath), stat(helperSource)]);
    if (helperStat.mtimeMs < sourceStat.mtimeMs) {
      needsBuild = true;
    }
  } catch {
    needsBuild = true;
  }

  if (needsBuild) {
    await run(process.execPath, [buildScript]);
    await access(helperPath);
  }
}

function mapStageKind(stage: CmsPipelineStage): string {
  switch (stage.kind) {
    case "tone-curves":
      return "cvst";
    case "matrix":
      return "matf";
    case "clut8":
    case "clut16":
    case "clutf":
      return "clut";
    case "named-color":
      return "ncl ";
    case "lab-v2-to-v4":
      return "2 4 ";
    case "lab-v4-to-v2":
      return "4 2 ";
    case "normalize-to-lab":
      return "l2d ";
    case "normalize-from-lab":
      return "d2l ";
    case "normalize-to-xyz":
      return "x2d ";
    case "normalize-from-xyz":
      return "d2x ";
  }
}

function summarizePipeline(pipeline: CmsPipeline | null): PipelineSummary | null {
  if (!pipeline) {
    return null;
  }

  return {
    inputChannels: pipeline.inputChannels,
    outputChannels: pipeline.outputChannels,
    stages: pipeline.stages.map((stage) => {
      switch (stage.kind) {
        case "tone-curves":
          return {
            kind: mapStageKind(stage),
            inputChannels: stage.channels,
            outputChannels: stage.channels,
          };
        case "matrix":
          return {
            kind: mapStageKind(stage),
            inputChannels: stage.cols,
            outputChannels: stage.rows,
          };
        case "clut8":
        case "clut16":
        case "clutf":
          return {
            kind: mapStageKind(stage),
            inputChannels: stage.inputChannels,
            outputChannels: stage.outputChannels,
            gridPoints: stage.gridPoints,
          };
        default:
          return {
            kind: mapStageKind(stage),
            inputChannels: "inputChannels" in stage ? (stage as { inputChannels: number }).inputChannels : 3,
            outputChannels: "outputChannels" in stage ? (stage as { outputChannels: number }).outputChannels : 3,
          };
      }
    }),
  };
}

function summarizeProfile(profile: CmsProfile): ProfileSummary {
  const tagCount = cmsGetTagCount(profile);
  const tags: TagSummary[] = [];

  for (let index = 0; index < tagCount; index += 1) {
    const signature = cmsGetTagSignature(profile, index);
    if (!signature) {
      continue;
    }
    const range = cmsGetTagOffsetAndSize(profile, signature);
    tags.push({
      signature,
      offset: range?.offset ?? 0,
      size: range?.size ?? 0,
      linkedTo: cmsTagLinkedTo(profile, signature) ?? null,
    });
  }

  return {
    parse: {
      deviceClass: profile.header.deviceClass,
      colorSpace: profile.header.colorSpace,
      pcs: profile.header.pcs,
      renderingIntent: profile.header.renderingIntent,
      tagCount,
      tags,
    },
    selection: {
      isMatrixShaper: cmsIsMatrixShaper(profile),
      input: [0, 1, 2, 3].map((intent) => ({
        intent,
        isClut: cmsIsCLUT(profile, intent, LCMS_USED_AS_INPUT),
        isSupported: cmsIsIntentSupported(profile, intent, LCMS_USED_AS_INPUT),
        pipeline: summarizePipeline(cmsReadInputLUT(profile, intent)),
      })),
      output: [0, 1, 2, 3].map((intent) => ({
        intent,
        isClut: cmsIsCLUT(profile, intent, LCMS_USED_AS_OUTPUT),
        isSupported: cmsIsIntentSupported(profile, intent, LCMS_USED_AS_OUTPUT),
        pipeline: summarizePipeline(cmsReadOutputLUT(profile, intent)),
      })),
      proof: [0, 1, 2, 3].map((intent) => ({
        intent,
        isClut: cmsIsCLUT(profile, intent, LCMS_USED_AS_PROOF),
        isSupported: cmsIsIntentSupported(profile, intent, LCMS_USED_AS_PROOF),
      })),
      devicelink: [0, 1, 2, 3].map((intent) => ({
        intent,
        pipeline: summarizePipeline(cmsReadDevicelinkLUT(profile, intent)),
      })),
    },
  };
}

async function getOracleSummary(profilePath: string): Promise<OracleOutput> {
  const { stdout } = await run(helperPath, [profilePath]);
  return JSON.parse(stdout) as OracleOutput;
}

async function getTsSummary(profilePath: string): Promise<OracleOutput> {
  const bytes = new Uint8Array(await readFile(profilePath));
  const original = cmsOpenProfileFromMem(bytes);
  const savedBytes = cmsSaveProfileToMem(original);
  const saved = cmsOpenProfileFromMem(savedBytes);

  return {
    original: summarizeProfile(original),
    saved: summarizeProfile(saved),
  };
}

describe("upstream differential profile behavior", () => {
  beforeAll(async () => {
    await ensureHelper();
  });

  for (const profileName of profiles) {
    it(`matches upstream for ${profileName}`, async () => {
      const profilePath = path.join(profileDir, profileName);
      const [oracle, ts] = await Promise.all([getOracleSummary(profilePath), getTsSummary(profilePath)]);

      expect(ts).toEqual(oracle);
    });
  }
});
