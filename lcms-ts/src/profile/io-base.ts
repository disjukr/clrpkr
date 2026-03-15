export interface CmsIccDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

export interface CmsIccIoWriter {
  readonly buffer: Uint8Array;
  writeSignature(offset: number, value: string): void;
  writeDateTime(offset: number, value: CmsIccDateTime): void;
  writeU16(offset: number, value: number): void;
  writeU32(offset: number, value: number): void;
  writeU64(offset: number, value: bigint): void;
  writeS15Fixed16(offset: number, value: number): void;
  writeBytes(offset: number, value: Uint8Array): void;
}

export function createIccDataView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

export function assertIccRange(data: Uint8Array, offset: number, length: number, label: string): void {
  if (offset < 0 || length < 0 || offset + length > data.byteLength) {
    throw new Error(`${label} is outside ICC payload: offset=${offset}, length=${length}, size=${data.byteLength}`);
  }
}

export function readSignature(data: Uint8Array, offset: number): string {
  assertIccRange(data, offset, 4, "Signature");
  return String.fromCharCode(
    data[offset]!,
    data[offset + 1]!,
    data[offset + 2]!,
    data[offset + 3]!,
  );
}

export function writeSignature(data: Uint8Array, offset: number, value: string): void {
  if (value.length !== 4) {
    throw new Error(`ICC signature must be exactly 4 characters, got ${JSON.stringify(value)}`);
  }

  assertIccRange(data, offset, 4, "Signature");
  for (let index = 0; index < 4; index += 1) {
    data[offset + index] = value.charCodeAt(index) & 0xff;
  }
}

export function readU16(data: Uint8Array, offset: number): number {
  assertIccRange(data, offset, 2, "U16");
  return createIccDataView(data).getUint16(offset, false);
}

export function readU32(data: Uint8Array, offset: number): number {
  assertIccRange(data, offset, 4, "U32");
  return createIccDataView(data).getUint32(offset, false);
}

export function readU64(data: Uint8Array, offset: number): bigint {
  assertIccRange(data, offset, 8, "U64");
  return createIccDataView(data).getBigUint64(offset, false);
}

export function readS15Fixed16(data: Uint8Array, offset: number): number {
  assertIccRange(data, offset, 4, "S15Fixed16");
  return createIccDataView(data).getInt32(offset, false) / 65536;
}

export function readDateTime(data: Uint8Array, offset: number): CmsIccDateTime {
  return {
    year: readU16(data, offset),
    month: readU16(data, offset + 2),
    day: readU16(data, offset + 4),
    hours: readU16(data, offset + 6),
    minutes: readU16(data, offset + 8),
    seconds: readU16(data, offset + 10),
  };
}

export function writeU16(data: Uint8Array, offset: number, value: number): void {
  assertIccRange(data, offset, 2, "U16");
  createIccDataView(data).setUint16(offset, value, false);
}

export function writeU32(data: Uint8Array, offset: number, value: number): void {
  assertIccRange(data, offset, 4, "U32");
  createIccDataView(data).setUint32(offset, value, false);
}

export function writeU64(data: Uint8Array, offset: number, value: bigint): void {
  assertIccRange(data, offset, 8, "U64");
  createIccDataView(data).setBigUint64(offset, value, false);
}

export function writeS15Fixed16(data: Uint8Array, offset: number, value: number): void {
  assertIccRange(data, offset, 4, "S15Fixed16");
  createIccDataView(data).setInt32(offset, Math.round(value * 65536), false);
}

export function writeDateTime(data: Uint8Array, offset: number, value: CmsIccDateTime): void {
  writeU16(data, offset, value.year);
  writeU16(data, offset + 2, value.month);
  writeU16(data, offset + 4, value.day);
  writeU16(data, offset + 6, value.hours);
  writeU16(data, offset + 8, value.minutes);
  writeU16(data, offset + 10, value.seconds);
}

export function readProfileId(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function writeProfileId(data: Uint8Array, offset: number, profileIdHex: string): void {
  if (!/^[0-9a-fA-F]{32}$/u.test(profileIdHex)) {
    throw new Error(`Profile ID must be 32 hex characters, got ${JSON.stringify(profileIdHex)}`);
  }

  assertIccRange(data, offset, 16, "Profile ID");
  for (let index = 0; index < 16; index += 1) {
    data[offset + index] = Number.parseInt(profileIdHex.slice(index * 2, index * 2 + 2), 16);
  }
}

export function sliceIccRange(data: Uint8Array, offset: number, length: number, label: string): Uint8Array {
  assertIccRange(data, offset, length, label);
  return data.slice(offset, offset + length);
}

export function createIccWriter(size: number): CmsIccIoWriter {
  const buffer = new Uint8Array(size);

  return {
    buffer,
    writeSignature(offset, value) {
      writeSignature(buffer, offset, value);
    },
    writeDateTime(offset, value) {
      writeDateTime(buffer, offset, value);
    },
    writeU16(offset, value) {
      writeU16(buffer, offset, value);
    },
    writeU32(offset, value) {
      writeU32(buffer, offset, value);
    },
    writeU64(offset, value) {
      writeU64(buffer, offset, value);
    },
    writeS15Fixed16(offset, value) {
      writeS15Fixed16(buffer, offset, value);
    },
    writeBytes(offset, value) {
      assertIccRange(buffer, offset, value.byteLength, "Byte write");
      buffer.set(value, offset);
    },
  };
}
