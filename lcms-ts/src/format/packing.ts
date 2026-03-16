import type { CmsProfile } from "../profile/profile.js";

export const FLOAT_SH = (value: number): number => value << 22;
export const OPTIMIZED_SH = (value: number): number => value << 21;
export const COLORSPACE_SH = (value: number): number => value << 16;
export const SWAPFIRST_SH = (value: number): number => value << 14;
export const FLAVOR_SH = (value: number): number => value << 13;
export const PLANAR_SH = (value: number): number => value << 12;
export const ENDIAN16_SH = (value: number): number => value << 11;
export const DOSWAP_SH = (value: number): number => value << 10;
export const EXTRA_SH = (value: number): number => value << 7;
export const CHANNELS_SH = (value: number): number => value << 3;
export const BYTES_SH = (value: number): number => value;
export const PREMUL_SH = (value: number): number => value << 23;

export const T_FLOAT = (format: number): number => (format >> 22) & 1;
export const T_OPTIMIZED = (format: number): number => (format >> 21) & 1;
export const T_COLORSPACE = (format: number): number => (format >> 16) & 31;
export const T_SWAPFIRST = (format: number): number => (format >> 14) & 1;
export const T_FLAVOR = (format: number): number => (format >> 13) & 1;
export const T_PLANAR = (format: number): number => (format >> 12) & 1;
export const T_ENDIAN16 = (format: number): number => (format >> 11) & 1;
export const T_DOSWAP = (format: number): number => (format >> 10) & 1;
export const T_EXTRA = (format: number): number => (format >> 7) & 7;
export const T_CHANNELS = (format: number): number => (format >> 3) & 15;
export const T_BYTES = (format: number): number => format & 7;
export const T_PREMUL = (format: number): number => (format >> 23) & 1;

export const PT_ANY = 0;
export const PT_GRAY = 3;
export const PT_RGB = 4;
export const PT_CMY = 5;
export const PT_CMYK = 6;
export const PT_XYZ = 9;
export const PT_Lab = 10;
export const PT_Yxy = 14;
export const PT_LabV2 = 30;

export const TYPE_GRAY_8 = COLORSPACE_SH(PT_GRAY) | CHANNELS_SH(1) | BYTES_SH(1);
export const TYPE_GRAY_16 = COLORSPACE_SH(PT_GRAY) | CHANNELS_SH(1) | BYTES_SH(2);
export const TYPE_RGB_8 = COLORSPACE_SH(PT_RGB) | CHANNELS_SH(3) | BYTES_SH(1);
export const TYPE_BGR_8 = COLORSPACE_SH(PT_RGB) | CHANNELS_SH(3) | BYTES_SH(1) | DOSWAP_SH(1);
export const TYPE_RGB_16 = COLORSPACE_SH(PT_RGB) | CHANNELS_SH(3) | BYTES_SH(2);
export const TYPE_BGR_16 = COLORSPACE_SH(PT_RGB) | CHANNELS_SH(3) | BYTES_SH(2) | DOSWAP_SH(1);
export const TYPE_RGBA_8 = COLORSPACE_SH(PT_RGB) | EXTRA_SH(1) | CHANNELS_SH(3) | BYTES_SH(1);
export const TYPE_ARGB_8 = COLORSPACE_SH(PT_RGB) | EXTRA_SH(1) | CHANNELS_SH(3) | BYTES_SH(1) | SWAPFIRST_SH(1);
export const TYPE_CMYK_8 = COLORSPACE_SH(PT_CMYK) | CHANNELS_SH(4) | BYTES_SH(1);
export const TYPE_CMYK_16 = COLORSPACE_SH(PT_CMYK) | CHANNELS_SH(4) | BYTES_SH(2);
export const TYPE_KCMY_8 = COLORSPACE_SH(PT_CMYK) | CHANNELS_SH(4) | BYTES_SH(1) | SWAPFIRST_SH(1);
export const TYPE_XYZ_16 = COLORSPACE_SH(PT_XYZ) | CHANNELS_SH(3) | BYTES_SH(2);
export const TYPE_Lab_16 = COLORSPACE_SH(PT_Lab) | CHANNELS_SH(3) | BYTES_SH(2);
export const TYPE_LabV2_16 = COLORSPACE_SH(PT_LabV2) | CHANNELS_SH(3) | BYTES_SH(2);
export const TYPE_Yxy_16 = COLORSPACE_SH(PT_Yxy) | CHANNELS_SH(3) | BYTES_SH(2);
export const TYPE_XYZ_FLT = FLOAT_SH(1) | COLORSPACE_SH(PT_XYZ) | CHANNELS_SH(3) | BYTES_SH(4);
export const TYPE_Lab_FLT = FLOAT_SH(1) | COLORSPACE_SH(PT_Lab) | CHANNELS_SH(3) | BYTES_SH(4);
export const TYPE_GRAY_FLT = FLOAT_SH(1) | COLORSPACE_SH(PT_GRAY) | CHANNELS_SH(1) | BYTES_SH(4);
export const TYPE_RGB_FLT = FLOAT_SH(1) | COLORSPACE_SH(PT_RGB) | CHANNELS_SH(3) | BYTES_SH(4);
export const TYPE_BGR_FLT = FLOAT_SH(1) | COLORSPACE_SH(PT_RGB) | CHANNELS_SH(3) | BYTES_SH(4) | DOSWAP_SH(1);
export const TYPE_CMYK_FLT = FLOAT_SH(1) | COLORSPACE_SH(PT_CMYK) | CHANNELS_SH(4) | BYTES_SH(4);
export const TYPE_XYZ_DBL = FLOAT_SH(1) | COLORSPACE_SH(PT_XYZ) | CHANNELS_SH(3) | BYTES_SH(0);
export const TYPE_Lab_DBL = FLOAT_SH(1) | COLORSPACE_SH(PT_Lab) | CHANNELS_SH(3) | BYTES_SH(0);
export const TYPE_GRAY_DBL = FLOAT_SH(1) | COLORSPACE_SH(PT_GRAY) | CHANNELS_SH(1) | BYTES_SH(0);
export const TYPE_RGB_DBL = FLOAT_SH(1) | COLORSPACE_SH(PT_RGB) | CHANNELS_SH(3) | BYTES_SH(0);
export const TYPE_CMYK_DBL = FLOAT_SH(1) | COLORSPACE_SH(PT_CMYK) | CHANNELS_SH(4) | BYTES_SH(0);

