import {
  readDateTime,
  readProfileId,
  readS15Fixed16,
  readSignature,
  readU32,
  readU64,
  writeProfileId,
  type CmsIccDateTime,
} from "./io-base.js";

export interface CmsIccXYZNumber {
  readonly X: number;
  readonly Y: number;
  readonly Z: number;
}

export interface CmsIccHeader {
  readonly profileSize: number;
  readonly preferredCmmType: string;
  readonly versionMajor: number;
  readonly versionMinor: number;
  readonly versionBugfix: number;
  readonly deviceClass: string;
  readonly colorSpace: string;
  readonly pcs: string;
  readonly createdAt: CmsIccDateTime;
  readonly magic: string;
  readonly platform: string;
  readonly flags: number;
  readonly manufacturer: string;
  readonly model: string;
  readonly attributes: bigint;
  readonly renderingIntent: number;
  readonly illuminant: CmsIccXYZNumber;
  readonly creator: string;
  readonly profileId: string;
  readonly tagCount: number;
}

const KNOWN_DEVICE_CLASSES = new Set([
  "scnr",
  "mntr",
  "prtr",
  "link",
  "spac",
  "abst",
  "nmcl",
]);

const KNOWN_PCS = new Set(["XYZ ", "Lab "]);

export function parseIccHeader(data: Uint8Array): CmsIccHeader {
  if (data.byteLength < 132) {
    throw new Error(`ICC data is too short: expected at least 132 bytes, got ${data.byteLength}`);
  }

  const versionRaw = readU32(data, 8);

  return {
    profileSize: readU32(data, 0),
    preferredCmmType: readSignature(data, 4),
    versionMajor: (versionRaw >>> 24) & 0xff,
    versionMinor: (versionRaw >>> 20) & 0x0f,
    versionBugfix: (versionRaw >>> 16) & 0x0f,
    deviceClass: readSignature(data, 12),
    colorSpace: readSignature(data, 16),
    pcs: readSignature(data, 20),
    createdAt: readDateTime(data, 24),
    magic: readSignature(data, 36),
    platform: readSignature(data, 40),
    flags: readU32(data, 44),
    manufacturer: readSignature(data, 48),
    model: readSignature(data, 52),
    attributes: readU64(data, 56),
    renderingIntent: readU32(data, 64),
    illuminant: {
      X: readS15Fixed16(data, 68),
      Y: readS15Fixed16(data, 72),
      Z: readS15Fixed16(data, 76),
    },
    creator: readSignature(data, 80),
    profileId: readProfileId(data.slice(84, 100)),
    tagCount: readU32(data, 128),
  };
}

export function serializeIccHeader(header: CmsIccHeader): Uint8Array {
  const data = new Uint8Array(132);
  const versionRaw =
    ((header.versionMajor & 0xff) << 24) |
    ((header.versionMinor & 0x0f) << 20) |
    ((header.versionBugfix & 0x0f) << 16);

  new DataView(data.buffer).setUint32(0, header.profileSize, false);
  data.set(new TextEncoder().encode(header.preferredCmmType), 4);
  new DataView(data.buffer).setUint32(8, versionRaw >>> 0, false);
  data.set(new TextEncoder().encode(header.deviceClass), 12);
  data.set(new TextEncoder().encode(header.colorSpace), 16);
  data.set(new TextEncoder().encode(header.pcs), 20);
  new DataView(data.buffer).setUint16(24, header.createdAt.year, false);
  new DataView(data.buffer).setUint16(26, header.createdAt.month, false);
  new DataView(data.buffer).setUint16(28, header.createdAt.day, false);
  new DataView(data.buffer).setUint16(30, header.createdAt.hours, false);
  new DataView(data.buffer).setUint16(32, header.createdAt.minutes, false);
  new DataView(data.buffer).setUint16(34, header.createdAt.seconds, false);
  data.set(new TextEncoder().encode(header.magic), 36);
  data.set(new TextEncoder().encode(header.platform), 40);
  new DataView(data.buffer).setUint32(44, header.flags, false);
  data.set(new TextEncoder().encode(header.manufacturer), 48);
  data.set(new TextEncoder().encode(header.model), 52);
  new DataView(data.buffer).setBigUint64(56, header.attributes, false);
  new DataView(data.buffer).setUint32(64, header.renderingIntent, false);
  new DataView(data.buffer).setInt32(68, Math.round(header.illuminant.X * 65536), false);
  new DataView(data.buffer).setInt32(72, Math.round(header.illuminant.Y * 65536), false);
  new DataView(data.buffer).setInt32(76, Math.round(header.illuminant.Z * 65536), false);
  data.set(new TextEncoder().encode(header.creator), 80);
  writeProfileId(data, 84, header.profileId);
  new DataView(data.buffer).setUint32(128, header.tagCount, false);
  return data;
}

export function validateIccHeader(header: CmsIccHeader, actualSize: number): readonly string[] {
  const issues: string[] = [];

  if (header.profileSize !== actualSize) {
    issues.push(`Profile size mismatch: header=${header.profileSize}, actual=${actualSize}`);
  }

  if (header.magic !== "acsp") {
    issues.push(`Invalid ICC magic: ${JSON.stringify(header.magic)}`);
  }

  if (!KNOWN_DEVICE_CLASSES.has(header.deviceClass)) {
    issues.push(`Unknown device class: ${JSON.stringify(header.deviceClass)}`);
  }

  if (!KNOWN_PCS.has(header.pcs)) {
    issues.push(`Unexpected PCS signature: ${JSON.stringify(header.pcs)}`);
  }

  if (header.versionMajor < 2 || header.versionMajor > 4) {
    issues.push(`Unsupported ICC major version: ${header.versionMajor}`);
  }

  if (header.renderingIntent < 0 || header.renderingIntent > 3) {
    issues.push(`Invalid rendering intent: ${header.renderingIntent}`);
  }

  if (header.tagCount < 0 || 132 + header.tagCount * 12 > actualSize) {
    issues.push(`Tag table exceeds profile size: tagCount=${header.tagCount}`);
  }

  if (header.createdAt.month < 1 || header.createdAt.month > 12) {
    issues.push(`Invalid creation month: ${header.createdAt.month}`);
  }

  if (header.createdAt.day < 1 || header.createdAt.day > 31) {
    issues.push(`Invalid creation day: ${header.createdAt.day}`);
  }

  return issues;
}
