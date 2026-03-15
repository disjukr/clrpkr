import Head from "next/head";
import Link from "next/link";
import {
  type ChangeEvent,
  type ReactNode,
  startTransition,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackSide,
  ClampToEdgeWrapping,
  Data3DTexture,
  DataTexture,
  DoubleSide,
  FloatType,
  FrontSide,
  GLSL3,
  Matrix4,
  LinearFilter,
  RedFormat,
  ShaderMaterial,
  type Texture,
} from "three";
import { parseNrrd } from "../../../icc2sdf/dist/src/nrrd.js";
import type { NrrdVolume } from "../../../icc2sdf/dist/src/types.js";
import { CIE_1931_SPECTRAL_LOCUS } from "../lib/cie1931SpectralLocus.js";

type NrrdPreset = {
  readonly path: string;
  readonly label: string;
  readonly fileName: string;
};

type LoadedVolume = {
  readonly fileName: string;
  readonly fileSize: number;
  readonly volume: NrrdVolume<Float32Array>;
};

type VolumeStats = {
  readonly min: number;
  readonly max: number;
  readonly maxAbs: number;
};

type SurfacePointCloud = {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly count: number;
};

type SliceAxis = "x" | "y" | "z";
type RenderMode = "slices" | "raymarch";
type ProjectionMode = "perspective" | "orthographic";
type SpectralLocusPoint = readonly [number, number];

type R3fDeps = {
  readonly Canvas: typeof import("@react-three/fiber").Canvas;
  readonly Billboard: typeof import("@react-three/drei").Billboard;
  readonly Line: typeof import("@react-three/drei").Line;
  readonly OrbitControls: typeof import("@react-three/drei").OrbitControls;
  readonly Text: typeof import("@react-three/drei").Text;
  readonly useThree: typeof import("@react-three/fiber").useThree;
};

type CameraView = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";

type CameraViewState = {
  readonly name: CameraView;
  readonly token: number;
};

type OrientationAngles = {
  readonly pitch: number;
  readonly yaw: number;
};

type OrientationDragState = {
  readonly angles: OrientationAngles;
  readonly token: number;
};

const SURFACE_POINT_LIMIT = 48_000;
const XYY_LUMINANCE_DISPLAY_SCALE = 0.6;
const XYY_DISPLAY_SCALE = 10;

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function loadFileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function computeStats(data: Float32Array): VolumeStats {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < data.length; index += 1) {
    const value = data[index] ?? 0;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const maxAbs = Math.max(Math.abs(min), Math.abs(max));
  return { min, max, maxAbs };
}

function volumeIndex(
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
): number {
  return x + width * (y + height * z);
}

function mapXyyToDisplay(x: number, yChromaticity: number, luminance: number): [number, number, number] {
  return [
    x * XYY_DISPLAY_SCALE,
    yChromaticity * XYY_DISPLAY_SCALE,
    luminance * XYY_LUMINANCE_DISPLAY_SCALE * XYY_DISPLAY_SCALE,
  ];
}

function getDisplaySteps(spacing: NrrdVolume<Float32Array>["metadata"]["spacing"]) {
  return {
    x: Math.abs(spacing.xStep) * XYY_DISPLAY_SCALE,
    y: Math.abs(spacing.yStep) * XYY_DISPLAY_SCALE,
    Y: Math.abs(spacing.zStep) * XYY_LUMINANCE_DISPLAY_SCALE * XYY_DISPLAY_SCALE,
  };
}

function scalarToRgba(value: number, windowAbs: number): [number, number, number, number] {
  const normalized = clamp01((value + windowAbs) / (windowAbs * 2 || 1));
  const signed = windowAbs <= 0 ? 0 : clamp01(Math.abs(value) / windowAbs);

  if (value < 0) {
    return [
      Math.round(245 - 30 * normalized),
      Math.round(101 + 110 * (1 - signed)),
      Math.round(60 + 45 * (1 - signed)),
      212,
    ];
  }

  return [
    Math.round(55 + 80 * (1 - signed)),
    Math.round(145 + 80 * (1 - signed)),
    Math.round(240 - 35 * normalized),
    212,
  ];
}

function buildLinePositions(points: ReadonlyArray<readonly [number, number, number]>): Float32Array {
  const values = new Float32Array(points.length * 3);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index] ?? [0, 0, 0];
    const offset = index * 3;
    values[offset] = point[0];
    values[offset + 1] = point[1];
    values[offset + 2] = point[2];
  }
  return values;
}

function buildLinePointList(points: Float32Array): Array<[number, number, number]> {
  return Array.from({ length: points.length / 3 }, (_, index) => [
    points[index * 3] ?? 0,
    points[index * 3 + 1] ?? 0,
    points[index * 3 + 2] ?? 0,
  ]);
}