const SIGNATURE_TO_SPACE: Record<string, { readonly pt: number; readonly channels: number }> = {
  GRAY: { pt: PT_GRAY, channels: 1 },
  "RGB ": { pt: PT_RGB, channels: 3 },
  "CMY ": { pt: PT_CMY, channels: 3 },
  CMYK: { pt: PT_CMYK, channels: 4 },
  "XYZ ": { pt: PT_XYZ, channels: 3 },
  "Lab ": { pt: PT_Lab, channels: 3 },
  "2CLR": { pt: 15, channels: 2 },
  "3CLR": { pt: 16, channels: 3 },
  "4CLR": { pt: 17, channels: 4 },
  "5CLR": { pt: 18, channels: 5 },
  "6CLR": { pt: 19, channels: 6 },
  "7CLR": { pt: 20, channels: 7 },
  "8CLR": { pt: 21, channels: 8 },
  "9CLR": { pt: 22, channels: 9 },
  ACLR: { pt: 23, channels: 10 },
  BCLR: { pt: 24, channels: 11 },
  CCLR: { pt: 25, channels: 12 },
  "Yxy ": { pt: PT_Yxy, channels: 3 },
};

function getSpaceInfo(signature: string): { readonly pt: number; readonly channels: number } | undefined {
  return SIGNATURE_TO_SPACE[signature];
}

export function _cmsLCMScolorSpace(signature: string): number {
  return getSpaceInfo(signature)?.pt ?? PT_ANY;
}

export function cmsChannelsOfColorSpace(signature: string): number {
  return getSpaceInfo(signature)?.channels ?? -1;
}

export function _cmsFormatterIsFloat(type: number): boolean {
  return T_FLOAT(type) !== 0;
}

export function _cmsFormatterIs8bit(type: number): boolean {
  return T_BYTES(type) === 1;
}

export function cmsFormatterPixelSize(type: number): number {
  const bytes = T_BYTES(type);
  return bytes === 0 ? 8 : bytes;
}

