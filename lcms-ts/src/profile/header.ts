export interface CmsIccDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

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

function readSignature(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function readDateTime(view: DataView, offset: number): CmsIccDateTime {
  return {
    year: view.getUint16(offset, false),
    month: view.getUint16(offset + 2, false),
    day: view.getUint16(offset + 4, false),
    hours: view.getUint16(offset + 6, false),
    minutes: view.getUint16(offset + 8, false),
    seconds: view.getUint16(offset + 10, false),
  };
}

function readS15Fixed16(view: DataView, offset: number): number {
  return view.getInt32(offset, false) / 65536;
}

function readProfileId(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseIccHeader(data: Uint8Array): CmsIccHeader {
  if (data.byteLength < 132) {
    throw new Error(`ICC data is too short: expected at least 132 bytes, got ${data.byteLength}`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const versionRaw = view.getUint32(8, false);

  return {
    profileSize: view.getUint32(0, false),
    preferredCmmType: readSignature(view, 4),
    versionMajor: (versionRaw >>> 24) & 0xff,
    versionMinor: (versionRaw >>> 20) & 0x0f,
    versionBugfix: (versionRaw >>> 16) & 0x0f,
    deviceClass: readSignature(view, 12),
    colorSpace: readSignature(view, 16),
    pcs: readSignature(view, 20),
    createdAt: readDateTime(view, 24),
    magic: readSignature(view, 36),
    platform: readSignature(view, 40),
    flags: view.getUint32(44, false),
    manufacturer: readSignature(view, 48),
    model: readSignature(view, 52),
    attributes: view.getBigUint64(56, false),
    renderingIntent: view.getUint32(64, false),
    illuminant: {
      X: readS15Fixed16(view, 68),
      Y: readS15Fixed16(view, 72),
      Z: readS15Fixed16(view, 76),
    },
    creator: readSignature(view, 80),
    profileId: readProfileId(data.slice(84, 100)),
    tagCount: view.getUint32(128, false),
  };
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
