const IDENTITY_TOLERANCE = 1 / 65535;
const MATRIX_DETERMINANT_TOLERANCE = 1e-9;

export interface CmsVEC3 {
  n: [number, number, number];
}

export interface CmsMAT3 {
  v: [CmsVEC3, CmsVEC3, CmsVEC3];
}

export function cmsVEC3init(x: number, y: number, z: number): CmsVEC3 {
  return { n: [x, y, z] };
}

export function cmsVEC3minus(a: CmsVEC3, b: CmsVEC3): CmsVEC3 {
  return cmsVEC3init(a.n[0] - b.n[0], a.n[1] - b.n[1], a.n[2] - b.n[2]);
}

export function cmsVEC3cross(u: CmsVEC3, v: CmsVEC3): CmsVEC3 {
  return cmsVEC3init(
    u.n[1] * v.n[2] - v.n[1] * u.n[2],
    u.n[2] * v.n[0] - v.n[2] * u.n[0],
    u.n[0] * v.n[1] - v.n[0] * u.n[1],
  );
}

export function cmsVEC3dot(u: CmsVEC3, v: CmsVEC3): number {
  return u.n[0] * v.n[0] + u.n[1] * v.n[1] + u.n[2] * v.n[2];
}

export function cmsVEC3length(a: CmsVEC3): number {
  return Math.hypot(a.n[0], a.n[1], a.n[2]);
}

export function cmsVEC3distance(a: CmsVEC3, b: CmsVEC3): number {
  return Math.hypot(a.n[0] - b.n[0], a.n[1] - b.n[1], a.n[2] - b.n[2]);
}

export function cmsMAT3identity(): CmsMAT3 {
  return {
    v: [
      cmsVEC3init(1, 0, 0),
      cmsVEC3init(0, 1, 0),
      cmsVEC3init(0, 0, 1),
    ],
  };
}

export function cmsMAT3isIdentity(matrix: CmsMAT3): boolean {
  const identity = cmsMAT3identity();
  return matrix.v.every((row, i) =>
    row.n.every((value, j) => {
      const identityRow = identity.v[i]!;
      return Math.abs(value - identityRow.n[j]!) < IDENTITY_TOLERANCE;
    }),
  );
}

export function cmsMAT3per(a: CmsMAT3, b: CmsMAT3): CmsMAT3 {
  const rowCol = (i: 0 | 1 | 2, j: 0 | 1 | 2) =>
    a.v[i].n[0] * b.v[0].n[j] +
    a.v[i].n[1] * b.v[1].n[j] +
    a.v[i].n[2] * b.v[2].n[j];

  return {
    v: [
      cmsVEC3init(rowCol(0, 0), rowCol(0, 1), rowCol(0, 2)),
      cmsVEC3init(rowCol(1, 0), rowCol(1, 1), rowCol(1, 2)),
      cmsVEC3init(rowCol(2, 0), rowCol(2, 1), rowCol(2, 2)),
    ],
  };
}

export function cmsMAT3inverse(a: CmsMAT3): CmsMAT3 | null {
  const c0 = a.v[1].n[1] * a.v[2].n[2] - a.v[1].n[2] * a.v[2].n[1];
  const c1 = -a.v[1].n[0] * a.v[2].n[2] + a.v[1].n[2] * a.v[2].n[0];
  const c2 = a.v[1].n[0] * a.v[2].n[1] - a.v[1].n[1] * a.v[2].n[0];

  const det = a.v[0].n[0] * c0 + a.v[0].n[1] * c1 + a.v[0].n[2] * c2;
  if (Math.abs(det) < MATRIX_DETERMINANT_TOLERANCE) {
    return null;
  }

  return {
    v: [
      cmsVEC3init(
        c0 / det,
        (a.v[0].n[2] * a.v[2].n[1] - a.v[0].n[1] * a.v[2].n[2]) / det,
        (a.v[0].n[1] * a.v[1].n[2] - a.v[0].n[2] * a.v[1].n[1]) / det,
      ),
      cmsVEC3init(
        c1 / det,
        (a.v[0].n[0] * a.v[2].n[2] - a.v[0].n[2] * a.v[2].n[0]) / det,
        (a.v[0].n[2] * a.v[1].n[0] - a.v[0].n[0] * a.v[1].n[2]) / det,
      ),
      cmsVEC3init(
        c2 / det,
        (a.v[0].n[1] * a.v[2].n[0] - a.v[0].n[0] * a.v[2].n[1]) / det,
        (a.v[0].n[0] * a.v[1].n[1] - a.v[0].n[1] * a.v[1].n[0]) / det,
      ),
    ],
  };
}

export function cmsMAT3eval(a: CmsMAT3, v: CmsVEC3): CmsVEC3 {
  return cmsVEC3init(
    a.v[0].n[0] * v.n[0] + a.v[0].n[1] * v.n[1] + a.v[0].n[2] * v.n[2],
    a.v[1].n[0] * v.n[0] + a.v[1].n[1] * v.n[1] + a.v[1].n[2] * v.n[2],
    a.v[2].n[0] * v.n[0] + a.v[2].n[1] * v.n[1] + a.v[2].n[2] * v.n[2],
  );
}

export function cmsMAT3solve(a: CmsMAT3, b: CmsVEC3): CmsVEC3 | null {
  const inverse = cmsMAT3inverse(a);
  return inverse ? cmsMAT3eval(inverse, b) : null;
}
