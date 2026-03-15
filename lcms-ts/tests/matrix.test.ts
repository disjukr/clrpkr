import { describe, expect, it } from "vitest";

import {
  cmsMAT3eval,
  cmsMAT3identity,
  cmsMAT3inverse,
  cmsMAT3isIdentity,
  cmsMAT3per,
  cmsMAT3solve,
  cmsVEC3cross,
  cmsVEC3dot,
  cmsVEC3init,
  cmsVEC3length,
} from "../src/index.js";

describe("matrix primitives", () => {
  it("recognizes the identity matrix", () => {
    expect(cmsMAT3isIdentity(cmsMAT3identity())).toBe(true);
  });

  it("inverts and multiplies matrices", () => {
    const matrix = {
      v: [
        cmsVEC3init(3, 0, 2),
        cmsVEC3init(2, 0, -2),
        cmsVEC3init(0, 1, 1),
      ],
    } as const;

    const inverse = cmsMAT3inverse(matrix);
    expect(inverse).not.toBeNull();
    expect(cmsMAT3isIdentity(cmsMAT3per(matrix, inverse!))).toBe(true);
  });

  it("solves linear systems and vector operations", () => {
    const matrix = {
      v: [
        cmsVEC3init(2, 1, -1),
        cmsVEC3init(-3, -1, 2),
        cmsVEC3init(-2, 1, 2),
      ],
    } as const;
    const rhs = cmsVEC3init(8, -11, -3);
    const solution = cmsMAT3solve(matrix, rhs);

    expect(solution).not.toBeNull();
    expect(solution!.n[0]).toBeCloseTo(2, 10);
    expect(solution!.n[1]).toBeCloseTo(3, 10);
    expect(solution!.n[2]).toBeCloseTo(-1, 10);
    expect(cmsMAT3eval(matrix, solution!)).toEqual(rhs);
    expect(cmsVEC3dot(cmsVEC3init(1, 2, 3), cmsVEC3init(4, 5, 6))).toBe(32);
    expect(cmsVEC3cross(cmsVEC3init(1, 0, 0), cmsVEC3init(0, 1, 0)).n).toEqual([0, 0, 1]);
    expect(cmsVEC3length(cmsVEC3init(2, 3, 6))).toBe(7);
  });
});