function linearToSrgbChannel(channel: number): number {
  if (channel <= 0.0031308) {
    return 12.92 * channel;
  }
  return 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

function chromaticityToApproxSrgb(x: number, y: number): readonly [number, number, number] {
  if (y <= 1e-6) {
    return [0, 0, 0];
  }

  const Y = 1;
  const X = (x * Y) / y;
  const Z = ((1 - x - y) * Y) / y;

  const linearR = 3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z;
  const linearG = -0.9787684 * X + 1.9161415 * Y + 0.033454 * Z;
  const linearB = 0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z;

  const r = Math.max(0, linearToSrgbChannel(Math.max(0, linearR)));
  const g = Math.max(0, linearToSrgbChannel(Math.max(0, linearG)));
  const b = Math.max(0, linearToSrgbChannel(Math.max(0, linearB)));

  const peak = Math.max(r, g, b, 1e-6);
  return [Math.min(1, r / peak), Math.min(1, g / peak), Math.min(1, b / peak)];
}

function buildSliceTexture(
  volume: NrrdVolume<Float32Array>,
  axis: SliceAxis,
  sliceIndex: number,
  windowAbs: number,
): { texture: Texture; physicalWidth: number; physicalHeight: number; position: [number, number, number]; rotation: [number, number, number] } {
  const {
    data,
    metadata: {
      dimensions: { width, height, depth },
      spacing,
      origin,
    },
  } = volume;
  const displaySteps = getDisplaySteps(spacing);

  let textureWidth = 1;
  let textureHeight = 1;
  let physicalWidth = 1;
  let physicalHeight = 1;
  let position: [number, number, number] = [0, 0, 0];
  let rotation: [number, number, number] = [0, 0, 0];

  if (axis === "z") {
    textureWidth = width;
    textureHeight = height;
    physicalWidth = Math.max(displaySteps.x, displaySteps.x * (width - 1));
    physicalHeight = Math.max(displaySteps.y, displaySteps.y * (height - 1));
    position = mapXyyToDisplay(
      origin.x + (width - 1) * spacing.xStep * 0.5,
      origin.y + (height - 1) * spacing.yStep * 0.5,
      origin.z + sliceIndex * spacing.zStep,
    );
    rotation = [0, 0, 0];
  } else if (axis === "y") {
    textureWidth = width;
    textureHeight = depth;
    physicalWidth = Math.max(displaySteps.x, displaySteps.x * (width - 1));
    physicalHeight = Math.max(displaySteps.Y, displaySteps.Y * (depth - 1));
    position = mapXyyToDisplay(
      origin.x + (width - 1) * spacing.xStep * 0.5,
      origin.y + sliceIndex * spacing.yStep,
      origin.z + (depth - 1) * spacing.zStep * 0.5,
    );
    rotation = [-Math.PI / 2, 0, 0];
  } else {
    textureWidth = height;
    textureHeight = depth;
    physicalWidth = Math.max(displaySteps.y, displaySteps.y * (height - 1));
    physicalHeight = Math.max(displaySteps.Y, displaySteps.Y * (depth - 1));
    position = mapXyyToDisplay(
      origin.x + sliceIndex * spacing.xStep,
      origin.y + (height - 1) * spacing.yStep * 0.5,
      origin.z + (depth - 1) * spacing.zStep * 0.5,
    );
    rotation = [0, Math.PI / 2, 0];
  }

  const rgba = new Uint8Array(textureWidth * textureHeight * 4);

  for (let row = 0; row < textureHeight; row += 1) {
    for (let column = 0; column < textureWidth; column += 1) {
      const x = axis === "x" ? sliceIndex : column;
      const y = axis === "z" ? row : axis === "y" ? sliceIndex : column;
      const z = axis === "z" ? sliceIndex : row;
      const value = data[volumeIndex(width, height, x, y, z)] ?? 0;
      const [r, g, b, a] = scalarToRgba(value, windowAbs);
      const targetRow = axis === "y" ? textureHeight - 1 - row : row;
      const offset = (column + textureWidth * targetRow) * 4;
      rgba[offset] = r;
      rgba[offset + 1] = g;
      rgba[offset + 2] = b;
      rgba[offset + 3] = a;
    }
  }

  const texture = new DataTexture(rgba, textureWidth, textureHeight);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return {
    texture,
    physicalWidth,
    physicalHeight,
    position,
    rotation,
  };
}

function buildSurfacePointCloud(
  volume: NrrdVolume<Float32Array>,
  isoThreshold: number,
): SurfacePointCloud {
  const {
    data,
    metadata: {
      dimensions: { width, height, depth },
      spacing,
      origin,
    },
  } = volume;

  const stride = Math.max(
    1,
    Math.ceil(Math.cbrt((width * height * depth) / SURFACE_POINT_LIMIT)),
  );
  const points: number[] = [];
  const colors: number[] = [];

  for (let z = 0; z < depth; z += stride) {
    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const value = data[volumeIndex(width, height, x, y, z)] ?? 0;
        if (Math.abs(value) > isoThreshold) {
          continue;
        }
        points.push(
          ...mapXyyToDisplay(
            origin.x + x * spacing.xStep,
            origin.y + y * spacing.yStep,
            origin.z + z * spacing.zStep,
          ),
        );

        if (value < 0) {
          colors.push(0.98, 0.56, 0.28);
        } else {
          colors.push(0.38, 0.78, 0.96);
        }
      }
    }
  }

  return {
    positions: new Float32Array(points),
    colors: new Float32Array(colors),
    count: points.length / 3,
  };
}

function AxisSlice(props: {
  readonly volume: NrrdVolume<Float32Array>;
  readonly axis: SliceAxis;
  readonly sliceIndex: number;
  readonly windowAbs: number;
}) {
  const slice = useMemo(
    () => buildSliceTexture(props.volume, props.axis, props.sliceIndex, props.windowAbs),
    [props.axis, props.sliceIndex, props.volume, props.windowAbs],
  );

  useEffect(() => () => slice.texture.dispose(), [slice.texture]);

  return (
    <mesh position={slice.position} rotation={slice.rotation}>
      <planeGeometry args={[slice.physicalWidth, slice.physicalHeight]} />
      <meshBasicMaterial map={slice.texture} transparent opacity={0.72} side={DoubleSide} />
    </mesh>
  );
}

function VolumeBounds(props: { readonly volume: NrrdVolume<Float32Array> }) {
  const {
    metadata: {
      dimensions: { width, height, depth },
      spacing,
      origin,
    },
  } = props.volume;
  const displaySteps = getDisplaySteps(spacing);
  const sizeX = displaySteps.x * Math.max(1, width - 1);
  const sizeY = displaySteps.y * Math.max(1, height - 1);
  const sizeZ = displaySteps.Y * Math.max(1, depth - 1);
  const center = mapXyyToDisplay(
    origin.x + (width - 1) * spacing.xStep * 0.5,
    origin.y + (height - 1) * spacing.yStep * 0.5,
    origin.z + (depth - 1) * spacing.zStep * 0.5,
  );

  return (
    <mesh position={center}>
      <boxGeometry args={[sizeX, sizeY, sizeZ]} />
      <meshBasicMaterial color="#1c1917" wireframe transparent opacity={0.16} />
    </mesh>
  );
}

function SurfacePoints(props: {
  readonly cloud: SurfacePointCloud;
  readonly volume: NrrdVolume<Float32Array>;
}) {
  const { maxSize } = getVolumeFrame(props.volume);
  const pointSize = Math.max(maxSize * 0.0015, 0.02);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[props.cloud.positions, 3]}
          count={props.cloud.count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[props.cloud.colors, 3]}
          count={props.cloud.count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={pointSize} sizeAttenuation vertexColors transparent opacity={0.72} />
    </points>
  );
}

