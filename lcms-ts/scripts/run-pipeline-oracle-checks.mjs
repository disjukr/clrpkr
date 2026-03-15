import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const packageDir = process.cwd();
const repoRoot = path.resolve(packageDir, "..");
const oraclePath = path.join(packageDir, "tmp", "oracle", "pipeline_oracle.exe");

async function ensureOracle() {
  try {
    await access(oraclePath);
  } catch {
    await run("node", [path.join(packageDir, "scripts", "build-pipeline-oracle.mjs")]);
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `${command} ${args.join(" ")} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

function clampUnit(value) {
  if (Number.isNaN(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function cmsEvalToneCurveFloat(curve, value) {
  const x = clampUnit(value);
  if (curve.parametricType !== undefined && curve.params) {
    return evalParametric(curve.parametricType, curve.params, x);
  }

  if (curve.tableFloat) {
    return interpolateFloat(curve.tableFloat, x);
  }

  return interpolate16(curve.table16, Math.round(x * 65535)) / 65535;
}

function interpolate16(table, input) {
  if (table.length === 1) return table[0];
  const position = (input / 65535) * (table.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, table.length - 1);
  const frac = position - lower;
  return table[lower] + (table[upper] - table[lower]) * frac;
}

function interpolateFloat(table, input) {
  if (table.length === 1) return table[0];
  const position = input * (table.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, table.length - 1);
  const frac = position - lower;
  return table[lower] + (table[upper] - table[lower]) * frac;
}

function evalParametric(type, params, x) {
  const gamma = params[0];
  if (type > 0) return forward(type, params, x);
  return inverse(-type, params, x);

  function forward(kind, p, v) {
    switch (kind) {
      case 1: return v ** gamma;
      case 2: return v >= -p[2] / p[1] ? (p[1] * v + p[2]) ** gamma : 0;
      case 3: return v >= -p[2] / p[1] ? (p[1] * v + p[2]) ** gamma + p[3] : p[3];
      case 4: return v >= p[4] ? (p[1] * v + p[2]) ** gamma : p[3] * v;
      case 5: return v >= p[4] ? (p[1] * v + p[2]) ** gamma + p[5] : p[3] * v + p[6];
      default: throw new Error(`unsupported parametric type ${kind}`);
    }
  }

  function inverse(kind, p, v) {
    switch (kind) {
      case 1: return v ** (1 / gamma);
      case 2: return ((v ** (1 / gamma)) - p[2]) / p[1];
      case 3: return v <= p[3] ? 0 : (((v - p[3]) ** (1 / gamma)) - p[2]) / p[1];
      case 4: return v >= p[3] * p[4] ? ((v ** (1 / gamma)) - p[2]) / p[1] : v / p[3];
      case 5: return v >= p[3] * p[4] + p[6] ? (((v - p[5]) ** (1 / gamma)) - p[2]) / p[1] : (v - p[6]) / p[3];
      default: throw new Error(`unsupported parametric type ${kind}`);
    }
  }
}

function matEval(matrix, input, offset) {
  return [
    clampUnit(matrix[0][0] * input[0] + matrix[0][1] * input[1] + matrix[0][2] * input[2] + offset[0]),
    clampUnit(matrix[1][0] * input[0] + matrix[1][1] * input[1] + matrix[1][2] * input[2] + offset[1]),
    clampUnit(matrix[2][0] * input[0] + matrix[2][1] * input[1] + matrix[2][2] * input[2] + offset[2]),
  ];
}

function strides(gridPoints, outputChannels) {
  const s = new Array(gridPoints.length).fill(0);
  let stride = outputChannels;
  for (let i = gridPoints.length - 1; i >= 0; i--) {
    s[i] = stride;
    stride *= gridPoints[i];
  }
  return s;
}

function sampleClut(values, st, coords, outIndex) {
  let idx = outIndex;
  for (let i = 0; i < coords.length; i++) idx += coords[i] * st[i];
  return values[idx] ?? 0;
}

function clutEval(stage, input, mode) {
  return mode !== "multilinear" && stage.inputChannels === 3
    ? clutTetra(stage, input)
    : clutLinear(stage, input);
}

function clutLinear(stage, input) {
  const out = new Array(stage.outputChannels).fill(0);
  const lower = stage.gridPoints.map((points, i) => {
    const scaled = clampUnit(input[i] ?? 0) * (points - 1);
    return Math.min(Math.floor(scaled), points - 1);
  });
  const frac = stage.gridPoints.map((points, i) => {
    const scaled = clampUnit(input[i] ?? 0) * (points - 1);
    const lo = Math.min(Math.floor(scaled), points - 1);
    return lo >= points - 1 ? 0 : scaled - lo;
  });
  const st = strides(stage.gridPoints, stage.outputChannels);
  const vertices = 1 << stage.inputChannels;
  for (let vertex = 0; vertex < vertices; vertex++) {
    const coords = lower.slice();
    let weight = 1;
    for (let axis = 0; axis < stage.inputChannels; axis++) {
      const useUpper = (vertex & (1 << axis)) !== 0;
      const points = stage.gridPoints[axis];
      const f = frac[axis];
      if (useUpper) {
        coords[axis] = Math.min(coords[axis] + 1, points - 1);
        weight *= f;
      } else {
        weight *= 1 - f;
      }
    }
    for (let j = 0; j < stage.outputChannels; j++) out[j] += weight * sampleClut(stage.values, st, coords, j);
  }
  const scale = stage.kind === "clut8" ? 255 : 65535;
  return out.map((v) => clampUnit(v / scale));
}

function clutTetra(stage, input) {
  const [gx, gy, gz] = stage.gridPoints;
  const px = clampUnit(input[0]) * (gx - 1);
  const py = clampUnit(input[1]) * (gy - 1);
  const pz = clampUnit(input[2]) * (gz - 1);
  const x0 = Math.floor(px), y0 = Math.floor(py), z0 = Math.floor(pz);
  const rx = px - x0, ry = py - y0, rz = pz - z0;
  const x1 = x0 + (clampUnit(input[0]) >= 1 ? 0 : 1);
  const y1 = y0 + (clampUnit(input[1]) >= 1 ? 0 : 1);
  const z1 = z0 + (clampUnit(input[2]) >= 1 ? 0 : 1);
  const st = strides(stage.gridPoints, stage.outputChannels);
  const scale = stage.kind === "clut8" ? 255 : 65535;
  const out = new Array(stage.outputChannels).fill(0);
  for (let j = 0; j < stage.outputChannels; j++) {
    const dens = (x, y, z) => sampleClut(stage.values, st, [x, y, z], j) / scale;
    const c0 = dens(x0, y0, z0);
    let c1 = 0, c2 = 0, c3 = 0;
    if (rx >= ry && ry >= rz) {
      c1 = dens(x1, y0, z0) - c0;
      c2 = dens(x1, y1, z0) - dens(x1, y0, z0);
      c3 = dens(x1, y1, z1) - dens(x1, y1, z0);
    } else if (rx >= rz && rz >= ry) {
      c1 = dens(x1, y0, z0) - c0;
      c2 = dens(x1, y1, z1) - dens(x1, y0, z1);
      c3 = dens(x1, y0, z1) - dens(x1, y0, z0);
    } else if (rz >= rx && rx >= ry) {
      c1 = dens(x1, y0, z1) - dens(x0, y0, z1);
      c2 = dens(x1, y1, z1) - dens(x1, y0, z1);
      c3 = dens(x0, y0, z1) - c0;
    } else if (ry >= rx && rx >= rz) {
      c1 = dens(x1, y1, z0) - dens(x0, y1, z0);
      c2 = dens(x0, y1, z0) - c0;
      c3 = dens(x1, y1, z1) - dens(x1, y1, z0);
    } else if (ry >= rz && rz >= rx) {
      c1 = dens(x1, y1, z1) - dens(x0, y1, z1);
      c2 = dens(x0, y1, z0) - c0;
      c3 = dens(x0, y1, z1) - dens(x0, y1, z0);
    } else if (rz >= ry && ry >= rx) {
      c1 = dens(x1, y1, z1) - dens(x0, y1, z1);
      c2 = dens(x0, y1, z1) - dens(x0, y0, z1);
      c3 = dens(x0, y0, z1) - c0;
    }
    out[j] = clampUnit(c0 + c1 * rx + c2 * ry + c3 * rz);
  }
  return out;
}

function evaluatePipeline(input, pipeline, interpolation = "auto") {
  let current = [...input];
  for (const stage of pipeline.stages) {
    if (stage.kind === "tone-curves") {
      current = stage.curves.map((curve, i) => cmsEvalToneCurveFloat(curve, current[i] ?? 0));
    } else if (stage.kind === "matrix") {
      current = matEval(stage.matrix.v.map((row) => row.n), current, stage.offset);
    } else {
      current = clutEval(stage, current, interpolation);
    }
  }
  return current;
}

function parseIccHeader(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { tagCount: view.getUint32(128, false) };
}

function parseIccTagTable(data, header) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tags = [];
  for (let i = 0; i < header.tagCount; i++) {
    const off = 132 + i * 12;
    tags.push({
      signature: String.fromCharCode(data[off], data[off + 1], data[off + 2], data[off + 3]),
      offset: view.getUint32(off + 4, false),
      size: view.getUint32(off + 8, false),
    });
  }
  return tags;
}

function parseIccLutTag(data, tag) {
  const payload = data.slice(tag.offset, tag.offset + tag.size);
  const type = String.fromCharCode(payload[0], payload[1], payload[2], payload[3]);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  if (type === "mft2") {
    const inputChannels = payload[8], outputChannels = payload[9], gridPoints = payload[10];
    const matrix = Array.from({ length: 9 }, (_, i) => view.getInt32(12 + i * 4, false) / 65536);
    const inputTableEntries = view.getUint16(48, false);
    const outputTableEntries = view.getUint16(50, false);
    const inputTables = new Uint16Array(inputChannels * inputTableEntries);
    const clutValues = new Uint16Array((gridPoints ** inputChannels) * outputChannels);
    const outputTables = new Uint16Array(outputChannels * outputTableEntries);
    let cur = 52;
    for (let i = 0; i < inputTables.length; i++) inputTables[i] = view.getUint16(cur + i * 2, false);
    cur += inputTables.length * 2;
    for (let i = 0; i < clutValues.length; i++) clutValues[i] = view.getUint16(cur + i * 2, false);
    cur += clutValues.length * 2;
    for (let i = 0; i < outputTables.length; i++) outputTables[i] = view.getUint16(cur + i * 2, false);
    return { kind: "mft2", inputChannels, outputChannels, gridPoints, matrix, inputTableEntries, outputTableEntries, inputTables, clutValues, outputTables };
  }
  if (type === "mft1") {
    const inputChannels = payload[8], outputChannels = payload[9], gridPoints = payload[10];
    const matrix = Array.from({ length: 9 }, (_, i) => view.getInt32(12 + i * 4, false) / 65536);
    const inputTables = payload.slice(48, 48 + inputChannels * 256);
    const clutOffset = 48 + inputChannels * 256;
    const clutValues = payload.slice(clutOffset, clutOffset + (gridPoints ** inputChannels) * outputChannels);
    const outputTables = payload.slice(clutOffset + clutValues.length, clutOffset + clutValues.length + outputChannels * 256);
    return { kind: "mft1", inputChannels, outputChannels, gridPoints, matrix, inputTables, clutValues, outputTables };
  }
  if (type === "mAB " || type === "mBA ") {
    const inputChannels = payload[8], outputChannels = payload[9];
    return {
      kind: type.trimEnd(),
      inputChannels,
      outputChannels,
      offsets: { bCurves: view.getUint32(12, false), matrix: view.getUint32(16, false), mCurves: view.getUint32(20, false), clut: view.getUint32(24, false), aCurves: view.getUint32(28, false) },
    };
  }
  throw new Error(`unsupported LUT type ${type}`);
}

function buildPipelineFromTag(data, tag) {
  const parsed = parseIccLutTag(data, tag);
  if (parsed.kind === "mft2") {
    const stages = [];
    stages.push({ kind: "tone-curves", channels: parsed.inputChannels, curves: Array.from({ length: parsed.inputChannels }, (_, i) => ({ table16: parsed.inputTables.slice(i * parsed.inputTableEntries, (i + 1) * parsed.inputTableEntries) })) });
    if (!(parsed.matrix[0] === 1 && parsed.matrix[4] === 1 && parsed.matrix[8] === 1 && parsed.matrix.filter((v, i) => ![0,4,8].includes(i)).every((v) => v === 0))) {
      stages.push({ kind: "matrix", rows: 3, cols: 3, matrix: { v: [{ n: [parsed.matrix[0], parsed.matrix[1], parsed.matrix[2]] }, { n: [parsed.matrix[3], parsed.matrix[4], parsed.matrix[5]] }, { n: [parsed.matrix[6], parsed.matrix[7], parsed.matrix[8]] }] }, offset: [0,0,0]});
    }
    stages.push({ kind: "clut16", inputChannels: parsed.inputChannels, outputChannels: parsed.outputChannels, gridPoints: new Array(parsed.inputChannels).fill(parsed.gridPoints), values: parsed.clutValues });
    stages.push({ kind: "tone-curves", channels: parsed.outputChannels, curves: Array.from({ length: parsed.outputChannels }, (_, i) => ({ table16: parsed.outputTables.slice(i * parsed.outputTableEntries, (i + 1) * parsed.outputTableEntries) })) });
    return { inputChannels: parsed.inputChannels, outputChannels: parsed.outputChannels, stages };
  }
  if (parsed.kind === "mft1") {
    const stages = [];
    stages.push({ kind: "tone-curves", channels: parsed.inputChannels, curves: Array.from({ length: parsed.inputChannels }, (_, i) => ({ table16: Uint16Array.from(parsed.inputTables.slice(i * 256, (i + 1) * 256), (v) => v * 257) })) });
    if (!(parsed.matrix[0] === 1 && parsed.matrix[4] === 1 && parsed.matrix[8] === 1 && parsed.matrix.filter((v, i) => ![0,4,8].includes(i)).every((v) => v === 0))) {
      stages.push({ kind: "matrix", rows: 3, cols: 3, matrix: { v: [{ n: [parsed.matrix[0], parsed.matrix[1], parsed.matrix[2]] }, { n: [parsed.matrix[3], parsed.matrix[4], parsed.matrix[5]] }, { n: [parsed.matrix[6], parsed.matrix[7], parsed.matrix[8]] }] }, offset: [0,0,0]});
    }
    stages.push({ kind: "clut8", inputChannels: parsed.inputChannels, outputChannels: parsed.outputChannels, gridPoints: new Array(parsed.inputChannels).fill(parsed.gridPoints), values: parsed.clutValues });
    stages.push({ kind: "tone-curves", channels: parsed.outputChannels, curves: Array.from({ length: parsed.outputChannels }, (_, i) => ({ table16: Uint16Array.from(parsed.outputTables.slice(i * 256, (i + 1) * 256), (v) => v * 257) })) });
    return { inputChannels: parsed.inputChannels, outputChannels: parsed.outputChannels, stages };
  }
  throw new Error("oracle comparison currently supports mft1/mft2 only");
}

async function compareCase(profileRelativePath, tagSignature, input, tolerance = 5e-3) {
  const profilePath = path.join(repoRoot, "icc-profiles", profileRelativePath);
  const data = new Uint8Array(await readFile(profilePath));
  const header = parseIccHeader(data);
  const tags = parseIccTagTable(data, header);
  const tag = tags.find((entry) => entry.signature === tagSignature);
  if (!tag) throw new Error(`Tag ${tagSignature} not found in ${profileRelativePath}`);
  const pipeline = buildPipelineFromTag(data, tag);
  const expected = evaluatePipeline(input, pipeline, "multilinear");
  const { stdout } = await run(oraclePath, [profilePath, tagSignature, ...input.map((value) => String(value))]);
  const actual = JSON.parse(stdout).output;

  if (expected.length !== actual.length) {
    throw new Error(`Length mismatch for ${profileRelativePath} ${tagSignature}`);
  }

  expected.forEach((value, index) => {
    const delta = Math.abs(value - actual[index]);
    if (delta > tolerance) {
      throw new Error(
        `${profileRelativePath} ${tagSignature} output[${index}] delta ${delta} exceeds tolerance ${tolerance}; expected=${value} actual=${actual[index]}`,
      );
    }
  });
}

await ensureOracle();

await compareCase("eci/eciCMYK_v2.icc", "A2B0", [0.1, 0.2, 0.3, 0.05], 8e-3);
await compareCase("eci/eciCMYK_v2.icc", "B2A2", [0.4, 0.5, 0.6], 1.5e-2);

console.log("Oracle checks passed");
