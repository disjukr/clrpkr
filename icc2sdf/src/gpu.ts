import type {
  GpuBuildOptions,
  IccOccupancyBuildConfig,
  OccupancyGrid,
  OccupancyToSdfConfig,
  SdfVolume,
} from "./types.js";
import { buildLabLatticesFromIcc } from "./occupancy.js";

const MAX_GPU_LINE_LENGTH = 256;

const OCCUPANCY_SHADER = /* wgsl */ `
struct Params {
  width: u32,
  height: u32,
  depth: u32,
  resolution: u32,
}

@group(0) @binding(0) var<storage, read> params: Params;
@group(0) @binding(1) var<storage, read> lattice: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> occupancy: array<atomic<u32>>;

fn cube_index_to_coord(index: u32, resolution: u32) -> vec3<u32> {
  let cube_resolution = resolution - 1u;
  let rg = cube_resolution * cube_resolution;
  let z = index / rg;
  let rem = index - z * rg;
  let y = rem / cube_resolution;
  let x = rem - y * cube_resolution;
  return vec3<u32>(x, y, z);
}

fn lattice_index(coord: vec3<u32>, resolution: u32) -> u32 {
  return coord.x + resolution * (coord.y + resolution * coord.z);
}

fn voxel_index(coord: vec3<u32>) -> u32 {
  return coord.x + params.width * (coord.y + params.height * coord.z);
}

fn clamp_index(value: i32, max_value: u32) -> u32 {
  if (value <= 0) {
    return 0u;
  }
  let vmax = i32(max_value);
  if (value >= vmax) {
    return max_value;
  }
  return u32(value);
}

fn cross3(a: vec3<f32>, b: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

fn det3(a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> f32 {
  return dot(a, cross3(b, c));
}

fn point_in_tetrahedron(point: vec3<f32>, p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>, p3: vec3<f32>) -> bool {
  let v0 = p1 - p0;
  let v1 = p2 - p0;
  let v2 = p3 - p0;
  let rhs = point - p0;
  let det = det3(v0, v1, v2);
  let eps = 1e-5;
  if (abs(det) <= eps) {
    return false;
  }

  let w1 = det3(rhs, v1, v2) / det;
  let w2 = det3(v0, rhs, v2) / det;
  let w3 = det3(v0, v1, rhs) / det;
  let w0 = 1.0 - w1 - w2 - w3;

  return
    w0 >= -eps && w1 >= -eps && w2 >= -eps && w3 >= -eps &&
    w0 <= 1.0 + eps && w1 <= 1.0 + eps && w2 <= 1.0 + eps && w3 <= 1.0 + eps;
}

fn mark_tetrahedron(p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>, p3: vec3<f32>) {
  let min_x = clamp_index(i32(floor(min(min(p0.x, p1.x), min(p2.x, p3.x)))), params.width - 1u);
  let max_x = clamp_index(i32(ceil(max(max(p0.x, p1.x), max(p2.x, p3.x)))), params.width - 1u);
  let min_y = clamp_index(i32(floor(min(min(p0.y, p1.y), min(p2.y, p3.y)))), params.height - 1u);
  let max_y = clamp_index(i32(ceil(max(max(p0.y, p1.y), max(p2.y, p3.y)))), params.height - 1u);
  let min_z = clamp_index(i32(floor(min(min(p0.z, p1.z), min(p2.z, p3.z)))), params.depth - 1u);
  let max_z = clamp_index(i32(ceil(max(max(p0.z, p1.z), max(p2.z, p3.z)))), params.depth - 1u);

  for (var z = min_z; z <= max_z; z = z + 1u) {
    for (var y = min_y; y <= max_y; y = y + 1u) {
      for (var x = min_x; x <= max_x; x = x + 1u) {
        if (point_in_tetrahedron(vec3<f32>(f32(x), f32(y), f32(z)), p0, p1, p2, p3)) {
          atomicStore(&occupancy[voxel_index(vec3<u32>(x, y, z))], 1u);
        }
      }
    }
  }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cube_resolution = params.resolution - 1u;
  let cube_count = cube_resolution * cube_resolution * cube_resolution;
  if (gid.x >= cube_count) {
    return;
  }

  let coord = cube_index_to_coord(gid.x, params.resolution);
  let corner_indices = array<u32, 8>(
    lattice_index(coord + vec3<u32>(0u, 0u, 0u), params.resolution),
    lattice_index(coord + vec3<u32>(1u, 0u, 0u), params.resolution),
    lattice_index(coord + vec3<u32>(0u, 1u, 0u), params.resolution),
    lattice_index(coord + vec3<u32>(1u, 1u, 0u), params.resolution),
    lattice_index(coord + vec3<u32>(0u, 0u, 1u), params.resolution),
    lattice_index(coord + vec3<u32>(1u, 0u, 1u), params.resolution),
    lattice_index(coord + vec3<u32>(0u, 1u, 1u), params.resolution),
    lattice_index(coord + vec3<u32>(1u, 1u, 1u), params.resolution)
  );

  var corners: array<vec4<f32>, 8>;
  for (var i = 0u; i < 8u; i = i + 1u) {
    corners[i] = lattice[corner_indices[i]];
    if (corners[i].w < 0.5) {
      return;
    }
  }

  let tetrahedra = array<vec4<u32>, 6>(
    vec4<u32>(0u, 1u, 3u, 7u),
    vec4<u32>(0u, 1u, 5u, 7u),
    vec4<u32>(0u, 4u, 5u, 7u),
    vec4<u32>(0u, 4u, 6u, 7u),
    vec4<u32>(0u, 2u, 6u, 7u),
    vec4<u32>(0u, 2u, 3u, 7u)
  );

  for (var i = 0u; i < 6u; i = i + 1u) {
    let tetra = tetrahedra[i];
    mark_tetrahedron(
      corners[tetra.x].xyz,
      corners[tetra.y].xyz,
      corners[tetra.z].xyz,
      corners[tetra.w].xyz
    );
  }
}
`;