export function cmsFormatterForColorspaceOfProfile(profile: CmsProfile, nBytes: number, lIsFloat: boolean): number {
  const colorSpace = profile.header.colorSpace;
  const colorSpaceBits = _cmsLCMScolorSpace(colorSpace);
  const channels = cmsChannelsOfColorSpace(colorSpace);
  if (channels < 0) {
    return 0;
  }

  return FLOAT_SH(lIsFloat ? 1 : 0) | COLORSPACE_SH(colorSpaceBits) | BYTES_SH(nBytes & 7) | CHANNELS_SH(channels);
}

export function cmsFormatterForPCSOfProfile(profile: CmsProfile, nBytes: number, lIsFloat: boolean): number {
  const pcs = profile.header.pcs;
  const colorSpaceBits = _cmsLCMScolorSpace(pcs);
  const channels = cmsChannelsOfColorSpace(pcs);
  if (channels < 0) {
    return 0;
  }

  return FLOAT_SH(lIsFloat ? 1 : 0) | COLORSPACE_SH(colorSpaceBits) | BYTES_SH(nBytes & 7) | CHANNELS_SH(channels);
}

function getChunkyChannelOrder(format: number): number[] {
  const channels = T_CHANNELS(format);
  const doSwap = T_DOSWAP(format) !== 0;
  const swapFirst = T_SWAPFIRST(format) !== 0;
  const extra = T_EXTRA(format);
  const values = Array.from({ length: channels }, (_, index) => (doSwap ? channels - index - 1 : index));
  if (swapFirst && extra === 0 && values.length > 0) {
    const first = values[0] ?? 0;
    const rest = values.slice(1);
    return [...rest, first];
  }
  return values;
}

function toWord(value: number): number {
  const clamped = Math.max(0, Math.min(65535, Math.round(value)));
  return clamped;
}

function fromByteToWord(value: number): number {
  return ((value & 0xff) << 8) | (value & 0xff);
}

function fromWordToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value / 257)));
}

export function unpackChunky8To16(format: number, input: Uint8Array): Uint16Array {
  const channels = T_CHANNELS(format);
  const extra = T_EXTRA(format);
  const doReverse = T_FLAVOR(format) !== 0;
  const order = getChunkyChannelOrder(format);
  const offset = T_SWAPFIRST(format) !== 0 && extra > 0 ? extra : 0;
  const words = new Uint16Array(channels);

  for (let i = 0; i < channels; i += 1) {
    const source = input[offset + i] ?? 0;
    const index = order[i] ?? i;
    const value = fromByteToWord(source);
    words[index] = doReverse ? 65535 - value : value;
  }

  return words;
}

export function packChunky16To8(format: number, values: ArrayLike<number>): Uint8Array {
  const channels = T_CHANNELS(format);
  const extra = T_EXTRA(format);
  const doReverse = T_FLAVOR(format) !== 0;
  const order = getChunkyChannelOrder(format);
  const output = new Uint8Array(channels + extra);
  const offset = T_SWAPFIRST(format) !== 0 && extra > 0 ? extra : 0;

  for (let i = 0; i < channels; i += 1) {
    const index = order[i] ?? i;
    const raw = toWord(Number(values[index] ?? 0));
    const value = doReverse ? 65535 - raw : raw;
    output[offset + i] = fromWordToByte(value);
  }

  return output;
}

export function unpackChunkyFloat32(format: number, input: Float32Array): Float32Array {
  const channels = T_CHANNELS(format);
  const extra = T_EXTRA(format);
  const doReverse = T_FLAVOR(format) !== 0;
  const order = getChunkyChannelOrder(format);
  const offset = T_SWAPFIRST(format) !== 0 && extra > 0 ? extra : 0;
  const output = new Float32Array(channels);

  for (let i = 0; i < channels; i += 1) {
    const index = order[i] ?? i;
    const value = input[offset + i] ?? 0;
    output[index] = doReverse ? 1 - value : value;
  }

  return output;
}

export function packChunkyFloat32(format: number, values: ArrayLike<number>): Float32Array {
  const channels = T_CHANNELS(format);
  const extra = T_EXTRA(format);
  const doReverse = T_FLAVOR(format) !== 0;
  const order = getChunkyChannelOrder(format);
  const output = new Float32Array(channels + extra);
  const offset = T_SWAPFIRST(format) !== 0 && extra > 0 ? extra : 0;

  for (let i = 0; i < channels; i += 1) {
    const index = order[i] ?? i;
    const value = Number(values[index] ?? 0);
    output[offset + i] = doReverse ? 1 - value : value;
  }

  return output;
}