function createVolumeTexture(volume: NrrdVolume<Float32Array>): Data3DTexture {
  const {
    data,
    metadata: {
      dimensions: { width, height, depth },
    },
  } = volume;

  const texture = new Data3DTexture(data, width, height, depth);
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.wrapR = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function createVolumeRaymarchMaterial(
  texture: Data3DTexture,
  volume: NrrdVolume<Float32Array>,
  maxAbs: number,
  isoThreshold: number,
): ShaderMaterial {
  const {
    metadata: {
      dimensions: { width, height, depth },
      spacing,
    },
  } = volume;
  const displaySteps = getDisplaySteps(spacing);
  const sizeX = displaySteps.x * Math.max(1, width - 1);
  const sizeY = displaySteps.y * Math.max(1, height - 1);
  const sizeZ = displaySteps.Y * Math.max(1, depth - 1);
  const boxScale = [sizeX, sizeY, sizeZ] as const;

  return new ShaderMaterial({
    glslVersion: GLSL3,
    transparent: false,
    side: FrontSide,
    depthWrite: true,
    depthTest: true,
    uniforms: {
      volumeTex: { value: texture },
      inverseModelMatrix: { value: new Matrix4() },
      boxScale: { value: boxScale },
      displayMin: {
        value: [
          volume.metadata.origin.x * XYY_DISPLAY_SCALE,
          volume.metadata.origin.y * XYY_DISPLAY_SCALE,
          volume.metadata.origin.z * XYY_LUMINANCE_DISPLAY_SCALE * XYY_DISPLAY_SCALE,
        ],
      },
      displaySpan: {
        value: [
          displaySteps.x * Math.max(1, width - 1),
          displaySteps.y * Math.max(1, height - 1),
          displaySteps.Y * Math.max(1, depth - 1),
        ],
      },
      texelSize: { value: [1 / Math.max(width, 1), 1 / Math.max(height, 1), 1 / Math.max(depth, 1)] },
      maxAbs: { value: Math.max(maxAbs, 0.0001) },
      isoThreshold: { value: Math.max(isoThreshold, 0.0001) },
      stepCount: { value: 320 },
    },
    vertexShader: `
      out vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      precision highp sampler3D;

      uniform sampler3D volumeTex;
      uniform mat4 inverseModelMatrix;
      uniform vec3 boxScale;
      uniform vec3 displayMin;
      uniform vec3 displaySpan;
      uniform vec3 texelSize;
      uniform float maxAbs;
      uniform float isoThreshold;
      uniform float stepCount;

      in vec3 vLocalPosition;
      out vec4 outColor;

      vec2 intersectBox(vec3 rayOrigin, vec3 rayDir) {
        vec3 boxMin = vec3(-0.5);
        vec3 boxMax = vec3(0.5);
        vec3 invDir = 1.0 / rayDir;
        vec3 t0 = (boxMin - rayOrigin) * invDir;
        vec3 t1 = (boxMax - rayOrigin) * invDir;
        vec3 tsmaller = min(t0, t1);
        vec3 tbigger = max(t0, t1);
        float tNear = max(max(tsmaller.x, tsmaller.y), tsmaller.z);
        float tFar = min(min(tbigger.x, tbigger.y), tbigger.z);
        return vec2(tNear, tFar);
      }

      float sampleSdf(vec3 localPoint) {
        return texture(volumeTex, localPoint + 0.5).r;
      }

      vec3 localPointToXyy(vec3 localPoint) {
        vec3 displayPoint = displayMin + (localPoint + 0.5) * displaySpan;
        return vec3(
          displayPoint.x / ${XYY_DISPLAY_SCALE.toFixed(8)},
          displayPoint.y / ${XYY_DISPLAY_SCALE.toFixed(8)},
          displayPoint.z / ${(XYY_LUMINANCE_DISPLAY_SCALE * XYY_DISPLAY_SCALE).toFixed(8)}
        );
      }

      vec3 xyyToXyzD50(vec3 xyy) {
        if (xyy.y <= 1e-6) {
          return vec3(0.0, xyy.z, 0.0);
        }
        return vec3(
          (xyy.x * xyy.z) / xyy.y,
          xyy.z,
          ((1.0 - xyy.x - xyy.y) * xyy.z) / xyy.y
        );
      }

      float linearToSrgbChannel(float channel) {
        if (channel <= 0.0031308) {
          return 12.92 * channel;
        }
        return 1.055 * pow(channel, 1.0 / 2.4) - 0.055;
      }

      vec3 xyzD50ToSrgb(vec3 xyz) {
        vec3 linear = vec3(
          3.1338561 * xyz.x - 1.6168667 * xyz.y - 0.4906146 * xyz.z,
          -0.9787684 * xyz.x + 1.9161415 * xyz.y + 0.0334540 * xyz.z,
          0.0719453 * xyz.x - 0.2289914 * xyz.y + 1.4052427 * xyz.z
        );
        linear = max(linear, vec3(0.0));
        return clamp(vec3(
          linearToSrgbChannel(linear.r),
          linearToSrgbChannel(linear.g),
          linearToSrgbChannel(linear.b)
        ), 0.0, 1.0);
      }

      vec3 sampleGradient(vec3 localPoint) {
        vec3 eps = texelSize;
        float dx = sampleSdf(localPoint + vec3(eps.x, 0.0, 0.0)) - sampleSdf(localPoint - vec3(eps.x, 0.0, 0.0));
        float dy = sampleSdf(localPoint + vec3(0.0, eps.y, 0.0)) - sampleSdf(localPoint - vec3(0.0, eps.y, 0.0));
        float dz = sampleSdf(localPoint + vec3(0.0, 0.0, eps.z)) - sampleSdf(localPoint - vec3(0.0, 0.0, eps.z));
        return normalize(vec3(dx, dy, dz) + 1e-6);
      }

      vec3 localNormalToWorld(vec3 localNormal) {
        // The raymarched box is translated and non-uniformly scaled but not rotated.
        // Undo the box scale so lighting is computed in display/world space.
        return normalize(localNormal / max(boxScale, vec3(1e-6)));
      }

      vec4 shadeSurface(vec3 rayOrigin, vec3 samplePoint) {
        vec3 xyy = localPointToXyy(samplePoint);
        vec3 base = xyzD50ToSrgb(xyyToXyzD50(xyy));
        return vec4(base, 1.0);
      }

      float refineSurfaceHit(vec3 rayOrigin, vec3 rayDir, float nearT, float farT) {
        float a = nearT;
        float b = farT;
        float fa = sampleSdf(rayOrigin + rayDir * a);
        for (int i = 0; i < 8; i++) {
          float mid = 0.5 * (a + b);
          float fm = sampleSdf(rayOrigin + rayDir * mid);
          if (sign(fa) == sign(fm)) {
            a = mid;
            fa = fm;
          } else {
            b = mid;
          }
        }
        return 0.5 * (a + b);
      }

      float findClosestSurfaceT(vec3 rayOrigin, vec3 rayDir, float nearT, float farT) {
        float bestT = nearT;
        float bestAbs = 1e9;
        for (int i = 0; i < 10; i++) {
          float u = float(i) / 9.0;
          float t = mix(nearT, farT, u);
          float candidate = abs(sampleSdf(rayOrigin + rayDir * t));
          if (candidate < bestAbs) {
            bestAbs = candidate;
            bestT = t;
          }
        }
        return bestT;
      }

      void main() {
        vec3 rayOrigin = (inverseModelMatrix * vec4(cameraPosition, 1.0)).xyz;
        vec3 rayDir = normalize(vLocalPosition - rayOrigin);
        vec2 hit = intersectBox(rayOrigin, rayDir);

        if (hit.x > hit.y || hit.y < 0.0) {
          discard;
        }

        float t = max(hit.x, 0.0);
        float tEnd = hit.y;
        float hitThreshold = max(isoThreshold * 0.24, 0.002);
        float baseStep = max((tEnd - t) / max(stepCount, 1.0), 0.0008);
        float previousSdf = sampleSdf(rayOrigin + rayDir * t);
        float previousAbsSdf = abs(previousSdf);

        if (previousAbsSdf <= hitThreshold) {
          outColor = shadeSurface(rayOrigin, rayOrigin + rayDir * t);
          return;
        }

        for (float i = 0.0; i < 384.0; i += 1.0) {
          if (i >= stepCount || t > tEnd) {
            break;
          }

          vec3 samplePoint = rayOrigin + rayDir * t;
          float sdf = sampleSdf(samplePoint);
          float absSdf = abs(sdf);
          bool crossedIso = sdf * previousSdf < 0.0;

          if (absSdf <= hitThreshold || crossedIso || previousAbsSdf <= hitThreshold) {
            if (crossedIso) {
              float refinedT = refineSurfaceHit(rayOrigin, rayDir, max(t - baseStep, hit.x), t);
              outColor = shadeSurface(rayOrigin, rayOrigin + rayDir * refinedT);
              return;
            }
            float closestT = findClosestSurfaceT(
              rayOrigin,
              rayDir,
              max(t - baseStep, hit.x),
              min(t + baseStep, tEnd)
            );
            outColor = shadeSurface(rayOrigin, rayOrigin + rayDir * closestT);
            return;
          }

          previousSdf = sdf;
          previousAbsSdf = absSdf;
          t += baseStep;
        }
        
        discard;
      }
    `,
  });
}

function VolumeRaymarch(props: {
  readonly volume: NrrdVolume<Float32Array>;
  readonly maxAbs: number;
  readonly isoThreshold: number;
}) {
  const meshRef = useRef<{
    updateMatrixWorld(force?: boolean): void;
    readonly matrixWorld: Matrix4;
  } | null>(null);
  const texture = useMemo(() => createVolumeTexture(props.volume), [props.volume]);
  const material = useMemo(
    () => createVolumeRaymarchMaterial(texture, props.volume, props.maxAbs, props.isoThreshold),
    [props.isoThreshold, props.maxAbs, props.volume, texture],
  );

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.uniforms.maxAbs.value = Math.max(props.maxAbs, 0.0001);
    material.uniforms.isoThreshold.value = Math.max(props.isoThreshold, 0.0001);
  }, [material, props.isoThreshold, props.maxAbs]);
  useEffect(() => {
    meshRef.current?.updateMatrixWorld(true);
    const mesh = meshRef.current;
    if (mesh) {
      material.uniforms.inverseModelMatrix.value.copy(mesh.matrixWorld).invert();
    }
  }, [material, props.volume]);

  const {
    metadata: {
      dimensions: { width, height, depth },
      spacing,
      origin,
    },
  } = props.volume;

  const displaySteps = getDisplaySteps(spacing);
  const sizeX = displaySteps.x * Math.max(1, width - 1);
  const sizeY = displaySteps.y * Math.max(1, height - 1);
  const sizeZ = displaySteps.Y * Math.max(1, depth - 1);
  const center = mapXyyToDisplay(
    origin.x + (width - 1) * spacing.xStep * 0.5,
    origin.y + (height - 1) * spacing.yStep * 0.5,
    origin.z + (depth - 1) * spacing.zStep * 0.5,
  );

  return (
    <mesh ref={meshRef} position={center} scale={[sizeX, sizeY, sizeZ]} renderOrder={5}>
      <boxGeometry args={[1, 1, 1]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}

function getVolumeFrame(volume: NrrdVolume<Float32Array>) {
  const {
    metadata: {
      dimensions: { width, height, depth },
      spacing,
      origin,
    },
  } = volume;

  const displaySteps = getDisplaySteps(spacing);
  const sizeX = displaySteps.x * Math.max(1, width - 1);
  const sizeY = displaySteps.y * Math.max(1, height - 1);
  const sizeZ = displaySteps.Y * Math.max(1, depth - 1);
  const center = mapXyyToDisplay(
    origin.x + (width - 1) * spacing.xStep * 0.5,
    origin.y + (height - 1) * spacing.yStep * 0.5,
    origin.z + (depth - 1) * spacing.zStep * 0.5,
  );

  return {
    center,
    diagonal: Math.hypot(sizeX, sizeY, sizeZ),
    maxSize: Math.max(sizeX, sizeY, sizeZ),
  };
}

function getCameraFrustum(volume: NrrdVolume<Float32Array>): {
  readonly near: number;
  readonly far: number;
} {
  const { maxSize } = getVolumeFrame(volume);
  return {
    near: Math.max(maxSize * 0.004, 0.01),
    far: Math.max(maxSize * 18, 12),
  };
}

function getCameraPositionForView(
  volume: NrrdVolume<Float32Array>,
  view: CameraView,
): [number, number, number] {
  const { center, maxSize } = getVolumeFrame(volume);
  const distance = Math.max(maxSize * 1.8, 2.1);

  switch (view) {
    case "front":
      return [center[0], center[1] + distance, center[2]];
    case "back":
      return [center[0], center[1] - distance, center[2]];
    case "left":
      return [center[0] - distance, center[1], center[2]];
    case "right":
      return [center[0] + distance, center[1], center[2]];
    case "top":
      return [center[0], center[1], center[2] + distance];
    case "bottom":
      return [center[0], center[1], center[2] - distance];
    case "iso":
    default:
      return [
        center[0] + distance * 0.9,
        center[1] + distance * 1.1,
        center[2] + distance * 0.85,
      ];
  }
}

function getCameraPositionForOrientation(
  volume: NrrdVolume<Float32Array>,
  orientation: OrientationAngles,
): [number, number, number] {
  const { center, maxSize } = getVolumeFrame(volume);
  const distance = Math.max(maxSize * 1.8, 2.1);
  const pitch = (orientation.pitch * Math.PI) / 180;
  const yaw = (orientation.yaw * Math.PI) / 180;

  return [
    center[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
    center[1] - Math.sin(pitch) * distance,
    center[2] + Math.cos(yaw) * Math.cos(pitch) * distance,
  ];
}

function computeOrientationAngles(
  cameraPosition: readonly [number, number, number],
  target: readonly [number, number, number],
): OrientationAngles {
  const dx = cameraPosition[0] - target[0];
  const dy = cameraPosition[1] - target[1];
  const dz = cameraPosition[2] - target[2];
  const length = Math.hypot(dx, dy, dz) || 1;
  const yaw = Math.atan2(dx, dz) * (180 / Math.PI);
  const pitch = -Math.asin(dy / length) * (180 / Math.PI);
  return { pitch, yaw };
}

function CameraViewController(props: {
  readonly volume: NrrdVolume<Float32Array>;
  readonly viewState: CameraViewState;
  readonly dragState: OrientationDragState | null;
  readonly projectionMode: ProjectionMode;
  readonly povDegrees: number;
  readonly controlsRef: React.MutableRefObject<{
    readonly target: { set(x: number, y: number, z: number): void };
    update(): void;
  } | null>;
  readonly onOrientationChange: (angles: OrientationAngles) => void;
  readonly deps: R3fDeps;
}) {
  const { camera, size } = props.deps.useThree();

  useEffect(() => {
    const frame = getVolumeFrame(props.volume);
    const { center } = frame;
    const frustum = getCameraFrustum(props.volume);
    const position =
      props.dragState == null
        ? getCameraPositionForView(props.volume, props.viewState.name)
        : getCameraPositionForOrientation(props.volume, props.dragState.angles);

    camera.position.set(position[0], position[1], position[2]);
    camera.near = frustum.near;
    camera.far = frustum.far;
    camera.up.set(0, 1, 0);
    if ("isPerspectiveCamera" in camera && camera.isPerspectiveCamera) {
      camera.fov = props.povDegrees;
    }
    if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
      const aspect = Math.max(size.width / Math.max(size.height, 1), 1e-4);
      const fitHeight = frame.maxSize * 1.25;
      const fitWidth = fitHeight * aspect;
      camera.left = -fitWidth * 0.5;
      camera.right = fitWidth * 0.5;
      camera.top = fitHeight * 0.5;
      camera.bottom = -fitHeight * 0.5;
      camera.zoom = 1;
    }
    camera.lookAt(center[0], center[1], center[2]);
    camera.updateProjectionMatrix();

    props.controlsRef.current?.target.set(center[0], center[1], center[2]);
    props.controlsRef.current?.update();
    props.onOrientationChange(computeOrientationAngles(position, center));
  }, [
    camera,
    props.controlsRef,
    props.dragState,
    props.onOrientationChange,
    props.povDegrees,
    props.projectionMode,
    size.height,
    size.width,
    props.viewState.name,
    props.viewState.token,
    props.volume,
  ]);

  return null;
}

function OrientationWidgetScene(props: {
  readonly deps: R3fDeps;
  readonly orientation: OrientationAngles;
  readonly onSelectView: (view: CameraView) => void;
  readonly onDragOrientation: (next: OrientationAngles) => void;
}) {
  const { Canvas, Text, useThree } = props.deps;
  const radius = 7;
  const dragRef = useRef<{
    readonly pointerId: number;
    readonly x: number;
    readonly y: number;
    readonly orientation: OrientationAngles;
  } | null>(null);

  function OrientationWidgetCamera() {
    const { camera } = useThree();

    useEffect(() => {
      const pitch = (props.orientation.pitch * Math.PI) / 180;
      const yaw = (props.orientation.yaw * Math.PI) / 180;
      const cameraPosition: [number, number, number] = [
        Math.sin(yaw) * Math.cos(pitch) * radius,
        -Math.sin(pitch) * radius,
        Math.cos(yaw) * Math.cos(pitch) * radius,
      ];

      camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }, [camera, props.orientation.pitch, props.orientation.yaw]);

    return null;
  }

  return (
    <Canvas camera={{ position: [0, 0, radius], fov: 28 }}>
      <OrientationWidgetCamera />
      <ambientLight intensity={1.2} />
      <group>
        <mesh
          onPointerDown={(event) => {
            const pointerTarget = event.target as
              | {
                  setPointerCapture?(pointerId: number): void;
                }
              | null;
            pointerTarget?.setPointerCapture?.(event.pointerId);
            dragRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              orientation: props.orientation,
            };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) {
              return;
            }
            const next = {
              yaw: drag.orientation.yaw - (event.clientX - drag.x) * 0.35,
              pitch: Math.max(
                -85,
                Math.min(85, drag.orientation.pitch - (event.clientY - drag.y) * 0.35),
              ),
            };
            props.onDragOrientation(next);
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) {
              dragRef.current = null;
            }
            const pointerTarget = event.target as
              | {
                  releasePointerCapture?(pointerId: number): void;
                }
              | null;
            pointerTarget?.releasePointerCapture?.(event.pointerId);
          }}
          onPointerOut={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) {
              dragRef.current = null;
            }
            const pointerTarget = event.target as
              | {
                  releasePointerCapture?(pointerId: number): void;
                }
              | null;
            pointerTarget?.releasePointerCapture?.(event.pointerId);
          }}
        >
          <boxGeometry args={[8, 8, 8]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={BackSide}
          />
        </mesh>
        {([
          {
            view: "front",
            label: "Front",
            position: [0, 1.02, 0],
            rotation: [-Math.PI / 2, 0, 0],
          },
          {
            view: "back",
            label: "Back",
            position: [0, -1.02, 0],
            rotation: [Math.PI / 2, 0, 0],
          },
          {
            view: "right",
            label: "Right",
            position: [1.02, 0, 0],
            rotation: [0, Math.PI / 2, 0],
          },
          {
            view: "left",
            label: "Left",
            position: [-1.02, 0, 0],
            rotation: [0, -Math.PI / 2, 0],
          },
          {
            view: "top",
            label: "Top",
            position: [0, 0, 1.02],
            rotation: [0, 0, 0],
          },
          {
            view: "bottom",
            label: "Bottom",
            position: [0, 0, -1.02],
            rotation: [0, Math.PI, 0],
          },
        ] as const).map((face) => (
          <group key={face.view} position={face.position} rotation={face.rotation}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                props.onSelectView(face.view);
              }}
            >
              <planeGeometry args={[1.76, 1.76]} />
              <meshBasicMaterial color="#fffdf8" transparent opacity={0.96} />
            </mesh>
            <Text
              position={[0, 0, 0.02]}
              color="#111827"
              fontSize={0.24}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#ffffff"
            >
              {face.label}
            </Text>
          </group>
        ))}
        <mesh>
          <boxGeometry args={[1.72, 1.72, 1.72]} />
          <meshBasicMaterial color="#111827" transparent opacity={0.08} wireframe />
        </mesh>
      </group>
    </Canvas>
  );
}