const SEED_SHADER = /* wgsl */ `
struct Dims {
  voxel_count: u32,
  dispatch_stride: u32,
}

@group(0) @binding(0) var<storage, read> dims: Dims;
@group(0) @binding(1) var<storage, read> occupancy: array<u32>;
@group(0) @binding(2) var<storage, read_write> filled: array<f32>;
@group(0) @binding(3) var<storage, read_write> empty: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x + gid.y * dims.dispatch_stride;
  if (index >= dims.voxel_count) {
    return;
  }

  let value = occupancy[index];
  filled[index] = select(1e20, 0.0, value == 1u);
  empty[index] = select(1e20, 0.0, value == 0u);
}
`;

const DISTANCE_AXIS_SHADER = /* wgsl */ `
const INF: f32 = 1e20;
const MAX_LINE: u32 = 256u;

struct Params {
  width: u32,
  height: u32,
  depth: u32,
  axis: u32,
  dispatch_stride: u32,
}

@group(0) @binding(0) var<storage, read> params: Params;
@group(0) @binding(1) var<storage, read> step_data: array<f32>;
@group(0) @binding(2) var<storage, read> source: array<f32>;
@group(0) @binding(3) var<storage, read_write> output_buffer: array<f32>;

fn grid_index(x: u32, y: u32, z: u32) -> u32 {
  return x + params.width * (y + params.height * z);
}

fn get_line_length() -> u32 {
  if (params.axis == 0u) {
    return params.width;
  }
  if (params.axis == 1u) {
    return params.height;
  }
  return params.depth;
}

fn get_line_count() -> u32 {
  if (params.axis == 0u) {
    return params.height * params.depth;
  }
  if (params.axis == 1u) {
    return params.width * params.depth;
  }
  return params.width * params.height;
}

fn load_source(line_index: u32, q: u32) -> f32 {
  if (params.axis == 0u) {
    let z = line_index / params.height;
    let y = line_index - z * params.height;
    return source[grid_index(q, y, z)];
  }
  if (params.axis == 1u) {
    let z = line_index / params.width;
    let x = line_index - z * params.width;
    return source[grid_index(x, q, z)];
  }
  let y = line_index / params.width;
  let x = line_index - y * params.width;
  return source[grid_index(x, y, q)];
}

fn store_target(line_index: u32, q: u32, value: f32) {
  if (params.axis == 0u) {
    let z = line_index / params.height;
    let y = line_index - z * params.height;
    output_buffer[grid_index(q, y, z)] = value;
    return;
  }
  if (params.axis == 1u) {
    let z = line_index / params.width;
    let x = line_index - z * params.width;
    output_buffer[grid_index(x, q, z)] = value;
    return;
  }
  let y = line_index / params.width;
  let x = line_index - y * params.width;
  output_buffer[grid_index(x, y, q)] = value;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let line_index = gid.x + gid.y * params.dispatch_stride;
  let line_count = get_line_count();
  let line_length = get_line_length();
  if (line_index >= line_count || line_length > MAX_LINE) {
    return;
  }

  let step = step_data[0];
  let step2 = step * step;
  var f: array<f32, MAX_LINE>;
  var out: array<f32, MAX_LINE>;
  var v: array<i32, MAX_LINE>;
  var z: array<f32, 257>;

  for (var i = 0u; i < line_length; i = i + 1u) {
    f[i] = load_source(line_index, i);
  }

  var k: i32 = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;

  for (var q = 1u; q < line_length; q = q + 1u) {
    var s = 0.0;
    loop {
      let vk = v[u32(k)];
      let fq = f[q];
      let fvk = f[u32(vk)];
      s = ((fq + step2 * f32(q * q)) - (fvk + step2 * f32(u32(vk) * u32(vk)))) /
          (2.0 * step2 * f32(i32(q) - vk));
      if (s > z[u32(k)]) {
        break;
      }
      k = k - 1;
      if (k < 0) {
        k = 0;
        break;
      }
    }

    k = k + 1;
    v[u32(k)] = i32(q);
    z[u32(k)] = s;
    z[u32(k + 1)] = INF;
  }

  k = 0;
  for (var q = 0u; q < line_length; q = q + 1u) {
    while (z[u32(k + 1)] < f32(q)) {
      k = k + 1;
    }
    let vk = v[u32(k)];
    let delta = i32(q) - vk;
    out[q] = step2 * f32(delta * delta) + f[u32(vk)];
  }

  for (var q = 0u; q < line_length; q = q + 1u) {
    store_target(line_index, q, out[q]);
  }
}
`;

