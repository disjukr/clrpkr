import { CMS_D50_XYZ, cmsXYZ2Lab } from "lcms-ts";
import {
  INTENT_PERCEPTUAL,
  cmsGetPCS,
  cmsOpenProfileFromMem,
  cmsPipelineEvalFloat,
  cmsReadInputLUT,
} from "lcms-ts";

import type {
  IccOccupancyBuildConfig,
  LabVolumeBounds,
  LabVolumeDimensions,
  LabVolumeSpacing,
  OccupancyGrid,
  ScalarVolume,
} from "./types.js";

type Vec3 = readonly [number, number, number];

const DEFAULT_DIMENSIONS: Readonly<LabVolumeDimensions> = {
  width: 256,
  height: 256,
  depth: 256,
};

const DEFAULT_BOUNDS: Readonly<LabVolumeBounds> = {
  lMin: 0,
  lMax: 100,
  aMin: -128,
  aMax: 127,
  bMin: -128,
  bMax: 127,
};

const DEFAULT_SAMPLE_RESOLUTION = 96;

function computeSpacing(
  dimensions: LabVolumeDimensions,
  bounds: LabVolumeBounds,
): LabVolumeSpacing {
  return {
    lStep: (bounds.lMax - bounds.lMin) / Math.max(1, dimensions.width - 1),
    aStep: (bounds.aMax - bounds.aMin) / Math.max(1, dimensions.height - 1),
    bStep: (bounds.bMax - bounds.bMin) / Math.max(1, dimensions.depth - 1),
  };
}

function voxelIndex(
  dimensions: LabVolumeDimensions,
  x: number,
  y: number,
  z: number,
): number {
  return x + dimensions.width * (y + dimensions.height * z);
}

function clampIndex(value: number, maxInclusive: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= maxInclusive) {
    return maxInclusive;
  }
  return value;
}

function toGridCoordinate(
  value: number,
  min: number,
  max: number,
  size: number,
): number | null {
  if (!(max > min) || size <= 0) {
    return null;
  }

  const normalized = (value - min) / (max - min);
  if (normalized < 0 || normalized > 1) {
    return null;
  }

  return normalized * Math.max(0, size - 1);
}

function sampleCoordinate(index: number, resolution: number): number {
  if (resolution <= 1) {
    return 0;
  }

  return index / (resolution - 1);
}

function evaluatePipelineToLab(
  pcs: string,
  sample: readonly [number, number, number],
  evaluate: (input: readonly number[]) => number[],
): readonly [number, number, number] | null {
  const output = evaluate(sample);
  if (output.length < 3) {
    return null;
  }

  if (pcs === "Lab ") {
    return [output[0] ?? 0, output[1] ?? 0, output[2] ?? 0];
  }

  if (pcs === "XYZ ") {
    const lab = cmsXYZ2Lab(CMS_D50_XYZ, {
      X: output[0] ?? 0,
      Y: output[1] ?? 0,
      Z: output[2] ?? 0,
    });
    return [lab.L, lab.a, lab.b];
  }

  return null;
}

function latticeIndex(resolution: number, r: number, g: number, b: number): number {
  return r + resolution * (g + resolution * b);
}

function setVec3(buffer: Float32Array, index: number, value: Vec3): void {
  const base = index * 3;
  buffer[base] = value[0];
  buffer[base + 1] = value[1];
  buffer[base + 2] = value[2];
}

function getVec3(buffer: Float32Array, index: number): Vec3 {
  const base = index * 3;
  return [buffer[base] ?? 0, buffer[base + 1] ?? 0, buffer[base + 2] ?? 0];
}

function subtractVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dotVec3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function determinant3(a: Vec3, b: Vec3, c: Vec3): number {
  return dotVec3(a, crossVec3(b, c));
}