function XyyAxes(props: {
  readonly volume: NrrdVolume<Float32Array>;
  readonly deps: R3fDeps;
}) {
  const { Billboard, Text } = props.deps;
  const {
    metadata: {
      dimensions: { width, height, depth },
      spacing,
      origin,
    },
  } = props.volume;

  const displaySteps = getDisplaySteps(spacing);
  const sizeX = displaySteps.x * Math.max(1, width - 1);
  const sizeY = displaySteps.y * Math.max(1, height - 1);
  const sizeZ = displaySteps.Y * Math.max(1, depth - 1);
  const maxSize = Math.max(sizeX, sizeY, sizeZ, 0.001);
  const labelPadding = maxSize * 0.04;
  const labelFontSize = maxSize * 0.08;
  const sphereRadius = maxSize * 0.012;

  const corner = mapXyyToDisplay(origin.x, origin.y, origin.z);
  const xEnd = mapXyyToDisplay(
    origin.x + (width - 1) * spacing.xStep,
    origin.y,
    origin.z,
  );
  const xLabel: [number, number, number] = [xEnd[0] + labelPadding, xEnd[1], xEnd[2]];
  const yEnd = mapXyyToDisplay(
    origin.x,
    origin.y + (height - 1) * spacing.yStep,
    origin.z,
  );
  const yLabel: [number, number, number] = [yEnd[0], yEnd[1] + labelPadding, yEnd[2]];
  const zEnd = mapXyyToDisplay(
    origin.x,
    origin.y,
    origin.z + (depth - 1) * spacing.zStep,
  );
  const zLabel: [number, number, number] = [zEnd[0], zEnd[1], zEnd[2] + labelPadding];

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([...corner, ...xEnd]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1c1917" transparent opacity={0.92} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([...corner, ...yEnd]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1c1917" transparent opacity={0.92} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([...corner, ...zEnd]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1c1917" transparent opacity={0.92} />
      </line>

      <mesh position={xEnd}>
        <sphereGeometry args={[sphereRadius, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      <mesh position={yEnd}>
        <sphereGeometry args={[sphereRadius, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      <mesh position={zEnd}>
        <sphereGeometry args={[sphereRadius, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>

      <Billboard position={xLabel} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          color="#111827"
          fontSize={labelFontSize}
          anchorX="center"
          anchorY="middle"
          outlineWidth={labelFontSize * 0.08}
          outlineColor="#ffffff"
        >
          x
        </Text>
      </Billboard>
      <Billboard position={yLabel} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          color="#111827"
          fontSize={labelFontSize}
          anchorX="center"
          anchorY="middle"
          outlineWidth={labelFontSize * 0.08}
          outlineColor="#ffffff"
        >
          y
        </Text>
      </Billboard>
      <Billboard position={zLabel} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          color="#111827"
          fontSize={labelFontSize}
          anchorX="center"
          anchorY="middle"
          outlineWidth={labelFontSize * 0.08}
          outlineColor="#ffffff"
        >
          Y
        </Text>
      </Billboard>
    </group>
  );
}

function CieHorseshoe(props: {
  readonly volume: NrrdVolume<Float32Array>;
  readonly luminance: number;
  readonly spectralLocus: ReadonlyArray<SpectralLocusPoint>;
  readonly deps: R3fDeps;
}) {
  const { Line } = props.deps;
  const {
    metadata: {
      dimensions: { depth },
      spacing,
    },
  } = props.volume;

  const spectralPositions = useMemo(() => {
    const spectralPoints = props.spectralLocus.map(([x, y]) =>
      mapXyyToDisplay(x, y, props.luminance),
    );
    return buildLinePositions(spectralPoints);
  }, [props.luminance, props.spectralLocus]);
  const spectralPointList = useMemo(() => buildLinePointList(spectralPositions), [spectralPositions]);
  const spectralColors = useMemo<[number, number, number][]>(
    () =>
      props.spectralLocus.map(([x, y]) => {
        const color = chromaticityToApproxSrgb(x, y);
        return [color[0], color[1], color[2]];
      }),
    [props.spectralLocus],
  );

  const purpleLinePositions = useMemo(() => {
    const first = props.spectralLocus[0] ?? [0.1741, 0.005];
    const last =
      props.spectralLocus[props.spectralLocus.length - 1] ?? [0.7347, 0.2653];
    return buildLinePositions([
      mapXyyToDisplay(first[0], first[1], props.luminance),
      mapXyyToDisplay(last[0], last[1], props.luminance),
    ]);
  }, [props.luminance, props.spectralLocus]);
  const purpleLinePointList = useMemo(
    () => buildLinePointList(purpleLinePositions),
    [purpleLinePositions],
  );
  const purpleLineColors = useMemo<[number, number, number][]>(
    () => {
      const first = props.spectralLocus[0] ?? [0.1741, 0.005];
      const last =
        props.spectralLocus[props.spectralLocus.length - 1] ?? [0.7347, 0.2653];
      const start = chromaticityToApproxSrgb(first[0], first[1]);
      const end = chromaticityToApproxSrgb(last[0], last[1]);
      return [
        [start[0], start[1], start[2]],
        [end[0], end[1], end[2]],
      ];
    },
    [props.spectralLocus],
  );

  const offset =
    Math.abs(spacing.zStep) * Math.max(1, depth - 1) * XYY_LUMINANCE_DISPLAY_SCALE * XYY_DISPLAY_SCALE * 0.002;

  return (
    <group position={[0, 0, -offset]}>
      <Line
        points={spectralPointList}
        vertexColors={spectralColors}
        lineWidth={4.2}
        transparent
        opacity={0.95}
      />
      <Line
        points={purpleLinePointList}
        vertexColors={purpleLineColors}
        lineWidth={3.2}
        transparent
        opacity={0.84}
      />
    </group>
  );
}

function VolumeScene(props: {
  readonly volume: NrrdVolume<Float32Array>;
  readonly spectralLocus: ReadonlyArray<SpectralLocusPoint>;
  readonly xSlice: number;
  readonly ySlice: number;
  readonly zSlice: number;
  readonly horseshoeLuminance: number;
  readonly windowAbs: number;
  readonly isoThreshold: number;
  readonly renderMode: RenderMode;
  readonly projectionMode: ProjectionMode;
  readonly povDegrees: number;
  readonly maxAbs: number;
  readonly viewState: CameraViewState;
  readonly dragState: OrientationDragState | null;
  readonly onOrientationChange: (angles: OrientationAngles) => void;
  readonly deps: R3fDeps;
}) {
  const { Canvas, OrbitControls } = props.deps;
  const controlsRef = useRef<{
    readonly target: { set(x: number, y: number, z: number): void };
    update(): void;
  } | null>(null);
  const frame = useMemo(() => getVolumeFrame(props.volume), [props.volume]);
  const cloud = useMemo(
    () => buildSurfacePointCloud(props.volume, props.isoThreshold),
    [props.isoThreshold, props.volume],
  );

  return (
    <Canvas
      key={props.projectionMode}
      orthographic={props.projectionMode === "orthographic"}
      camera={
        props.projectionMode === "orthographic"
          ? { position: [180, -280, 210], zoom: 1 }
          : { position: [180, -280, 210], fov: props.povDegrees }
      }
    >
      <CameraViewController
        volume={props.volume}
        viewState={props.viewState}
        dragState={props.dragState}
        projectionMode={props.projectionMode}
        povDegrees={props.povDegrees}
        controlsRef={controlsRef}
        onOrientationChange={props.onOrientationChange}
        deps={props.deps}
      />
      <color attach="background" args={["#f4eee4"]} />
      <group>
        <VolumeBounds volume={props.volume} />
        <CieHorseshoe
          volume={props.volume}
          luminance={props.horseshoeLuminance}
          spectralLocus={props.spectralLocus}
          deps={props.deps}
        />
        <XyyAxes volume={props.volume} deps={props.deps} />
        {props.renderMode === "raymarch" ? (
          <VolumeRaymarch
            volume={props.volume}
            maxAbs={props.maxAbs}
            isoThreshold={props.isoThreshold}
          />
        ) : (
          <>
            <AxisSlice volume={props.volume} axis="x" sliceIndex={props.xSlice} windowAbs={props.windowAbs} />
            <AxisSlice volume={props.volume} axis="y" sliceIndex={props.ySlice} windowAbs={props.windowAbs} />
            <AxisSlice volume={props.volume} axis="z" sliceIndex={props.zSlice} windowAbs={props.windowAbs} />
            <SurfacePoints cloud={cloud} volume={props.volume} />
          </>
        )}
      </group>
      <OrbitControls
        enableDamping
        makeDefault
        key={props.viewState.token}
        minDistance={Math.max(frame.diagonal * 0.8, frame.maxSize * 1.2, 2.4)}
        maxDistance={Math.max(frame.diagonal * 6, frame.maxSize * 10, 24)}
        onChange={(event) => {
          const cameraObject = event?.target?.object;
          const targetObject = event?.target?.target;
          if (!cameraObject || !targetObject) {
            return;
          }
          props.onOrientationChange(
            computeOrientationAngles(
              [cameraObject.position.x, cameraObject.position.y, cameraObject.position.z],
              [targetObject.x, targetObject.y, targetObject.z],
            ),
          );
        }}
        ref={(instance) => {
          controlsRef.current = instance as typeof controlsRef.current;
        }}
      />
    </Canvas>
  );
}

function MetaCard(props: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="rounded-[1rem] bg-[#f7f1e5] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">{props.label}</div>
      <div className="mt-1.5 break-words text-[0.92rem] font-semibold leading-5">{props.value}</div>
    </div>
  );
}

async function loadVolumeBytes(fileName: string, bytes: Uint8Array): Promise<LoadedVolume> {
  return {
    fileName,
    fileSize: bytes.byteLength,
    volume: parseNrrd(bytes),
  };
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export default function NrrdRoute() {
  const fileInputId = useId();
  const [volume, setVolume] = useState<LoadedVolume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [presets, setPresets] = useState<readonly NrrdPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [windowScale, setWindowScale] = useState(0.2);
  const [surfaceScale, setSurfaceScale] = useState(0.03);
  const [renderMode, setRenderMode] = useState<RenderMode>("slices");
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("perspective");
  const [povDegrees, setPovDegrees] = useState(36);
  const [horseshoeLuminance, setHorseshoeLuminance] = useState(0);
  const [spectralLocus, setSpectralLocus] = useState<ReadonlyArray<SpectralLocusPoint>>(
    CIE_1931_SPECTRAL_LOCUS,
  );
  const [xSlice, setXSlice] = useState(0);
  const [ySlice, setYSlice] = useState(0);
  const [zSlice, setZSlice] = useState(0);
  const [viewState, setViewState] = useState<CameraViewState>({ name: "top", token: 0 });
  const [dragState, setDragState] = useState<OrientationDragState | null>(null);
  const [orientation, setOrientation] = useState<OrientationAngles>({ pitch: -90, yaw: 0 });
  const [r3fDeps, setR3fDeps] = useState<R3fDeps | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadR3fDeps() {
      const [{ Canvas, useThree }, { Billboard, Line, OrbitControls, Text }] = await Promise.all([
        import("@react-three/fiber"),
        import("@react-three/drei"),
      ]);
      if (!cancelled) {
        setR3fDeps({ Billboard, Canvas, Line, OrbitControls, Text, useThree });
      }
    }

    void loadR3fDeps();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSpectralLocus() {
      try {
        const response = await fetch("/api/cie-1931-2deg");
        if (!response.ok) {
          throw new Error(`Failed to load CIE spectral locus: ${response.status}`);
        }
        const csv = await response.text();
        const points = csv
          .trim()
          .split(/\r?\n/)
          .slice(1)
          .map((line) => line.split(","))
          .map(([x, y]) => [Number(x), Number(y)] as const)
          .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
        if (!cancelled && points.length > 1) {
          setSpectralLocus(points);
        }
      } catch {
        if (!cancelled) {
          setSpectralLocus(CIE_1931_SPECTRAL_LOCUS);
        }
      }
    }

    void loadSpectralLocus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPresets() {
      try {
        const response = await fetch("/api/nrrd-presets");
        if (!response.ok) {
          throw new Error(`Failed to load presets: ${response.status}`);
        }
        const payload = (await response.json()) as { presets?: NrrdPreset[] };
        if (!cancelled) {
          setPresets(payload.presets ?? []);
        }
      } catch {
        if (!cancelled) {
          setPresets([]);
        }
      }
    }

    void loadPresets();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => (volume ? computeStats(volume.volume.data) : null),
    [volume],
  );

  const windowAbs = (stats?.maxAbs ?? 1) * Math.max(0.0001, windowScale);
  const isoThreshold = (stats?.maxAbs ?? 1) * Math.max(0.0005, surfaceScale);

  useEffect(() => {
    if (!volume) {
      return;
    }
    startTransition(() => {
      setXSlice(Math.floor(volume.volume.metadata.dimensions.width / 2));
      setYSlice(Math.floor(volume.volume.metadata.dimensions.height / 2));
      setZSlice(Math.floor(volume.volume.metadata.dimensions.depth / 2));
      setHorseshoeLuminance(volume.volume.metadata.origin.z);
    });
  }, [volume]);

  async function loadFromFile(file: File) {
    setIsBusy(true);
    setError(null);
    startTransition(() => {
      setVolume(null);
      setSelectedPreset("");
    });
    await nextTick();

    try {
      const bytes = await loadFileBytes(file);
      const loaded = await loadVolumeBytes(file.name, bytes);

      startTransition(() => {
        setVolume(loaded);
        setSelectedPreset("");
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown NRRD parse error";
      startTransition(() => {
        setVolume(null);
        setError(message);
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function loadPreset(nextPath: string) {
    const preset = presets.find((entry) => entry.path === nextPath);
    if (!preset) {
      return;
    }

    setIsBusy(true);
    setError(null);
    startTransition(() => {
      setVolume(null);
    });
    await nextTick();

    try {
      const response = await fetch(`/api/nrrd-presets/file?path=${encodeURIComponent(preset.path)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch preset: ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const loaded = await loadVolumeBytes(preset.fileName, bytes);

      startTransition(() => {
        setVolume(loaded);
        setSelectedPreset(preset.path);
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown NRRD preset error";
      startTransition(() => {
        setError(message);
      });
    } finally {
      setIsBusy(false);
    }
  }

  const dims = volume?.volume.metadata.dimensions;
  const selectView = (name: CameraView) => {
    setDragState(null);
    setViewState((current) => ({
      name,
      token: current.token + 1,
    }));
  };

  return (
    <>
      <Head>
        <title>NRRD Viewer</title>
      </Head>
      <main className="min-h-screen text-stone-900">
        <div className="pointer-events-none fixed inset-0 opacity-70">
          <div className="absolute left-[-10%] top-[-8%] h-[28rem] w-[28rem] rounded-full bg-[#f97316]/18 blur-3xl" />
          <div className="absolute bottom-[-12%] right-[-6%] h-[26rem] w-[26rem] rounded-full bg-[#0f766e]/18 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-[96rem] flex-col gap-5 px-4 py-5 lg:px-6">
          <header className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
            <section className="rounded-[1.6rem] border border-black/8 bg-[#13110f] px-5 py-5 text-stone-50 shadow-[0_24px_70px_rgba(40,24,10,0.18)]">
              <div className="mb-3 inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-orange-200">
                /nrrd
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Inspect a
                <span className="block text-[#fdba74]">3D NRRD volume</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
                Open the generated SDF volumes from `icc2sdf`, inspect them in xyY space, scrub three orthogonal slices, and orbit the volume in 3D with react-three-fiber.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="inline-flex rounded-full border border-white/14 px-4 py-2 text-sm text-stone-100 no-underline transition hover:bg-white/8" href="/">
                  Back to index
                </Link>
                <Link className="inline-flex rounded-full border border-white/14 px-4 py-2 text-sm text-stone-100 no-underline transition hover:bg-white/8" href="/icc">
                  Open ICC inspector
                </Link>
              </div>
            </section>

            <div
              className="group flex min-h-[220px] cursor-pointer flex-col justify-between rounded-[1.6rem] border border-dashed border-black/15 bg-white/70 p-5 shadow-[0_18px_40px_rgba(88,65,34,0.1)] backdrop-blur"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void loadFromFile(file);
              }}
            >
              <div>
                <span className="inline-flex rounded-full bg-stone-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-stone-100">
                  Drop .nrrd
                </span>
                <div className="mt-3 text-xl font-semibold tracking-[-0.03em] text-stone-900">Open a NRRD volume</div>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Load a local volume or choose a preset generated from `icc-profiles`.
                </p>
                <div className="mt-4 rounded-[1rem] border border-black/8 bg-white/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-stone-500">
                    <span>Preset Volumes</span>
                    <span>{presets.length}</span>
                  </div>
                  <select
                    className="w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-700/55 focus:shadow-[0_0_0_4px_rgba(15,118,110,0.11)]"
                    value={selectedPreset}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSelectedPreset(next);
                      if (next) {
                        void loadPreset(next);
                      }
                    }}
                  >
                    <option value="">Choose from icc2sdf/tmp...</option>
                    {presets.map((preset) => (
                      <option key={preset.path} value={preset.path}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[1rem] bg-stone-900 px-4 py-3 text-sm text-stone-100 transition group-hover:bg-[#0f766e]">
                <label
                  className="cursor-pointer rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-stone-50 transition hover:bg-white/8"
                  htmlFor={fileInputId}
                >
                  {isBusy ? "Loading..." : "Choose volume"}
                </label>
                <span className="max-w-[12rem] truncate text-stone-300">{volume ? volume.fileName : "No file loaded"}</span>
              </div>
              <input
                id={fileInputId}
                className="hidden"
                type="file"
                accept=".nrrd,application/octet-stream"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0];
                  if (file) void loadFromFile(file);
                }}
              />
            </div>
          </header>

          {error ? (
            <section className="rounded-[1.6rem] border border-red-900/15 bg-red-50 px-5 py-4 text-sm text-red-900">
              Parse failed: {error}
            </section>
          ) : null}

          {volume && stats ? (
            <>
              <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="overflow-hidden rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                  <div className="flex items-baseline justify-between gap-4 border-b border-black/8 px-4 py-3">
                    <h2>Volume View</h2>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded-full border border-black/10 bg-white/70 p-1 text-[11px] uppercase tracking-[0.12em] text-stone-700">
                        <button
                          className={`rounded-full px-3 py-1 transition ${renderMode === "slices" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
                          type="button"
                          onClick={() => setRenderMode("slices")}
                        >
                          Slice + points
                        </button>
                        <button
                          className={`rounded-full px-3 py-1 transition ${renderMode === "raymarch" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
                          type="button"
                          onClick={() => setRenderMode("raymarch")}
                        >
                          Raymarch
                        </button>
                      </div>
                      <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">
                        {dims?.width} × {dims?.height} × {dims?.depth}
                      </span>
                    </div>
                  </div>
                  <div className="h-[38rem]">
                    {r3fDeps ? (
                      <div className="relative h-full">
                        <div className="absolute right-3 top-3 z-10 h-28 w-28 overflow-hidden rounded-[1rem] border border-black/10 bg-white/82 shadow-[0_12px_28px_rgba(70,48,22,0.12)] backdrop-blur">
                          <OrientationWidgetScene
                            deps={r3fDeps}
                            orientation={orientation}
                            onSelectView={selectView}
                            onDragOrientation={(nextOrientation) => {
                              setOrientation(nextOrientation);
                              setDragState((current) => ({
                                angles: nextOrientation,
                                token: (current?.token ?? 0) + 1,
                              }));
                            }}
                          />
                          <button
                            className="absolute right-2 top-2 rounded-full border border-black/12 bg-stone-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white shadow-sm"
                            type="button"
                            onClick={() => {
                              setDragState(null);
                              selectView("iso");
                            }}
                          >
                            Iso
                          </button>
                        </div>
                        <VolumeScene
                          volume={volume.volume}
                          spectralLocus={spectralLocus}
                          xSlice={xSlice}
                          ySlice={ySlice}
                          zSlice={zSlice}
                          horseshoeLuminance={horseshoeLuminance}
                          windowAbs={windowAbs}
                          isoThreshold={isoThreshold}
                          renderMode={renderMode}
                          projectionMode={projectionMode}
                          povDegrees={povDegrees}
                          maxAbs={stats.maxAbs}
                          viewState={viewState}
                          dragState={dragState}
                          onOrientationChange={setOrientation}
                          deps={r3fDeps}
                        />
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-stone-500">
                        Loading 3D viewer...
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <section className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <h2>Volume Overview</h2>
                      <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">Metadata</span>
                    </div>
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                      <MetaCard label="File" value={volume.fileName} />
                      <MetaCard label="Size" value={formatBytes(volume.fileSize)} />
                      <MetaCard label="Dimensions" value={`${dims?.width} × ${dims?.height} × ${dims?.depth}`} />
                      <MetaCard
                        label="Spacing"
                        value={`x ${volume.volume.metadata.spacing.xStep.toFixed(3)} / y ${volume.volume.metadata.spacing.yStep.toFixed(3)} / Y ${volume.volume.metadata.spacing.zStep.toFixed(3)}`}
                      />
                      <MetaCard
                        label="Origin"
                        value={`x ${volume.volume.metadata.origin.x.toFixed(3)}, y ${volume.volume.metadata.origin.y.toFixed(3)}, Y ${volume.volume.metadata.origin.z.toFixed(3)}`}
                      />
                      <MetaCard label="Range" value={`${stats.min.toFixed(3)} .. ${stats.max.toFixed(3)}`} />
                    </div>
                  </section>

                  <section className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <h2>Slice Controls</h2>
                      <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">
                        {renderMode === "raymarch" ? "Disabled in raymarch mode" : "Three axes"}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      <label className="grid gap-1.5 text-sm text-stone-700">
                        <span>x slice ({xSlice})</span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, (dims?.width ?? 1) - 1)}
                          value={xSlice}
                          onChange={(event) => setXSlice(Number(event.target.value))}
                          disabled={renderMode === "raymarch"}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm text-stone-700">
                        <span>y slice ({ySlice})</span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, (dims?.height ?? 1) - 1)}
                          value={ySlice}
                          onChange={(event) => setYSlice(Number(event.target.value))}
                          disabled={renderMode === "raymarch"}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm text-stone-700">
                        <span>Y slice ({zSlice})</span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, (dims?.depth ?? 1) - 1)}
                          value={zSlice}
                          onChange={(event) => setZSlice(Number(event.target.value))}
                          disabled={renderMode === "raymarch"}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <h2>Display Controls</h2>
                      <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">Window and surface</span>
                    </div>
                    <div className="grid gap-3">
                      <label className="grid gap-1.5 text-sm text-stone-700">
                        <span>{renderMode === "raymarch" ? "Density window" : "Slice window"} ({windowAbs.toFixed(2)})</span>
                        <input
                          type="range"
                          min={0.01}
                          max={1}
                          step={0.01}
                          value={windowScale}
                          onChange={(event) => setWindowScale(Number(event.target.value))}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm text-stone-700">
                        <span>{renderMode === "raymarch" ? "Surface glow width" : "Near-surface threshold"} ({isoThreshold.toFixed(2)})</span>
                        <input
                          type="range"
                          min={0.002}
                          max={0.2}
                          step={0.002}
                          value={surfaceScale}
                          onChange={(event) => setSurfaceScale(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-4 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <h2>View Controls</h2>
                      <span className="text-[0.82rem] uppercase tracking-[0.12em] text-stone-600">Projection and overlays</span>
                    </div>
                    <div className="grid gap-3">
                      <div className="inline-flex w-fit rounded-full border border-black/10 bg-white/70 p-1 text-[11px] uppercase tracking-[0.12em] text-stone-700">
                        <button
                          className={`rounded-full px-3 py-1 transition ${projectionMode === "perspective" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
                          type="button"
                          onClick={() => setProjectionMode("perspective")}
                        >
                          Perspective
                        </button>
                        <button
                          className={`rounded-full px-3 py-1 transition ${projectionMode === "orthographic" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
                          type="button"
                          onClick={() => setProjectionMode("orthographic")}
                        >
                          Orthographic
                        </button>
                      </div>
                      <label className="grid gap-1.5 text-sm text-stone-700">
                        <span>FOV ({povDegrees.toFixed(0)}°)</span>
                        <input
                          type="range"
                          min={18}
                          max={72}
                          step={1}
                          value={povDegrees}
                          onChange={(event) => setPovDegrees(Number(event.target.value))}
                          disabled={projectionMode === "orthographic"}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm text-stone-700">
                        <span>Horseshoe Y ({horseshoeLuminance.toFixed(3)})</span>
                        <input
                          type="range"
                          min={volume.volume.metadata.origin.z}
                          max={volume.volume.metadata.origin.z + Math.max(0, (dims?.depth ?? 1) - 1) * volume.volume.metadata.spacing.zStep}
                          step={Math.max(volume.volume.metadata.spacing.zStep, 0.001)}
                          value={horseshoeLuminance}
                          onChange={(event) => setHorseshoeLuminance(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </section>
                </div>
              </section>
            </>
          ) : (
            <section className="grid min-h-[220px] place-items-center rounded-[1.4rem] border border-black/8 bg-[rgba(255,252,246,0.84)] p-5 text-center leading-7 text-stone-600 shadow-[0_16px_36px_rgba(70,48,22,0.08)] backdrop-blur">
              <div>
                No NRRD volume is loaded yet. Choose a generated SDF preset or upload a local `.nrrd` file to inspect it in 3D.
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
