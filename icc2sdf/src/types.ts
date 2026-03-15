export interface LabVolumeBounds {
  lMin: number;
  lMax: number;
  aMin: number;
  aMax: number;
  bMin: number;
  bMax: number;
}

export interface LabVolumeDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface LabVolumeSpacing {
  lStep: number;
  aStep: number;
  bStep: number;
}

export interface OccupancyGridMetadata {
  dimensions: LabVolumeDimensions;
  bounds: LabVolumeBounds;
  spacing: LabVolumeSpacing;
  sampleResolution: number;
  intent: number;
}

export interface OccupancyGrid {
  metadata: OccupancyGridMetadata;
  data: Uint8Array;
}

export interface ScalarVolumeDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface ScalarVolumeSpacing {
  xStep: number;
  yStep: number;
  zStep: number;
}

export interface ScalarVolumeOrigin {
  x: number;
  y: number;
  z: number;
}

export interface ScalarVolumeMetadata {
  dimensions: ScalarVolumeDimensions;
  spacing: ScalarVolumeSpacing;
  origin: ScalarVolumeOrigin;
  metadata?: Record<string, string>;
}

export interface ScalarVolume<TData extends ArrayBufferView = ArrayBufferView> {
  metadata: ScalarVolumeMetadata;
  data: TData;
}

export interface SdfGaussianBlurConfig {
  radiusVoxels: 1;
  sigma: number;
}

export interface IccSdfBuildConfig {
  dimensions: LabVolumeDimensions;
  bounds: LabVolumeBounds;
  blur?: SdfGaussianBlurConfig;
}

export interface OccupancyToSdfConfig {
  distanceUnit?: "voxels" | "lab";
  insideNegative?: boolean;
}

export interface IccOccupancyBuildConfig {
  dimensions?: LabVolumeDimensions;
  bounds?: LabVolumeBounds;
  sampleResolution?: number;
  intent?: number;
}

export interface SdfVolumeMetadata extends Omit<ScalarVolumeMetadata, "origin" | "spacing"> {
  bounds: LabVolumeBounds;
  spacing: LabVolumeSpacing;
}

export interface SdfVolume<TData extends ArrayBufferView = ArrayBufferView> {
  metadata: SdfVolumeMetadata;
  data: TData;
}

export interface NrrdSerializeOptions {
  endian?: "little" | "big";
  extraMetadata?: Record<string, string>;
}

export interface NrrdVolume<TData extends Float32Array = Float32Array>
  extends ScalarVolume<TData> {}

export interface ParsedNrrdHeader {
  dimension: number;
  type: string;
  sizes: number[];
  encoding: string;
  endian?: "little" | "big";
  spaceDirections?: Array<[number, number, number]>;
  spaceOrigin?: [number, number, number];
  metadata: Record<string, string>;
}

export interface GpuRuntime {
  gpu: GPU;
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter>;
  requestDevice(
    adapterOptions?: GPURequestAdapterOptions,
    descriptor?: GPUDeviceDescriptor,
  ): Promise<GPUDevice>;
}

export interface DawnNodeModule {
  create(flags?: string[]): GPU;
  globals?: Record<string, unknown>;
}