function pointInTetrahedron(
  point: Vec3,
  tetra: readonly [Vec3, Vec3, Vec3, Vec3],
): boolean {
  const [p0, p1, p2, p3] = tetra;
  const v0 = subtractVec3(p1, p0);
  const v1 = subtractVec3(p2, p0);
  const v2 = subtractVec3(p3, p0);
  const rhs = subtractVec3(point, p0);
  const det = determinant3(v0, v1, v2);
  const epsilon = 1e-6;

  if (Math.abs(det) <= epsilon) {
    return false;
  }

  const w1 = determinant3(rhs, v1, v2) / det;
  const w2 = determinant3(v0, rhs, v2) / det;
  const w3 = determinant3(v0, v1, rhs) / det;
  const w0 = 1 - w1 - w2 - w3;

  return (
    w0 >= -epsilon &&
    w1 >= -epsilon &&
    w2 >= -epsilon &&
    w3 >= -epsilon &&
    w0 <= 1 + epsilon &&
    w1 <= 1 + epsilon &&
    w2 <= 1 + epsilon &&
    w3 <= 1 + epsilon
  );
}

function markTetrahedronOccupancy(
  occupancy: Uint8Array,
  dimensions: LabVolumeDimensions,
  tetra: readonly [Vec3, Vec3, Vec3, Vec3],
): void {
  const xs = tetra.map((vertex) => vertex[0]);
  const ys = tetra.map((vertex) => vertex[1]);
  const zs = tetra.map((vertex) => vertex[2]);
  const minX = clampIndex(Math.floor(Math.min(...xs)), dimensions.width - 1);
  const maxX = clampIndex(Math.ceil(Math.max(...xs)), dimensions.width - 1);
  const minY = clampIndex(Math.floor(Math.min(...ys)), dimensions.height - 1);
  const maxY = clampIndex(Math.ceil(Math.max(...ys)), dimensions.height - 1);
  const minZ = clampIndex(Math.floor(Math.min(...zs)), dimensions.depth - 1);
  const maxZ = clampIndex(Math.ceil(Math.max(...zs)), dimensions.depth - 1);

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (pointInTetrahedron([x, y, z], tetra)) {
          occupancy[voxelIndex(dimensions, x, y, z)] = 1;
        }
      }
    }
  }
}

function buildLabLattice(
  resolution: number,
  pcs: string,
  evaluate: (input: readonly number[]) => number[],
  bounds: LabVolumeBounds,
  dimensions: LabVolumeDimensions,
): { positions: Float32Array; valid: Uint8Array } {
  const positions = new Float32Array(resolution * resolution * resolution * 3);
  const valid = new Uint8Array(resolution * resolution * resolution);

  for (let r = 0; r < resolution; r += 1) {
    const rf = sampleCoordinate(r, resolution);
    for (let g = 0; g < resolution; g += 1) {
      const gf = sampleCoordinate(g, resolution);
      for (let b = 0; b < resolution; b += 1) {
        const bf = sampleCoordinate(b, resolution);
        const lab = evaluatePipelineToLab(pcs, [rf, gf, bf], evaluate);

        if (lab == null) {
          continue;
        }

        const x = toGridCoordinate(lab[0], bounds.lMin, bounds.lMax, dimensions.width);
        const y = toGridCoordinate(lab[1], bounds.aMin, bounds.aMax, dimensions.height);
        const z = toGridCoordinate(lab[2], bounds.bMin, bounds.bMax, dimensions.depth);

        if (x == null || y == null || z == null) {
          continue;
        }

        const index = latticeIndex(resolution, r, g, b);
        setVec3(positions, index, [x, y, z]);
        valid[index] = 1;
      }
    }
  }

  return { positions, valid };
}

