import type { CmsHandle } from "../types/primitives.js";
import { md5Hex } from "../hash/md5.js";
import { serializeIccHeader, type CmsIccHeader } from "./header.js";
import { buildSerializedTagTable, serializeIccTagRecord, type CmsSerializedTagRecord } from "./io-tags.js";
import { parseIccTagValue, type CmsMlucTagValue, type CmsParsedTagValue } from "./tags.js";
import { parseIccHeader } from "./header.js";
import { parseIccTagTable, type CmsIccTagEntry } from "./tag-table.js";

export interface CmsIccProfileRecord {
  readonly signature: string;
  readonly value?: CmsParsedTagValue;
  readonly rawPayload?: Uint8Array;
  readonly rawOnly?: boolean;
  readonly linkedTo?: string;
}

export interface CmsProfile extends CmsHandle<"profile"> {
  readonly header: CmsIccHeader;
  readonly tags: readonly CmsIccTagEntry[];
  readonly records: readonly CmsIccProfileRecord[];
}

export interface CmsSerializedIccProfile {
  readonly header: CmsIccHeader;
  readonly tags: readonly CmsIccTagEntry[];
  readonly bytes: Uint8Array;
}

interface CmsProfileRecordView {
  readonly records: readonly CmsIccProfileRecord[];
}

export const LCMS_USED_AS_INPUT = 0;
export const LCMS_USED_AS_OUTPUT = 1;
export const LCMS_USED_AS_PROOF = 2;

export const INTENT_PERCEPTUAL = 0;
export const INTENT_RELATIVE_COLORIMETRIC = 1;
export const INTENT_SATURATION = 2;
export const INTENT_ABSOLUTE_COLORIMETRIC = 3;
export const cmsInfoDescription = 0;
export const cmsInfoManufacturer = 1;
export const cmsInfoModel = 2;
export const cmsInfoCopyright = 3;

const DEVICE_TO_PCS_16 = ["A2B0", "A2B1", "A2B2", "A2B1"] as const;
const PCS_TO_DEVICE_16 = ["B2A0", "B2A1", "B2A2", "B2A1"] as const;

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

  const profileId = computeSerializedProfileId(bytes);
  const finalHeader: CmsIccHeader = {
    ...resolvedHeader,
    profileId,
  };
  bytes.set(serializeIccHeader(finalHeader), 0);

  return {
    header: finalHeader,
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
  const parsedOwners = new Map<string, CmsIccProfileRecord>();

  return {
    header,
    tags,
    records: tags.map((tag) => {
      const rawPayload = data.slice(tag.offset, tag.offset + tag.size);
      const payloadKey = `${tag.offset}:${tag.size}`;

      try {
        const value = parseIccTagValue(data, tag);
        const owner = parsedOwners.get(payloadKey);
        const record = {
          signature: tag.signature,
          value,
          rawPayload,
          ...(owner && areTagSignaturesLinkCompatible(owner.signature, tag.signature) ? { linkedTo: owner.signature } : {}),
        };
        parsedOwners.set(payloadKey, record);
        return record;
      } catch {
        return {
          signature: tag.signature,
          rawPayload,
          rawOnly: true,
        };
      }
    }),
  };
}

export function cmsOpenProfileFromMem(data: Uint8Array): CmsProfile {
  const parsed = parseIccProfile(data);
  return {
    id: `profile-${nextProfileId++}`,
    kind: "profile",
    header: parsed.header,
    tags: parsed.tags,
    records: parsed.records,
  };
}

export function cmsCreateProfilePlaceholder(
  header: Omit<CmsIccHeader, "profileSize" | "tagCount">,
  records: readonly CmsIccProfileRecord[] = [],
): CmsProfile {
  const profile = {
    id: `profile-${nextProfileId++}`,
    kind: "profile" as const,
    header,
    tags: [],
    records: [...records],
  };
  const serialized = serializeIccProfile(
    header,
    records.map((record) => serializeProfileRecord(profile, record)),
  );

  return {
    id: profile.id,
    kind: profile.kind,
    header: serialized.header,
    tags: serialized.tags,
    records: [...records],
  };
}

