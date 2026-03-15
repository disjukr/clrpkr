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

type R3fDeps = {
  readonly Canvas: typeof import("@react-three/fiber").Canvas;
  readonly Billboard: typeof import("@react-three/drei").Billboard;
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

function mapLabToDisplay(l: number, a: number, b: number): [number, number, number] {
  return [a, l, b];
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

  let textureWidth = 1;
  let textureHeight = 1;
  let physicalWidth = 1;
  let physicalHeight = 1;
  let position: [number, number, number] = [0, 0, 0];
  let rotation: [number, number, number] = [0, 0, 0];

  if (axis === "z") {
    textureWidth = width;
    textureHeight = height;
    physicalWidth = Math.max(spacing.yStep, Math.abs(spacing.yStep) * (height - 1));
    physicalHeight = Math.max(spacing.xStep, Math.abs(spacing.xStep) * (width - 1));
    position = mapLabToDisplay(
      origin.x + (width - 1) * spacing.xStep * 0.5,
      origin.y + (height - 1) * spacing.yStep * 0.5,
      origin.z + sliceIndex * spacing.zStep,
    );
  } else if (axis === "y") {
    textureWidth = width;
    textureHeight = depth;
    physicalWidth = Math.max(spacing.zStep, Math.abs(spacing.zStep) * (depth - 1));
    physicalHeight = Math.max(spacing.xStep, Math.abs(spacing.xStep) * (width - 1));
    position = mapLabToDisplay(
      origin.x + (width - 1) * spacing.xStep * 0.5,
      origin.y + sliceIndex * spacing.yStep,
      origin.z + (depth - 1) * spacing.zStep * 0.5,
    );
    rotation = [0, Math.PI / 2, 0];
  } else {
    textureWidth = height;
    textureHeight = depth;
    physicalWidth = Math.max(spacing.yStep, Math.abs(spacing.yStep) * (height - 1));
    physicalHeight = Math.max(spacing.zStep, Math.abs(spacing.zStep) * (depth - 1));
    position = mapLabToDisplay(
      origin.x + sliceIndex * spacing.xStep,
      origin.y + (height - 1) * spacing.yStep * 0.5,
      origin.z + (depth - 1) * spacing.zStep * 0.5,
    );
    rotation = [-Math.PI / 2, 0, 0];
  }

  const rgba = new Uint8Array(textureWidth * textureHeight * 4);

  for (let row = 0; row < textureHeight; row += 1) {
    for (let column = 0; column < textureWidth; column += 1) {
      const x = axis === "x" ? sliceIndex : column;
      const y = axis === "z" ? row : axis === "y" ? sliceIndex : column;
      const z = axis === "z" ? sliceIndex : row;
      const value = data[volumeIndex(width, height, x, y, z)] ?? 0;
      const [r, g, b, a] = scalarToRgba(value, windowAbs);
      const offset = (column + textureWidth * (textureHeight - 1 - row)) * 4;
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
          ...mapLabToDisplay(
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
  const sizeX = Math.abs(spacing.xStep) * Math.max(1, width - 1);
  const sizeY = Math.abs(spacing.yStep) * Math.max(1, height - 1);
  const sizeZ = Math.abs(spacing.zStep) * Math.max(1, depth - 1);
  const center = mapLabToDisplay(
    origin.x + (width - 1) * spacing.xStep * 0.5,
    origin.y + (height - 1) * spacing.yStep * 0.5,
    origin.z + (depth - 1) * spacing.zStep * 0.5,
  );

  return (
    <mesh position={center}>
      <boxGeometry args={[sizeY, sizeX, sizeZ]} />
      <meshBasicMaterial color="#1c1917" wireframe transparent opacity={0.16} />
    </mesh>
  );
}

function SurfacePoints(props: { readonly cloud: SurfacePointCloud }) {
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
      <pointsMaterial size={2.8} sizeAttenuation vertexColors transparent opacity={0.78} />
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
  const boxScale = [
    Math.abs(spacing.yStep) * Math.max(1, height - 1),
    Math.abs(spacing.xStep) * Math.max(1, width - 1),
    Math.abs(spacing.zStep) * Math.max(1, depth - 1),
  ] as const;

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
      labMin: {
        value: [
          volume.metadata.origin.y,
          volume.metadata.origin.x,
          volume.metadata.origin.z,
        ],
      },
      labSpan: {
        value: [
          Math.abs(volume.metadata.spacing.yStep) * Math.max(1, height - 1),
          Math.abs(volume.metadata.spacing.xStep) * Math.max(1, width - 1),
          Math.abs(volume.metadata.spacing.zStep) * Math.max(1, depth - 1),
        ],
      },
      texelSize: { value: [1 / Math.max(width, 1), 1 / Math.max(height, 1), 1 / Math.max(depth, 1)] },
      maxAbs: { value: Math.max(maxAbs, 0.0001) },
      isoThreshold: { value: Math.max(isoThreshold, 0.0001) },
      stepCount: { value: 96 },
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
      uniform vec3 labMin;
      uniform vec3 labSpan;
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

      vec3 localPointToLab(vec3 localPoint) {
        return labMin + (localPoint + 0.5) * labSpan;
      }

      vec3 labToXyzD50(vec3 lab) {
        float fy = (lab.x + 16.0) / 116.0;
        float fx = fy + lab.y / 500.0;
        float fz = fy - lab.z / 200.0;

        float epsilon = 216.0 / 24389.0;
        float kappa = 24389.0 / 27.0;

        float xr = pow(fx, 3.0) > epsilon ? pow(fx, 3.0) : (116.0 * fx - 16.0) / kappa;
        float yr = lab.x > (kappa * epsilon) ? pow((lab.x + 16.0) / 116.0, 3.0) : lab.x / kappa;
        float zr = pow(fz, 3.0) > epsilon ? pow(fz, 3.0) : (116.0 * fz - 16.0) / kappa;

        return vec3(
          xr * 0.9642,
          yr * 1.0,
          zr * 0.8251
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

      float refineSurfaceHit(vec3 rayOrigin, vec3 rayDir, float nearT, float farT) {
        float a = nearT;
        float b = farT;
        float fa = sampleSdf(rayOrigin + rayDir * a);
        for (int i = 0; i < 6; i++) {
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

      void main() {
        vec3 rayOrigin = (inverseModelMatrix * vec4(cameraPosition, 1.0)).xyz;
        vec3 rayDir = normalize(vLocalPosition - rayOrigin);
        vec2 hit = intersectBox(rayOrigin, rayDir);

        if (hit.x > hit.y || hit.y < 0.0) {
          discard;
        }

        float t = max(hit.x, 0.0);
        float tEnd = hit.y;
        float hitThreshold = max(isoThreshold * 0.22, 0.0025);
        float previousT = t;
        float previousSdf = sampleSdf(rayOrigin + rayDir * t);
        float rayMetric = max(length(rayDir * boxScale), 1e-4);

        for (float i = 0.0; i < 256.0; i += 1.0) {
          if (i >= stepCount || t > tEnd) {
            break;
          }

          vec3 samplePoint = rayOrigin + rayDir * t;
          float sdf = sampleSdf(samplePoint);
          float absSdf = abs(sdf);

          if (absSdf <= hitThreshold || sdf * previousSdf < 0.0) {
            float refinedT = absSdf <= hitThreshold ? t : refineSurfaceHit(rayOrigin, rayDir, previousT, t);
            samplePoint = rayOrigin + rayDir * refinedT;
            sdf = sampleSdf(samplePoint);
            vec3 normal = sampleGradient(samplePoint);
            vec3 lab = localPointToLab(samplePoint);
            vec3 base = xyzD50ToSrgb(labToXyzD50(lab));
            vec3 lightDir = normalize(vec3(0.45, 0.72, 0.55));
            vec3 viewDir = normalize(rayOrigin - samplePoint);
            float diffuse = max(dot(normal, lightDir), 0.0);
            float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);
            float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
            vec3 coolLift = vec3(0.16, 0.74, 0.98) * fresnel * 0.12;
            vec3 color = base * (0.45 + diffuse * 0.75) + vec3(1.0, 1.0, 1.0) * rim * 0.06 + coolLift;
            outColor = vec4(color, 1.0);
            return;
          }

          previousT = t;
          previousSdf = sdf;
          t += clamp(absSdf / rayMetric, 0.0015, 0.04);
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

  const sizeX = Math.abs(spacing.xStep) * Math.max(1, width - 1);
  const sizeY = Math.abs(spacing.yStep) * Math.max(1, height - 1);
  const sizeZ = Math.abs(spacing.zStep) * Math.max(1, depth - 1);
  const center = mapLabToDisplay(
    origin.x + (width - 1) * spacing.xStep * 0.5,
    origin.y + (height - 1) * spacing.yStep * 0.5,
    origin.z + (depth - 1) * spacing.zStep * 0.5,
  );

  return (
    <mesh ref={meshRef} position={center} scale={[sizeY, sizeX, sizeZ]} renderOrder={5}>
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

  const sizeX = Math.abs(spacing.xStep) * Math.max(1, width - 1);
  const sizeY = Math.abs(spacing.yStep) * Math.max(1, height - 1);
  const sizeZ = Math.abs(spacing.zStep) * Math.max(1, depth - 1);
  const center = mapLabToDisplay(
    origin.x + (width - 1) * spacing.xStep * 0.5,
    origin.y + (height - 1) * spacing.yStep * 0.5,
    origin.z + (depth - 1) * spacing.zStep * 0.5,
  );

  return {
    center,
    maxSize: Math.max(sizeY, sizeX, sizeZ),
  };
}

function getCameraPositionForView(
  volume: NrrdVolume<Float32Array>,
  view: CameraView,
): [number, number, number] {
  const { center, maxSize } = getVolumeFrame(volume);
  const distance = Math.max(80, maxSize * 1.4);

  switch (view) {
    case "front":
      return [center[0], center[1], center[2] + distance];
    case "back":
      return [center[0], center[1], center[2] - distance];
    case "left":
      return [center[0] - distance, center[1], center[2]];
    case "right":
      return [center[0] + distance, center[1], center[2]];
    case "top":
      return [center[0], center[1] + distance, center[2]];
    case "bottom":
      return [center[0], center[1] - distance, center[2]];
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
  const distance = Math.max(80, maxSize * 1.4);
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
  readonly controlsRef: React.MutableRefObject<{
    readonly target: { set(x: number, y: number, z: number): void };
    update(): void;
  } | null>;
  readonly onOrientationChange: (angles: OrientationAngles) => void;
  readonly deps: R3fDeps;
}) {
  const { camera } = props.deps.useThree();

  useEffect(() => {
    const { center } = getVolumeFrame(props.volume);
    const position =
      props.dragState == null
        ? getCameraPositionForView(props.volume, props.viewState.name)
        : getCameraPositionForOrientation(props.volume, props.dragState.angles);

    camera.position.set(position[0], position[1], position[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(center[0], center[1], center[2]);

    props.controlsRef.current?.target.set(center[0], center[1], center[2]);
    props.controlsRef.current?.update();
    props.onOrientationChange(computeOrientationAngles(position, center));
  }, [
    camera,
    props.controlsRef,
    props.dragState,
    props.onOrientationChange,
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
            position: [0, 0, 1.02],
            rotation: [0, 0, 0],
          },
          {
            view: "back",
            label: "Back",
            position: [0, 0, -1.02],
            rotation: [0, Math.PI, 0],
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
            position: [0, 1.02, 0],
            rotation: [-Math.PI / 2, 0, 0],
          },
          {
            view: "bottom",
            label: "Bottom",
            position: [0, -1.02, 0],
            rotation: [Math.PI / 2, 0, 0],
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

function LabAxes(props: {
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

  const corner = mapLabToDisplay(origin.x - 12, origin.y - 12, origin.z - 12);
  const xEnd = mapLabToDisplay(origin.x - 12, origin.y + (height - 1) * spacing.yStep + 18, origin.z - 12);
  const xLabel: [number, number, number] = [xEnd[0] + 10, xEnd[1], xEnd[2]];
  const yEnd = mapLabToDisplay(origin.x + (width - 1) * spacing.xStep + 18, origin.y - 12, origin.z - 12);
  const yLabel: [number, number, number] = [yEnd[0], yEnd[1] + 10, yEnd[2]];
  const zEnd = mapLabToDisplay(origin.x - 12, origin.y - 12, origin.z + (depth - 1) * spacing.zStep + 18);
  const zLabel: [number, number, number] = [zEnd[0], zEnd[1], zEnd[2] + 10];

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
        <sphereGeometry args={[2.3, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      <mesh position={yEnd}>
        <sphereGeometry args={[2.3, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      <mesh position={zEnd}>
        <sphereGeometry args={[2.3, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>

      <Billboard position={xLabel} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          color="#111827"
          fontSize={9}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.75}
          outlineColor="#ffffff"
        >
          a
        </Text>
      </Billboard>
      <Billboard position={yLabel} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          color="#111827"
          fontSize={9}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.75}
          outlineColor="#ffffff"
        >
          L
        </Text>
      </Billboard>
      <Billboard position={zLabel} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          color="#111827"
          fontSize={9}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.75}
          outlineColor="#ffffff"
        >
          b
        </Text>
      </Billboard>
    </group>
  );
}

function VolumeScene(props: {
  readonly volume: NrrdVolume<Float32Array>;
  readonly xSlice: number;
  readonly ySlice: number;
  readonly zSlice: number;
  readonly windowAbs: number;
  readonly isoThreshold: number;
  readonly renderMode: RenderMode;
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
  const cloud = useMemo(
    () => buildSurfacePointCloud(props.volume, props.isoThreshold),
    [props.isoThreshold, props.volume],
  );

  return (
    <Canvas camera={{ position: [180, -280, 210], fov: 36 }}>
      <CameraViewController
        volume={props.volume}
        viewState={props.viewState}
        dragState={props.dragState}
        controlsRef={controlsRef}
        onOrientationChange={props.onOrientationChange}
        deps={props.deps}
      />
      <color attach="background" args={["#f4eee4"]} />
      <group>
        <VolumeBounds volume={props.volume} />
        <LabAxes volume={props.volume} deps={props.deps} />
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
            <SurfacePoints cloud={cloud} />
          </>
        )}
      </group>
      <OrbitControls
        enableDamping
        makeDefault
        key={props.viewState.token}
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
  const [xSlice, setXSlice] = useState(0);
  const [ySlice, setYSlice] = useState(0);
  const [zSlice, setZSlice] = useState(0);
  const [viewState, setViewState] = useState<CameraViewState>({ name: "iso", token: 0 });
  const [dragState, setDragState] = useState<OrientationDragState | null>(null);
  const [orientation, setOrientation] = useState<OrientationAngles>({ pitch: -28, yaw: 34 });
  const [r3fDeps, setR3fDeps] = useState<R3fDeps | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadR3fDeps() {
      const [{ Canvas, useThree }, { Billboard, OrbitControls, Text }] = await Promise.all([
        import("@react-three/fiber"),
        import("@react-three/drei"),
      ]);
      if (!cancelled) {
        setR3fDeps({ Billboard, Canvas, OrbitControls, Text, useThree });
      }
    }

    void loadR3fDeps();
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
                Open the generated SDF volumes from `icc2sdf`, scrub three orthogonal slices, and orbit the volume in 3D with react-three-fiber.
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
                          xSlice={xSlice}
                          ySlice={ySlice}
                          zSlice={zSlice}
                          windowAbs={windowAbs}
                          isoThreshold={isoThreshold}
                          renderMode={renderMode}
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
                        value={`${volume.volume.metadata.spacing.xStep.toFixed(2)} / ${volume.volume.metadata.spacing.yStep.toFixed(2)} / ${volume.volume.metadata.spacing.zStep.toFixed(2)}`}
                      />
                      <MetaCard
                        label="Origin"
                        value={`${volume.volume.metadata.origin.x.toFixed(1)}, ${volume.volume.metadata.origin.y.toFixed(1)}, ${volume.volume.metadata.origin.z.toFixed(1)}`}
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
                        <span>a slice ({xSlice})</span>
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
                        <span>L slice ({ySlice})</span>
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
                        <span>b slice ({zSlice})</span>
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
