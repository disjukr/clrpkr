export type CmsBool = boolean;
export type CmsSignature = number;
export type CmsUInt8Number = number;
export type CmsInt8Number = number;
export type CmsUInt16Number = number;
export type CmsInt16Number = number;
export type CmsUInt32Number = number;
export type CmsInt32Number = number;
export type CmsUInt64Number = bigint;
export type CmsInt64Number = bigint;
export type CmsFloat32Number = number;
export type CmsFloat64Number = number;

export interface CmsHandle<TKind extends string = string> {
  readonly id: string;
  readonly kind: TKind;
}
