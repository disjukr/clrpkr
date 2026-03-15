export type PortStatus = "planned" | "bootstrapped" | "in-progress" | "done";

export interface UpstreamModuleManifestEntry {
  readonly upstreamSource: string;
  readonly category: string;
  readonly targetModule: string;
  readonly status: PortStatus;
  readonly notes: string;
}

export const UPSTREAM_MODULE_MANIFEST: readonly UpstreamModuleManifestEntry[] = [
  {
    upstreamSource: "cmsalpha.c",
    category: "alpha",
    targetModule: "src/alpha/index.ts",
    status: "planned",
    notes: "Alpha channel association helpers and formatter-adjacent behavior.",
  },
  {
    upstreamSource: "cmscam02.c",
    category: "appearance",
    targetModule: "src/cam02/index.ts",
    status: "planned",
    notes: "CIECAM02 model should stay isolated from profile I/O.",
  },
  {
    upstreamSource: "cmscgats.c",
    category: "cgats",
    targetModule: "src/cgats/index.ts",
    status: "planned",
    notes: "Text parser/serializer for CGATS measurement files.",
  },
  {
    upstreamSource: "cmscnvrt.c",
    category: "conversion",
    targetModule: "src/transform/conversion.ts",
    status: "planned",
    notes: "Profile linking and conversion chain planning.",
  },
  {
    upstreamSource: "cmserr.c",
    category: "error",
    targetModule: "src/core/error.ts",
    status: "planned",
    notes: "Thread-aware logging hooks need a JS-friendly replacement.",
  },
  {
    upstreamSource: "cmsgamma.c",
    category: "tone-curve",
    targetModule: "src/tone-curve/index.ts",
    status: "bootstrapped",
    notes: "Type 1 gamma, tabulated curves, evaluation, monotonicity, reverse, and gamma estimation are in place.",
  },
  {
    upstreamSource: "cmsgmt.c",
    category: "gamut",
    targetModule: "src/gamut/index.ts",
    status: "planned",
    notes: "Gamut boundary search and transform helpers.",
  },
  {
    upstreamSource: "cmshalf.c",
    category: "float16",
    targetModule: "src/encoding/half.ts",
    status: "planned",
    notes: "Half-float conversion tables and helpers.",
  },
  {
    upstreamSource: "cmsintrp.c",
    category: "interpolation",
    targetModule: "src/interp/index.ts",
    status: "planned",
    notes: "CLUT interpolation kernels; performance-sensitive.",
  },
  {
    upstreamSource: "cmsio0.c",
    category: "profile-io",
    targetModule: "src/profile/io-base.ts",
    status: "done",
    notes: "Binary ICC low-level parsing helpers, raw/cooked tag handling, linked tags, memory profile save/open, generic stream save, and ICC header/tag-table serialization are in place for the current runtime-neutral scope.",
  },
  {
    upstreamSource: "cmsio1.c",
    category: "profile-io",
    targetModule: "src/profile/io-tags.ts",
    status: "done",
    notes: "Supported tag payload serialization, profile info lookup, intent/LUT selection, devicelink lookup, float DToB/BToD selection, named-color pipeline selection, Lab v2/v4 compatibility stages, matrix-shaper fallbacks, and interpolation-policy glue are in place for the current scope.",
  },
  {
    upstreamSource: "cmslut.c",
    category: "pipeline",
    targetModule: "src/pipeline/index.ts",
    status: "bootstrapped",
    notes: "Pipeline/stage data model and LUT tag mapping from mft1/mft2/mAB/mBA/mpet are in place, including float CLUT evaluation, named-color stages, Lab/XYZ normalization compatibility helpers, and raw-preserving generic mpet handling for unknown/vendor elements.",
  },
  {
    upstreamSource: "cmsmd5.c",
    category: "hash",
    targetModule: "src/hash/md5.ts",
    status: "in-progress",
    notes: "Pure TypeScript MD5 and save-time profile ID recomputation are in place for ICC profile serialization.",
  },
  {
    upstreamSource: "cmsmtrx.c",
    category: "matrix",
    targetModule: "src/math/matrix.ts",
    status: "bootstrapped",
    notes: "3x3 vector and matrix primitives, inversion, solve, and identity checks are in place.",
  },
  {
    upstreamSource: "cmsnamed.c",
    category: "named-color",
    targetModule: "src/named-color/index.ts",
    status: "planned",
    notes: "Named color lists and lookup tables.",
  },
  {
    upstreamSource: "cmsopt.c",
    category: "optimization",
    targetModule: "src/transform/optimization.ts",
    status: "planned",
    notes: "Transform collapse and fast-path generation.",
  },
  {
    upstreamSource: "cmspack.c",
    category: "packing",
    targetModule: "src/format/packing.ts",
    status: "planned",
    notes: "Pixel format unpack/pack functions.",
  },
  {
    upstreamSource: "cmspcs.c",
    category: "pcs",
    targetModule: "src/color/conversions.ts",
    status: "bootstrapped",
    notes: "Initial XYZ/xyY/Lab/LCh conversions are in place.",
  },
  {
    upstreamSource: "cmsplugin.c",
    category: "plugin",
    targetModule: "src/core/plugin.ts",
    status: "planned",
    notes: "Port plugin registry after context/error abstractions settle.",
  },
  {
    upstreamSource: "cmsps2.c",
    category: "postscript",
    targetModule: "src/postscript/index.ts",
    status: "planned",
    notes: "PostScript CSA/CRD generation.",
  },
  {
    upstreamSource: "cmssamp.c",
    category: "sampling",
    targetModule: "src/pipeline/sampling.ts",
    status: "planned",
    notes: "CLUT traversal and sampling utilities.",
  },
  {
    upstreamSource: "cmssm.c",
    category: "state",
    targetModule: "src/core/state.ts",
    status: "planned",
    notes: "Shared state/mutex design needs adaptation for JS runtimes.",
  },
  {
    upstreamSource: "cmstypes.c",
    category: "tag-types",
    targetModule: "src/profile/tag-types.ts",
    status: "done",
    notes: "Common ICC metadata/tag payload readers and writers are in place for scalar, sequence, named-color, dictionary, VCGT, video-signal, MHC2, colorant-order, S15/U16 fixed arrays, generic uint arrays, several printing-related tags, and upstream broken-type aliases; broader MPE plugin extensibility remains under cmslut/plugin scope.",
  },
  {
    upstreamSource: "cmsvirt.c",
    category: "virtual-profile",
    targetModule: "src/profile/virtual.ts",
    status: "planned",
    notes: "Built-in profile constructors.",
  },
  {
    upstreamSource: "cmswtpnt.c",
    category: "white-point",
    targetModule: "src/color/conversions.ts",
    status: "bootstrapped",
    notes: "D50 constants and xyY/XYZ helpers are in place.",
  },
  {
    upstreamSource: "cmsxform.c",
    category: "transform",
    targetModule: "src/transform/index.ts",
    status: "planned",
    notes: "Main transform execution pipeline.",
  },
] as const;