const COMBINE_SDF_SHADER = /* wgsl */ `
struct Params {
  voxel_count: u32,
  inside_negative: u32,
  dispatch_stride: u32,
}

@group(0) @binding(0) var<storage, read> params: Params;
@group(0) @binding(1) var<storage, read> distance_to_filled: array<f32>;
@group(0) @binding(2) var<storage, read> distance_to_empty: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x + gid.y * params.dispatch_stride;
  if (index >= params.voxel_count) {
    return;
  }

  let outside_distance = sqrt(distance_to_filled[index]);
  let inside_distance = sqrt(distance_to_empty[index]);
  let signed_distance = outside_distance - inside_distance;
  output[index] = select(-signed_distance, signed_distance, params.inside_negative == 1u);
}
`;

function createStorageBuffer(
  device: GPUDevice,
  size: number,
  usage: GPUBufferUsageFlags,
  label: string,
): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage,
  });
}

function computeDispatch2d(
  itemCount: number,
  workgroupSizeX: number,
): { x: number; y: number; stride: number } {
  const totalWorkgroupsX = Math.ceil(itemCount / workgroupSizeX);
  const x = Math.min(65535, Math.max(1, totalWorkgroupsX));
  const y = Math.max(1, Math.ceil(totalWorkgroupsX / x));
  return {
    x,
    y,
    stride: x * workgroupSizeX,
  };
}

function writeBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  data: ArrayBuffer | ArrayBufferView<ArrayBufferLike>,
): void {
  const bytes =
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const copy = bytes.slice().buffer;

  device.queue.writeBuffer(
    buffer,
    0,
    copy,
    0,
    copy.byteLength,
  );
}

async function readBuffer(
  device: GPUDevice,
  source: GPUBuffer,
  byteLength: number,
): Promise<ArrayBuffer> {
  const readback = createStorageBuffer(
    device,
    byteLength,
    GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    "icc2sdf-readback",
  );
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const copy = readback.getMappedRange().slice(0);
  readback.unmap();
  readback.destroy();
  return copy;
}

function packLatticeForGpu(
  lattice: ReturnType<typeof buildLabLatticesFromIcc>[number],
): Float32Array {
  const packed = new Float32Array((lattice.positions.length / 3) * 4);
  const count = lattice.positions.length / 3;
  for (let index = 0; index < count; index += 1) {
    const srcBase = index * 3;
    const dstBase = index * 4;
    packed[dstBase] = lattice.positions[srcBase] ?? 0;
    packed[dstBase + 1] = lattice.positions[srcBase + 1] ?? 0;
    packed[dstBase + 2] = lattice.positions[srcBase + 2] ?? 0;
    packed[dstBase + 3] = lattice.valid[index] === 1 ? 1 : 0;
  }
  return packed;
}

function createOccupancyPipeline(device: GPUDevice): GPUComputePipeline {
  return device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: OCCUPANCY_SHADER }),
      entryPoint: "main",
    },
  });
}

function createSeedPipeline(device: GPUDevice): GPUComputePipeline {
  return device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: SEED_SHADER }),
      entryPoint: "main",
    },
  });
}

function createDistanceAxisPipeline(device: GPUDevice): GPUComputePipeline {
  return device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: DISTANCE_AXIS_SHADER }),
      entryPoint: "main",
    },
  });
}

function createCombineSdfPipeline(device: GPUDevice): GPUComputePipeline {
  return device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: COMBINE_SDF_SHADER }),
      entryPoint: "main",
    },
  });
}

export async function voxelizeLabLatticeOnGpu(
  lattice: ReturnType<typeof buildLabLatticesFromIcc>[number],
  options: GpuBuildOptions,
): Promise<OccupancyGrid> {
  const { device } = options;
  const { width, height, depth } = lattice.metadata.dimensions;
  const voxelCount = width * height * depth;
  const cubeResolution = lattice.metadata.sampleResolution - 1;
  const cubeCount = cubeResolution * cubeResolution * cubeResolution;
  const packedLattice = packLatticeForGpu(lattice);
  const paramsBuffer = createStorageBuffer(
    device,
    16,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-occupancy-params",
  );
  const latticeBuffer = createStorageBuffer(
    device,
    packedLattice.byteLength,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-lattice",
  );
  const occupancyBuffer = createStorageBuffer(
    device,
    voxelCount * 4,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    "icc2sdf-occupancy",
  );

  writeBuffer(
    device,
    paramsBuffer,
    new Uint32Array([width, height, depth, lattice.metadata.sampleResolution]),
  );
  writeBuffer(device, latticeBuffer, packedLattice);
  writeBuffer(device, occupancyBuffer, new Uint32Array(voxelCount));

  const pipeline = createOccupancyPipeline(device);
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: latticeBuffer } },
      { binding: 2, resource: { buffer: occupancyBuffer } },
    ],
  });
  const dispatch = computeDispatch2d(cubeCount, 64);
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatch.x, dispatch.y);
  pass.end();
  device.queue.submit([encoder.finish()]);

  const readback = new Uint32Array(await readBuffer(device, occupancyBuffer, voxelCount * 4));
  const occupancy = new Uint8Array(voxelCount);
  for (let index = 0; index < voxelCount; index += 1) {
    occupancy[index] = readback[index] === 0 ? 0 : 1;
  }

  paramsBuffer.destroy();
  latticeBuffer.destroy();
  occupancyBuffer.destroy();

  return {
    metadata: lattice.metadata,
    data: occupancy,
  };
}

