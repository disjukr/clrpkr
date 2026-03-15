import type {
  OccupancyGrid,
  OccupancyToSdfConfig,
  SdfVolume,
} from "./types.js";

const INF = 1e20;

function voxelCount(grid: OccupancyGrid): number {
  const { width, height, depth } = grid.metadata.dimensions;
  return width * height * depth;
}

function gridIndex(
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
): number {
  return x + width * (y + height * z);
}

function transformLineSquaredDistance(
  input: Float32Array,
  output: Float32Array,
  step: number,
): void {
  const length = input.length;
  const v = new Int32Array(length);
  const z = new Float32Array(length + 1);
  const step2 = step * step;
  let k = 0;

  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;

  for (let q = 1; q < length; q += 1) {
    let intersection = 0;

    while (true) {
      const vk = v[k]!;
      const fq = input[q];
      const fvk = input[vk];
      if (fq == null || fvk == null) {
        throw new Error("Distance transform line access failed");
      }

      intersection =
        ((fq + step2 * q * q) - (fvk + step2 * vk * vk)) /
        (2 * step2 * (q - vk));

      if (intersection > z[k]!) {
        break;
      }

      k -= 1;
      if (k < 0) {
        k = 0;
        break;
      }
    }

    k += 1;
    v[k] = q;
    z[k] = intersection;
    z[k + 1] = INF;
  }

  k = 0;
  for (let q = 0; q < length; q += 1) {
    while (z[k + 1]! < q) {
      k += 1;
    }

    const vk = v[k]!;
    const delta = q - vk;
    const fvk = input[vk];
    if (fvk == null) {
      throw new Error("Distance transform line access failed");
    }

    output[q] = step2 * delta * delta + fvk;
  }
}

function runAxisPass(
  source: Float32Array,
  target: Float32Array,
  width: number,
  height: number,
  depth: number,
  axis: "x" | "y" | "z",
  step: number,
): void {
  const lineLength = axis === "x" ? width : axis === "y" ? height : depth;
  const line = new Float32Array(lineLength);
  const transformed = new Float32Array(lineLength);

  if (axis === "x") {
    for (let z = 0; z < depth; z += 1) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          line[x] = source[gridIndex(width, height, x, y, z)] ?? INF;
        }
        transformLineSquaredDistance(line, transformed, step);
        for (let x = 0; x < width; x += 1) {
          target[gridIndex(width, height, x, y, z)] = transformed[x] ?? INF;
        }
      }
    }
    return;
  }

  if (axis === "y") {
    for (let z = 0; z < depth; z += 1) {
      for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) {
          line[y] = source[gridIndex(width, height, x, y, z)] ?? INF;
        }
        transformLineSquaredDistance(line, transformed, step);
        for (let y = 0; y < height; y += 1) {
          target[gridIndex(width, height, x, y, z)] = transformed[y] ?? INF;
        }
      }
    }
    return;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        line[z] = source[gridIndex(width, height, x, y, z)] ?? INF;
      }
      transformLineSquaredDistance(line, transformed, step);
      for (let z = 0; z < depth; z += 1) {
        target[gridIndex(width, height, x, y, z)] = transformed[z] ?? INF;
      }
    }
  }
}

function computeSquaredDistanceField(
  occupancy: Uint8Array,
  width: number,
  height: number,
  depth: number,
  featureValue: 0 | 1,
  xStep: number,
  yStep: number,
  zStep: number,
): Float32Array {
  const total = occupancy.length;
  const seed = new Float32Array(total);
  const passX = new Float32Array(total);
  const passY = new Float32Array(total);
  const passZ = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    seed[index] = occupancy[index] === featureValue ? 0 : INF;
  }

  runAxisPass(seed, passX, width, height, depth, "x", xStep);
  runAxisPass(passX, passY, width, height, depth, "y", yStep);
  runAxisPass(passY, passZ, width, height, depth, "z", zStep);
  return passZ;
}

export function occupancyGridToSdfVolume(
  occupancy: OccupancyGrid,
  config: OccupancyToSdfConfig = {},
): SdfVolume<Float32Array> {
  const {
    dimensions: { width, height, depth },
    bounds,
    spacing,
  } = occupancy.metadata;
  const distanceUnit = config.distanceUnit ?? "lab";
  const insideNegative = config.insideNegative ?? true;
  const xStep = distanceUnit === "lab" ? spacing.lStep : 1;
  const yStep = distanceUnit === "lab" ? spacing.aStep : 1;
  const zStep = distanceUnit === "lab" ? spacing.bStep : 1;

  if (occupancy.data.length !== voxelCount(occupancy)) {
    throw new Error("Occupancy grid data length does not match its dimensions");
  }

  const distanceToFilledSquared = computeSquaredDistanceField(
    occupancy.data,
    width,
    height,
    depth,
    1,
    xStep,
    yStep,
    zStep,
  );
  const distanceToEmptySquared = computeSquaredDistanceField(
    occupancy.data,
    width,
    height,
    depth,
    0,
    xStep,
    yStep,
    zStep,
  );
  const data = new Float32Array(occupancy.data.length);

  for (let index = 0; index < data.length; index += 1) {
    const outsideDistance = Math.sqrt(distanceToFilledSquared[index] ?? 0);
    const insideDistance = Math.sqrt(distanceToEmptySquared[index] ?? 0);
    const signedDistance = outsideDistance - insideDistance;
    data[index] = insideNegative ? signedDistance : -signedDistance;
  }

  return {
    metadata: {
      dimensions: occupancy.metadata.dimensions,
      bounds,
      spacing,
    },
    data,
  };
}
