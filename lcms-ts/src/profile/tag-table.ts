import type { CmsIccHeader } from "./header.js";
import { readSignature, readU32, writeSignature, writeU32 } from "./io-base.js";

export interface CmsIccTagEntry {
  readonly signature: string;
  readonly offset: number;
  readonly size: number;
}

const RGB_DISPLAY_REQUIRED_TAGS = ["wtpt", "desc", "cprt"];
const RGB_MATRIX_DISPLAY_ONE_OF = [
  ["A2B0", "B2A0"],
  ["rXYZ", "gXYZ", "bXYZ", "rTRC", "gTRC", "bTRC"],
] as const;
const CMYK_OUTPUT_REQUIRED_TAGS = ["wtpt", "desc", "cprt", "A2B0", "B2A0"];
const DEVICELINK_REQUIRED_TAGS = ["desc", "cprt", "A2B0"];

export function parseIccTagTable(data: Uint8Array, header?: CmsIccHeader): readonly CmsIccTagEntry[] {
  const resolvedHeader = header ?? null;
  const tagCount = resolvedHeader ? resolvedHeader.tagCount : readU32(data, 128);
  const entries: CmsIccTagEntry[] = [];

  for (let index = 0; index < tagCount; index += 1) {
    const offset = 132 + index * 12;
    entries.push({
      signature: readSignature(data, offset),
      offset: readU32(data, offset + 4),
      size: readU32(data, offset + 8),
    });
  }

  return entries;
}

export function serializeIccTagTable(tags: readonly CmsIccTagEntry[]): Uint8Array {
  const data = new Uint8Array(tags.length * 12);

  for (let index = 0; index < tags.length; index += 1) {
    const entryOffset = index * 12;
    const tag = tags[index]!;
    writeSignature(data, entryOffset, tag.signature);
    writeU32(data, entryOffset + 4, tag.offset);
    writeU32(data, entryOffset + 8, tag.size);
  }

  return data;
}

export function validateIccTagTable(
  header: CmsIccHeader,
  tags: readonly CmsIccTagEntry[],
  actualSize: number,
): readonly string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();
  const payloadRanges = tags.map((tag) => ({
    signature: tag.signature,
    start: tag.offset,
    end: tag.offset + tag.size,
  }));

  if (tags.length !== header.tagCount) {
    issues.push(`Tag count mismatch: header=${header.tagCount}, parsed=${tags.length}`);
  }

  for (const tag of tags) {
    seen.set(tag.signature, (seen.get(tag.signature) ?? 0) + 1);

    if (tag.size === 0) {
      issues.push(`Tag ${tag.signature} has zero size`);
    }

    if (tag.offset < 132 + header.tagCount * 12) {
      issues.push(`Tag ${tag.signature} overlaps header/tag table at offset ${tag.offset}`);
    }

    if (tag.offset + tag.size > actualSize) {
      issues.push(`Tag ${tag.signature} exceeds profile size: end=${tag.offset + tag.size}, actual=${actualSize}`);
    }
  }

  for (let i = 0; i < payloadRanges.length; i += 1) {
    const current = payloadRanges[i]!;
    for (let j = i + 1; j < payloadRanges.length; j += 1) {
      const other = payloadRanges[j]!;
      const overlaps = current.start < other.end && other.start < current.end;
      if (!overlaps) {
        continue;
      }

      const identical = current.start === other.start && current.end === other.end;
      if (!identical) {
        issues.push(
          `Tag payload overlap between ${current.signature} [${current.start}, ${current.end}) and ${other.signature} [${other.start}, ${other.end})`,
        );
      }
    }
  }

  for (const [signature, count] of seen) {
    if (count > 1) {
      const distinctPayloads = new Set(
        tags
          .filter((tag) => tag.signature === signature)
          .map((tag) => `${tag.offset}:${tag.size}`),
      );

      if (distinctPayloads.size > 1) {
        issues.push(`Tag ${signature} appears multiple times with different payload ranges`);
      }
    }
  }

  const signatures = new Set(tags.map((tag) => tag.signature));

  for (const signature of getRequiredTagSignatures(header, signatures)) {
    if (!signatures.has(signature)) {
      issues.push(`Missing required tag ${signature} for device class ${header.deviceClass}`);
    }
  }

  return issues;
}

function getRequiredTagSignatures(
  header: CmsIccHeader,
  signatures: ReadonlySet<string>,
): readonly string[] {
  switch (header.deviceClass) {
    case "mntr":
    case "scnr":
      if (
        signatures.has("rXYZ") ||
        signatures.has("gXYZ") ||
        signatures.has("bXYZ") ||
        signatures.has("rTRC") ||
        signatures.has("gTRC") ||
        signatures.has("bTRC")
      ) {
        return [...RGB_DISPLAY_REQUIRED_TAGS, ...RGB_MATRIX_DISPLAY_ONE_OF[1]];
      }
      return [...RGB_DISPLAY_REQUIRED_TAGS, ...RGB_MATRIX_DISPLAY_ONE_OF[0]];

    case "prtr":
      return CMYK_OUTPUT_REQUIRED_TAGS;

    case "link":
      return DEVICELINK_REQUIRED_TAGS;

    case "spac":
    case "abst":
      return ["desc", "cprt", "wtpt"];

    default:
      return ["desc", "cprt"];
  }
}