async function runDistanceAxisPass(
  device: GPUDevice,
  source: GPUBuffer,
  target: GPUBuffer,
  dimensions: OccupancyGrid["metadata"]["dimensions"],
  axis: 0 | 1 | 2,
  step: number,
): Promise<void> {
  const paramsBuffer = createStorageBuffer(
    device,
    20,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-distance-axis-params",
  );
  const stepBuffer = createStorageBuffer(
    device,
    4,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-distance-axis-step",
  );
  const lineCount =
    axis === 0
      ? dimensions.height * dimensions.depth
      : axis === 1
        ? dimensions.width * dimensions.depth
        : dimensions.width * dimensions.height;
  const dispatch = computeDispatch2d(lineCount, 64);
  writeBuffer(
    device,
    paramsBuffer,
    new Uint32Array([
      dimensions.width,
      dimensions.height,
      dimensions.depth,
      axis,
      dispatch.stride,
    ]),
  );
  writeBuffer(device, stepBuffer, new Float32Array([step]));

  const pipeline = createDistanceAxisPipeline(device);
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: stepBuffer } },
      { binding: 2, resource: { buffer: source } },
      { binding: 3, resource: { buffer: target } },
    ],
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatch.x, dispatch.y);
  pass.end();
  device.queue.submit([encoder.finish()]);

  paramsBuffer.destroy();
  stepBuffer.destroy();
}

