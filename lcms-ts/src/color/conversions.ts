import type { CmsCIELab, CmsCIELCh, CmsCIEXYZ, CmsCIExyY } from "../types/color.js";

export const CMS_D50_XYZ: Readonly<CmsCIEXYZ> = {
  X: 0.9642,
  Y: 1,
  Z: 0.8249,
};

export const CMS_D50_xyY: Readonly<CmsCIExyY> = {
  x: 0.345702914918791,
  y: 0.3585385966799326,
  Y: 1,
};

const XYZ_EPSILON = 216 / 24389;
const XYZ_KAPPA = 24389 / 27;
const DEGREE_PER_RADIAN = 180 / Math.PI;
const RADIAN_PER_DEGREE = Math.PI / 180;

function cubeRootOrLinearComponent(value: number): number {
  return value > XYZ_EPSILON ? Math.cbrt(value) : (XYZ_KAPPA * value + 16) / 116;
}

function inverseCubeRootOrLinearComponent(value: number): number {
  const cubic = value ** 3;
  return cubic > XYZ_EPSILON ? cubic : (116 * value - 16) / XYZ_KAPPA;
}

export function cmsD50XYZ(): CmsCIEXYZ {
  return { ...CMS_D50_XYZ };
}

export function cmsD50xyY(): CmsCIExyY {
  return { ...CMS_D50_xyY };
}

export function cmsXYZ2xyY(source: CmsCIEXYZ): CmsCIExyY {
  const sum = source.X + source.Y + source.Z;

  if (sum === 0) {
    return { x: CMS_D50_xyY.x, y: CMS_D50_xyY.y, Y: source.Y };
  }

  return {
    x: source.X / sum,
    y: source.Y / sum,
    Y: source.Y,
  };
}

export function cmsxyY2XYZ(source: CmsCIExyY): CmsCIEXYZ {
  if (source.y === 0) {
    return { X: 0, Y: source.Y, Z: 0 };
  }

  return {
    X: (source.x * source.Y) / source.y,
    Y: source.Y,
    Z: ((1 - source.x - source.y) * source.Y) / source.y,
  };
}

export function cmsXYZ2Lab(
  whitePoint: CmsCIEXYZ,
  xyz: CmsCIEXYZ,
): CmsCIELab {
  const fx = cubeRootOrLinearComponent(xyz.X / whitePoint.X);
  const fy = cubeRootOrLinearComponent(xyz.Y / whitePoint.Y);
  const fz = cubeRootOrLinearComponent(xyz.Z / whitePoint.Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function cmsLab2XYZ(
  whitePoint: CmsCIEXYZ,
  lab: CmsCIELab,
): CmsCIEXYZ {
  const fy = (lab.L + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;

  return {
    X: whitePoint.X * inverseCubeRootOrLinearComponent(fx),
    Y: whitePoint.Y * inverseCubeRootOrLinearComponent(fy),
    Z: whitePoint.Z * inverseCubeRootOrLinearComponent(fz),
  };
}

export function cmsLab2LCh(lab: CmsCIELab): CmsCIELCh {
  const C = Math.hypot(lab.a, lab.b);
  let h = Math.atan2(lab.b, lab.a) * DEGREE_PER_RADIAN;

  if (h < 0) {
    h += 360;
  }

  return { L: lab.L, C, h };
}

export function cmsLCh2Lab(lch: CmsCIELCh): CmsCIELab {
  const angle = lch.h * RADIAN_PER_DEGREE;
  return {
    L: lch.L,
    a: lch.C * Math.cos(angle),
    b: lch.C * Math.sin(angle),
  };
}