export function cmsSaveProfileToMem(profile: CmsProfile): Uint8Array {
  return serializeIccProfile(
    profile.header,
    profile.records.map((record) => serializeProfileRecord(profile, record)),
  ).bytes;
}

export function cmsSaveProfileToStream(
  profile: CmsProfile,
  stream: { write(chunk: Uint8Array): void },
): void {
  stream.write(cmsSaveProfileToMem(profile));
}

export function cmsGetTagCount(profile: CmsProfile): number {
  return profile.records.length;
}

export function cmsGetHeaderRenderingIntent(profile: CmsProfile): number {
  return profile.header.renderingIntent;
}

export function cmsGetColorSpace(profile: CmsProfile): string {
  return profile.header.colorSpace;
}

export function cmsGetPCS(profile: CmsProfile): string {
  return profile.header.pcs;
}

export function cmsGetDeviceClass(profile: CmsProfile): string {
  return profile.header.deviceClass;
}

export function cmsGetTagSignature(profile: CmsProfile, index: number): string | undefined {
  return profile.records[index]?.signature;
}

export function cmsIsTag(profile: CmsProfile, signature: string): boolean {
  return profile.records.some((record) => record.signature === signature);
}

export function cmsReadTag(profile: CmsProfile, signature: string): CmsParsedTagValue | undefined {
  const record = resolveRecord(profile, signature);
  if (!record || record.rawOnly) {
    return undefined;
  }
  return record.value;
}

export function cmsWriteTag(profile: CmsProfile, signature: string, value: CmsParsedTagValue): CmsProfile {
  const nextRecords = profile.records.filter((record) => record.signature !== signature);
  nextRecords.push({ signature, value });
  return rebuildProfile(profile, nextRecords);
}

export function cmsLinkTag(profile: CmsProfile, signature: string, targetSignature: string): CmsProfile {
  const target = profile.records.find((record) => record.signature === targetSignature);
  if (!target) {
    throw new Error(`Cannot link tag ${signature} to missing target ${targetSignature}`);
  }

  const nextRecords = profile.records.filter((record) => record.signature !== signature);
  nextRecords.push({
    signature,
    linkedTo: targetSignature,
  });
  return rebuildProfile(profile, nextRecords);
}

export function cmsTagLinkedTo(profile: CmsProfile, signature: string): string | undefined {
  return profile.records.find((record) => record.signature === signature)?.linkedTo;
}

export function cmsGetTagOffsetAndSize(
  profile: CmsProfile,
  signature: string,
): { offset: number; size: number } | undefined {
  const entry = profile.tags.find((tag) => tag.signature === signature);
  return entry ? { offset: entry.offset, size: entry.size } : undefined;
}

export function cmsReadRawTag(profile: CmsProfile, signature: string): Uint8Array | undefined {
  const record = resolveRecord(profile, signature);
  if (!record) {
    return undefined;
  }
  if (record.rawPayload) {
    return new Uint8Array(record.rawPayload);
  }
  return serializeProfileRecord(profile, record).payload;
}

export function cmsIsMatrixShaper(profile: CmsProfile): boolean {
  switch (profile.header.colorSpace) {
    case "GRAY":
      return cmsIsTag(profile, "kTRC");
    case "RGB ":
      return (
        cmsIsTag(profile, "rXYZ") &&
        cmsIsTag(profile, "gXYZ") &&
        cmsIsTag(profile, "bXYZ") &&
        cmsIsTag(profile, "rTRC") &&
        cmsIsTag(profile, "gTRC") &&
        cmsIsTag(profile, "bTRC")
      );
    default:
      return false;
  }
}

