import type { CmsHandle } from "../types/primitives.js";
import { serializeIccHeader, type CmsIccHeader } from "./header.js";
import { buildSerializedTagTable, serializeIccTagRecord, type CmsSerializedTagRecord } from "./io-tags.js";
import { parseIccTagValue, type CmsParsedTagValue } from "./tags.js";
import { parseIccHeader } from "./header.js";
import { parseIccTagTable, type CmsIccTagEntry } from "./tag-table.js";

export interface CmsIccProfileRecord {
  readonly signature: string;
  readonly value: CmsParsedTagValue;
}

export interface CmsProfile extends CmsHandle<"profile"> {
  readonly header: CmsIccHeader;
  readonly records: readonly CmsIccProfileRecord[];
}

export interface CmsSerializedIccProfile {
  readonly header: CmsIccHeader;
  readonly tags: readonly CmsIccTagEntry[];
  readonly bytes: Uint8Array;
}

let nextProfileId = 1;

export function serializeIccProfile(
  header: Omit<CmsIccHeader, "profileSize" | "tagCount">,
  records: readonly CmsSerializedTagRecord[],
): CmsSerializedIccProfile {
  const built = buildSerializedTagTable(records);
  const profileSize = 132 + built.tagTable.byteLength + built.payloadBytes.byteLength;
  const resolvedHeader: CmsIccHeader = {
    ...header,
    profileSize,
    tagCount: records.length,
  };
  const bytes = new Uint8Array(profileSize);

  bytes.set(serializeIccHeader(resolvedHeader), 0);
  bytes.set(built.tagTable, 132);
  bytes.set(built.payloadBytes, 132 + built.tagTable.byteLength);

  return {
    header: resolvedHeader,
    tags: built.entries,
    bytes,
  };
}

export function parseIccProfile(data: Uint8Array): {
  readonly header: CmsIccHeader;
  readonly tags: readonly CmsIccTagEntry[];
  readonly records: readonly CmsIccProfileRecord[];
} {
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);

  return {
    header,
    tags,
    records: tags.map((tag) => ({
      signature: tag.signature,
      value: parseIccTagValue(data, tag),
    })),
  };
}

export function cmsOpenProfileFromMem(data: Uint8Array): CmsProfile {
  const parsed = parseIccProfile(data);
  return {
    id: `profile-${nextProfileId++}`,
    kind: "profile",
    header: parsed.header,
    records: parsed.records,
  };
}

export function cmsCreateProfilePlaceholder(
  header: Omit<CmsIccHeader, "profileSize" | "tagCount">,
  records: readonly CmsIccProfileRecord[] = [],
): CmsProfile {
  const serialized = serializeIccProfile(
    header,
    records.map((record) => serializeProfileRecord(record)),
  );

  return {
    id: `profile-${nextProfileId++}`,
    kind: "profile",
    header: serialized.header,
    records: [...records],
  };
}

export function cmsSaveProfileToMem(profile: CmsProfile): Uint8Array {
  return serializeIccProfile(
    profile.header,
    profile.records.map((record) => serializeProfileRecord(record)),
  ).bytes;
}

export function cmsGetTagCount(profile: CmsProfile): number {
  return profile.records.length;
}

export function cmsGetTagSignature(profile: CmsProfile, index: number): string | undefined {
  return profile.records[index]?.signature;
}

export function cmsIsTag(profile: CmsProfile, signature: string): boolean {
  return profile.records.some((record) => record.signature === signature);
}

export function cmsReadTag(profile: CmsProfile, signature: string): CmsParsedTagValue | undefined {
  return profile.records.find((record) => record.signature === signature)?.value;
}

export function cmsWriteTag(profile: CmsProfile, signature: string, value: CmsParsedTagValue): CmsProfile {
  const nextRecords = profile.records.filter((record) => record.signature !== signature);
  nextRecords.push({ signature, value });
  return rebuildProfile(profile, nextRecords);
}

export function cmsReadRawTag(profile: CmsProfile, signature: string): Uint8Array | undefined {
  const record = profile.records.find((entry) => entry.signature === signature);
  return record ? serializeProfileRecord(record).payload : undefined;
}

export function cmsWriteRawTag(profile: CmsProfile, signature: string, payload: Uint8Array): CmsProfile {
  const parsed = parseIccTagValue(payload, {
    signature,
    offset: 0,
    size: payload.byteLength,
  });
  return cmsWriteTag(profile, signature, parsed);
}

function rebuildProfile(profile: CmsProfile, records: readonly CmsIccProfileRecord[]): CmsProfile {
  const serialized = serializeIccProfile(
    profile.header,
    records.map((record) => serializeProfileRecord(record)),
  );

  return {
    ...profile,
    header: serialized.header,
    records: [...records],
  };
}

function serializeProfileRecord(record: CmsIccProfileRecord): CmsSerializedTagRecord {
  return serializeIccTagRecord(record.signature, record.value);
}