function voxelizeLabLatticeCells(
  occupancy: Uint8Array,
  dimensions: LabVolumeDimensions,
  lattice: { positions: Float32Array; valid: Uint8Array },
  resolution: number,
): void {
  const tetrahedraCornerIndices = [
    [0, 1, 3, 7],
    [0, 1, 5, 7],
    [0, 4, 5, 7],
    [0, 4, 6, 7],
    [0, 2, 6, 7],
    [0, 2, 3, 7],
  ] as const;

  for (let r = 0; r < resolution - 1; r += 1) {
    for (let g = 0; g < resolution - 1; g += 1) {
      for (let b = 0; b < resolution - 1; b += 1) {
        const corners = [
          latticeIndex(resolution, r, g, b),
          latticeIndex(resolution, r + 1, g, b),
          latticeIndex(resolution, r, g + 1, b),
          latticeIndex(resolution, r + 1, g + 1, b),
          latticeIndex(resolution, r, g, b + 1),
          latticeIndex(resolution, r + 1, g, b + 1),
          latticeIndex(resolution, r, g + 1, b + 1),
          latticeIndex(resolution, r + 1, g + 1, b + 1),
        ] as const;

        if (corners.some((index) => lattice.valid[index] !== 1)) {
          continue;
        }

        for (const tetraCornerIndices of tetrahedraCornerIndices) {
          const tetra: [Vec3, Vec3, Vec3, Vec3] = [
            getVec3(lattice.positions, corners[tetraCornerIndices[0]]!),
            getVec3(lattice.positions, corners[tetraCornerIndices[1]]!),
            getVec3(lattice.positions, corners[tetraCornerIndices[2]]!),
            getVec3(lattice.positions, corners[tetraCornerIndices[3]]!),
          ];
          markTetrahedronOccupancy(occupancy, dimensions, tetra);
        }
      }
    }
  }
}

export function buildLabOccupancyGridFromIcc(
  iccBytes: Uint8Array,
  config: IccOccupancyBuildConfig = {},
): OccupancyGrid {
  const dimensions = config.dimensions ?? DEFAULT_DIMENSIONS;
  const bounds = config.bounds ?? DEFAULT_BOUNDS;
  const sampleResolution = config.sampleResolution ?? DEFAULT_SAMPLE_RESOLUTION;
  const intent = config.intent ?? INTENT_PERCEPTUAL;
  const profile = cmsOpenProfileFromMem(iccBytes);
  const pipeline = cmsReadInputLUT(profile, intent);

  if (pipeline == null) {
    throw new Error("The ICC profile does not expose a readable device-to-PCS pipeline");
  }

  if (pipeline.inputChannels !== 3) {
    throw new Error(
      `Only 3-channel input profiles are supported right now, got ${pipeline.inputChannels}`,
    );
  }

  const pcs = cmsGetPCS(profile);
  if (pcs !== "Lab " && pcs !== "XYZ ") {
    throw new Error(`Only Lab and XYZ PCS profiles are supported right now, got ${pcs}`);
  }

  if (!Number.isInteger(sampleResolution) || sampleResolution < 2) {
    throw new RangeError("sampleResolution must be an integer greater than or equal to 2");
  }

  const occupancy = new Uint8Array(
    dimensions.width * dimensions.height * dimensions.depth,
  );
  const spacing = computeSpacing(dimensions, bounds);
  const evaluate = (input: readonly number[]) => cmsPipelineEvalFloat(input, pipeline);
  const lattice = buildLabLattice(
    sampleResolution,
    pcs,
    evaluate,
    bounds,
    dimensions,
  );
  voxelizeLabLatticeCells(occupancy, dimensions, lattice, sampleResolution);

  return {
    metadata: {
      dimensions,
      bounds,
      spacing,
      sampleResolution,
      intent,
    },
    data: occupancy,
  };
}

export function occupancyGridToScalarVolume(
  occupancy: OccupancyGrid,
): ScalarVolume<Float32Array> {
  const output = new Float32Array(occupancy.data.length);
  for (let index = 0; index < occupancy.data.length; index += 1) {
    output[index] = occupancy.data[index] ?? 0;
  }

  return {
    metadata: {
      dimensions: occupancy.metadata.dimensions,
      spacing: {
        xStep: occupancy.metadata.spacing.lStep,
        yStep: occupancy.metadata.spacing.aStep,
        zStep: occupancy.metadata.spacing.bStep,
      },
      origin: {
        x: occupancy.metadata.bounds.lMin,
        y: occupancy.metadata.bounds.aMin,
        z: occupancy.metadata.bounds.bMin,
      },
    },
    data: output,
  };
}