export async function occupancyGridToSdfVolumeOnGpu(
  occupancy: OccupancyGrid,
  options: GpuBuildOptions & OccupancyToSdfConfig,
): Promise<SdfVolume<Float32Array>> {
  const { device } = options;
  const { width, height, depth } = occupancy.metadata.dimensions;

  if (
    width > MAX_GPU_LINE_LENGTH ||
    height > MAX_GPU_LINE_LENGTH ||
    depth > MAX_GPU_LINE_LENGTH
  ) {
    throw new Error(`WebGPU SDF pass currently supports dimensions up to ${MAX_GPU_LINE_LENGTH} per axis`);
  }

  const voxelCount = width * height * depth;
  const occupancyWords = new Uint32Array(voxelCount);
  for (let index = 0; index < voxelCount; index += 1) {
    occupancyWords[index] = occupancy.data[index] === 0 ? 0 : 1;
  }

  const dimsBuffer = createStorageBuffer(
    device,
    8,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-seed-dims",
  );
  const occupancyBuffer = createStorageBuffer(
    device,
    occupancyWords.byteLength,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-occupancy-words",
  );
  const filledA = createStorageBuffer(
    device,
    voxelCount * 4,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    "icc2sdf-filled-a",
  );
  const filledB = createStorageBuffer(
    device,
    voxelCount * 4,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-filled-b",
  );
  const emptyA = createStorageBuffer(
    device,
    voxelCount * 4,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-empty-a",
  );
  const emptyB = createStorageBuffer(
    device,
    voxelCount * 4,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-empty-b",
  );
  const outputBuffer = createStorageBuffer(
    device,
    voxelCount * 4,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    "icc2sdf-sdf-output",
  );

  const seedDispatch = computeDispatch2d(voxelCount, 256);
  writeBuffer(device, dimsBuffer, new Uint32Array([voxelCount, seedDispatch.stride]));
  writeBuffer(device, occupancyBuffer, occupancyWords);

  const seedPipeline = createSeedPipeline(device);
  const seedBindGroup = device.createBindGroup({
    layout: seedPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: dimsBuffer } },
      { binding: 1, resource: { buffer: occupancyBuffer } },
      { binding: 2, resource: { buffer: filledA } },
      { binding: 3, resource: { buffer: emptyA } },
    ],
  });
  {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(seedPipeline);
    pass.setBindGroup(0, seedBindGroup);
    pass.dispatchWorkgroups(seedDispatch.x, seedDispatch.y);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  const xStep = options.distanceUnit === "voxels" ? 1 : occupancy.metadata.spacing.lStep;
  const yStep = options.distanceUnit === "voxels" ? 1 : occupancy.metadata.spacing.aStep;
  const zStep = options.distanceUnit === "voxels" ? 1 : occupancy.metadata.spacing.bStep;

  await runDistanceAxisPass(device, filledA, filledB, occupancy.metadata.dimensions, 0, xStep);
  await runDistanceAxisPass(device, filledB, filledA, occupancy.metadata.dimensions, 1, yStep);
  await runDistanceAxisPass(device, filledA, filledB, occupancy.metadata.dimensions, 2, zStep);

  await runDistanceAxisPass(device, emptyA, emptyB, occupancy.metadata.dimensions, 0, xStep);
  await runDistanceAxisPass(device, emptyB, emptyA, occupancy.metadata.dimensions, 1, yStep);
  await runDistanceAxisPass(device, emptyA, emptyB, occupancy.metadata.dimensions, 2, zStep);

  const combineParamsBuffer = createStorageBuffer(
    device,
    12,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    "icc2sdf-combine-params",
  );
  const combineDispatch = computeDispatch2d(voxelCount, 256);
  writeBuffer(
    device,
    combineParamsBuffer,
    new Uint32Array([
      voxelCount,
      options.insideNegative ?? true ? 1 : 0,
      combineDispatch.stride,
    ]),
  );
  const combinePipeline = createCombineSdfPipeline(device);
  const combineBindGroup = device.createBindGroup({
    layout: combinePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: combineParamsBuffer } },
      { binding: 1, resource: { buffer: filledB } },
      { binding: 2, resource: { buffer: emptyB } },
      { binding: 3, resource: { buffer: outputBuffer } },
    ],
  });
  {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(combinePipeline);
    pass.setBindGroup(0, combineBindGroup);
    pass.dispatchWorkgroups(combineDispatch.x, combineDispatch.y);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  const data = new Float32Array(await readBuffer(device, outputBuffer, voxelCount * 4));

  dimsBuffer.destroy();
  occupancyBuffer.destroy();
  filledA.destroy();
  filledB.destroy();
  emptyA.destroy();
  emptyB.destroy();
  outputBuffer.destroy();
  combineParamsBuffer.destroy();

  return {
    metadata: {
      dimensions: occupancy.metadata.dimensions,
      bounds: occupancy.metadata.bounds,
      spacing: occupancy.metadata.spacing,
    },
    data,
  };
}

export async function buildLabOccupancyGridFromIccGpu(
  iccBytes: Uint8Array,
  config: IccOccupancyBuildConfig & GpuBuildOptions,
): Promise<OccupancyGrid> {
  const lattices = buildLabLatticesFromIcc(iccBytes, config);
  const metadata = lattices[0]?.metadata;
  if (metadata == null) {
    throw new Error("No lattice data was produced for the ICC profile");
  }

  const occupancy = new Uint8Array(
    metadata.dimensions.width * metadata.dimensions.height * metadata.dimensions.depth,
  );

  for (const lattice of lattices) {
    const partial = await voxelizeLabLatticeOnGpu(lattice, config);
    for (let index = 0; index < occupancy.length; index += 1) {
      if (partial.data[index] === 1) {
        occupancy[index] = 1;
      }
    }
  }

  return {
    metadata,
    data: occupancy,
  };
}

export async function buildLabSdfVolumeFromIccGpu(
  iccBytes: Uint8Array,
  config: IccOccupancyBuildConfig & OccupancyToSdfConfig & GpuBuildOptions,
): Promise<SdfVolume<Float32Array>> {
  const occupancy = await buildLabOccupancyGridFromIccGpu(iccBytes, config);
  return occupancyGridToSdfVolumeOnGpu(occupancy, config);
}