export function cmsIsCLUT(profile: CmsProfile, intent: number, usedDirection: number): boolean {
  if (profile.header.deviceClass === "link") {
    return profile.header.renderingIntent === intent;
  }

  switch (usedDirection) {
    case LCMS_USED_AS_INPUT:
      return intent >= 0 && intent <= INTENT_ABSOLUTE_COLORIMETRIC
        ? cmsIsTag(profile, DEVICE_TO_PCS_16[intent]!)
        : false;
    case LCMS_USED_AS_OUTPUT:
      return intent >= 0 && intent <= INTENT_ABSOLUTE_COLORIMETRIC
        ? cmsIsTag(profile, PCS_TO_DEVICE_16[intent]!)
        : false;
    case LCMS_USED_AS_PROOF:
      return (
        cmsIsIntentSupported(profile, intent, LCMS_USED_AS_INPUT) &&
        cmsIsIntentSupported(profile, INTENT_RELATIVE_COLORIMETRIC, LCMS_USED_AS_OUTPUT)
      );
    default:
      return false;
  }
}

export function cmsIsIntentSupported(profile: CmsProfile, intent: number, usedDirection: number): boolean {
  if (cmsIsCLUT(profile, intent, usedDirection)) {
    return true;
  }

  return cmsIsMatrixShaper(profile);
}

export function cmsWriteRawTag(profile: CmsProfile, signature: string, payload: Uint8Array): CmsProfile {
  const nextRecords = profile.records.filter((record) => record.signature !== signature);
  nextRecords.push({
    signature,
    rawPayload: new Uint8Array(payload),
    rawOnly: true,
  });
  return rebuildProfile(profile, nextRecords);
}

export function cmsGetProfileInfo(
  profile: CmsProfile,
  info: number,
  languageCode = "en",
  countryCode = "US",
): string | undefined {
  const tag = getInfoTag(profile, info);
  if (!tag) {
    return undefined;
  }

  switch (tag.kind) {
    case "desc":
    case "text":
      return tag.text;
    case "mluc":
      return getLocalizedText(tag, languageCode, countryCode);
  }
}

export function cmsGetProfileInfoASCII(
  profile: CmsProfile,
  info: number,
  languageCode = "en",
  countryCode = "US",
): string | undefined {
  const text = cmsGetProfileInfo(profile, info, languageCode, countryCode);
  return text === undefined ? undefined : asciiFallback(text);
}

export function cmsGetProfileInfoUTF8(
  profile: CmsProfile,
  info: number,
  languageCode = "en",
  countryCode = "US",
): string | undefined {
  return cmsGetProfileInfo(profile, info, languageCode, countryCode);
}

function rebuildProfile(profile: CmsProfile, records: readonly CmsIccProfileRecord[]): CmsProfile {
  const serialized = serializeIccProfile(
    profile.header,
    records.map((record) => serializeProfileRecord(profileFromRecords(profile, records), record)),
  );

  return {
    ...profile,
    header: serialized.header,
    tags: serialized.tags,
    records: [...records],
  };
}

function computeSerializedProfileId(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes);
  copy.fill(0, 44, 48);
  copy.fill(0, 64, 68);
  copy.fill(0, 84, 100);
  return md5Hex(copy);
}

function serializeProfileRecord(profile: CmsProfileRecordView, record: CmsIccProfileRecord): CmsSerializedTagRecord {
  const target = resolveRecord(profile, record.signature);
  if (!target) {
    throw new Error(`Missing tag ${record.signature}`);
  }
  const payloadKey = getSerializedPayloadKey(profile, record);

  if (target.rawPayload) {
    return {
      signature: record.signature,
      payload: new Uint8Array(target.rawPayload),
      ...(payloadKey ? { payloadKey } : {}),
    };
  }

  if (!target.value) {
    throw new Error(`Tag ${record.signature} has no parsed value`);
  }

  return serializeIccTagRecord(
    record.signature,
    target.value,
    payloadKey,
  );
}

function profileFromRecords(profile: CmsProfileRecordView, records: readonly CmsIccProfileRecord[]): CmsProfileRecordView {
  return {
    records,
  };
}

function getDirectRecord(profile: CmsProfileRecordView, signature: string): CmsIccProfileRecord | undefined {
  return profile.records.find((record) => record.signature === signature);
}

function getSerializedPayloadKey(profile: CmsProfileRecordView, record: CmsIccProfileRecord): string | undefined {
  if (record.linkedTo) {
    return resolveLinkedRootSignature(profile, record.linkedTo);
  }

  return profile.records.some((candidate) => candidate.linkedTo === record.signature) ? record.signature : undefined;
}

function resolveLinkedRootSignature(profile: CmsProfileRecordView, signature: string): string {
  const seen = new Set<string>();
  let current = signature;

  while (true) {
    if (seen.has(current)) {
      throw new Error(`Circular tag link detected for ${signature}`);
    }
    seen.add(current);

    const record = getDirectRecord(profile, current);
    if (!record?.linkedTo) {
      return current;
    }
    current = record.linkedTo;
  }
}

function areTagSignaturesLinkCompatible(left: string, right: string): boolean {
  const leftGroup = getTagLinkCompatibilityGroup(left);
  return leftGroup !== undefined && leftGroup === getTagLinkCompatibilityGroup(right);
}

function getTagLinkCompatibilityGroup(signature: string): string | undefined {
  if (signature === "rTRC" || signature === "gTRC" || signature === "bTRC" || signature === "kTRC") {
    return "TRC";
  }

  if (signature === "rXYZ" || signature === "gXYZ" || signature === "bXYZ" || signature === "lumi") {
    return "XYZ";
  }

  if (signature === "A2B0" || signature === "A2B1" || signature === "A2B2" || signature === "D2B0" || signature === "D2B1" || signature === "D2B2" || signature === "D2B3") {
    return "DEVICE_TO_PCS";
  }

  if (signature === "B2A0" || signature === "B2A1" || signature === "B2A2" || signature === "B2D0" || signature === "B2D1" || signature === "B2D2" || signature === "B2D3") {
    return "PCS_TO_DEVICE";
  }

  if (signature === "pre0" || signature === "pre1" || signature === "pre2") {
    return "PREVIEW";
  }

  return undefined;
}

function resolveRecord(profile: CmsProfileRecordView, signature: string): CmsIccProfileRecord | undefined {
  const seen = new Set<string>();
  let currentSignature: string | undefined = signature;

  while (currentSignature) {
    if (seen.has(currentSignature)) {
      throw new Error(`Circular tag link detected for ${signature}`);
    }
    seen.add(currentSignature);

    const record = getDirectRecord(profile, currentSignature);
    if (!record) {
      return undefined;
    }
    if (!record.linkedTo) {
      return record;
    }
    currentSignature = record.linkedTo;
  }

  return undefined;
}

function getInfoTag(profile: CmsProfile, info: number): Extract<CmsParsedTagValue, { kind: "desc" | "text" | "mluc" }> | undefined {
  let signature: string;

  switch (info) {
    case cmsInfoDescription:
      signature = cmsIsTag(profile, "dscm") ? "dscm" : "desc";
      break;
    case cmsInfoManufacturer:
      signature = "dmnd";
      break;
    case cmsInfoModel:
      signature = "dmdd";
      break;
    case cmsInfoCopyright:
      signature = "cprt";
      break;
    default:
      return undefined;
  }

  const tag = cmsReadTag(profile, signature);
  return tag?.kind === "desc" || tag?.kind === "text" || tag?.kind === "mluc" ? tag : undefined;
}

function getLocalizedText(tag: CmsMlucTagValue, languageCode: string, countryCode: string): string | undefined {
  const normalizedLanguage = languageCode.slice(0, 2).toLowerCase();
  const normalizedCountry = countryCode.slice(0, 2).toUpperCase();

  return (
    tag.entries.find((entry) => entry.language.toLowerCase() === normalizedLanguage && entry.country.toUpperCase() === normalizedCountry)?.text ??
    tag.entries.find((entry) => entry.language.toLowerCase() === normalizedLanguage)?.text ??
    tag.entries[0]?.text
  );
}

function asciiFallback(text: string): string {
  return Array.from(text, (char) => (char.charCodeAt(0) <= 0x7f ? char : "?")).join("");
}
