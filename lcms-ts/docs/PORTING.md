# Porting Plan

## Goal

Port the public Little CMS surface and core implementation to TypeScript while keeping upstream translation-unit boundaries visible in the repo.

## Current base

- `src/port/upstream-manifest.ts` maps each upstream `src/*.c` file to a TypeScript target and tracking status.
- `tmp/Little-CMS` is the checked-out upstream source used for API sync, source comparison, and differential oracle builds.
- `scripts/sync-upstream-api.mjs` extracts the public API from upstream `include/lcms2.h`.
- `src/color/conversions.ts` ports the current D50, `XYZ`, `xyY`, `Lab`, and `LCh` helpers from `cmspcs.c` and `cmswtpnt.c`.
- `src/math/matrix.ts` ports the current 3x3 vector and matrix primitives from `cmsmtrx.c`.
- `src/tone-curve/index.ts` ports the current tone-curve subset from `cmsgamma.c`, including tabulated curves, parametric curves, evaluation, monotonicity checks, reverse curves, and gamma estimation.
- `src/profile/header.ts`, `src/profile/tag-table.ts`, `src/profile/tags.ts`, `src/profile/io-base.ts`, `src/profile/io-tags.ts`, and `src/profile/profile.ts` now cover ICC header/tag-table parsing, broad `cmstypes` payload parsing and serialization, raw/cooked tag handling, linked tags, in-memory profile open/save, generic stream save, and save-time profile ID recomputation.
- `src/profile/lut.ts` and `src/pipeline/index.ts` now cover `mft1`, `mft2`, `mAB`, `mBA`, and generic `mpet` parsing, serialization, pipeline construction, and float evaluation.
- `src/hash/md5.ts` ports the MD5 path used for ICC profile IDs.
- `src/interp/index.ts` now holds the first dedicated interpolation port from `cmsintrp.c`, covering interpolation-parameter setup plus float and 16-bit 1D, bilinear, multilinear, tetrahedral, and recursive N-D tetrahedral CLUT evaluation.
- `src/pipeline/sampling.ts` now holds the first `cmssamp.c` subset for CLUT traversal and resampling helpers.
- `src/format/packing.ts` now holds the first `cmspack.c` subset for formatter bitfields, stock formatter constants, profile-based formatter selection, and basic chunky RGB/GRAY/CMYK pack/unpack helpers.
- `src/core/context.ts` holds the first context abstraction for later plugin/error-state work.

## Status summary

- `cmsio0.c`: done for the current runtime-neutral scope.
- `cmsio1.c`: done for the current scope.
- `cmstypes.c`: done for the current scope.
- `cmslut.c`: done for the current scope.
- `cmsmd5.c`: partially ported and sufficient for current ICC save/profile-ID behavior.
- `cmsmtrx.c`, `cmspcs.c`, `cmswtpnt.c`, `cmsgamma.c`, `cmsintrp.c`, `cmssamp.c`, `cmspack.c`: bootstrapped and actively used by the ICC/profile pipeline path.
- Transform-planning and execution modules are still largely unported:
  - `cmscnvrt.c`
  - `cmsopt.c`
  - `cmsxform.c`

## What is done now

- ICC binary I/O:
  - header parsing and serialization
  - tag table parsing and serialization
  - big-endian scalar helpers
  - date/time, fixed-point, signatures, profile IDs
- Profile object and tag behavior:
  - memory-backed profile open/save
  - generic stream save
  - raw tag read/write
  - cooked tag read/write
  - linked tags
  - unsupported raw-tag preservation
  - save-time MD5/profile ID recomputation
- `cmstypes` coverage for the current scope:
  - text/scalar: `desc`, `text`, `mluc`, `XYZ `, `curv`, `para`, `sig `, `data`, `dtim`
  - measurement/viewing: `meas`, `view`, `chrm`
  - sequence/table: `clrt`, `clro`, `ncl2`, `pseq`, `psid`, `dict`
  - display/video/device extras: `vcgt`, `cicp`, `MHC2`
  - print-oriented tags: `bfd `, `crdi`, `scrn`
  - generic arrays: `sf32`, `uf32`, `ui08`, `ui32`, `ui64`
  - upstream broken aliases: Corbis XYZ and Monaco curve payload compatibility
- LUT and pipeline support:
  - `mft1`, `mft2`, `mAB`, `mBA`, `mpet` parse/serialize
  - generic `mpet` raw preservation for unknown/vendor elements
  - float evaluation
  - multilinear and tetrahedral interpolation
  - recursive tetrahedral interpolation for 4+ input dimensions via the dedicated `cmsintrp` port
  - CLUT slicing and stage sampling helpers (`cmsSliceSpace16/Float`, `cmsStageSampleCLut16bit/Float`)
  - named-color stages
  - Lab/XYZ normalization and compatibility stages
  - upstream-compatible `mAB`/`mBA` stage ordering
- Formatter and packing support:
  - format bitfield helpers and stock formatter constants for the current subset
  - `cmsFormatterForColorspaceOfProfile`
  - `cmsFormatterForPCSOfProfile`
  - basic chunky RGB/GRAY/CMYK 8-bit and float pack/unpack helpers
- `cmsio1`-level selection helpers:
  - intent-based input/output LUT selection
  - devicelink LUT selection
  - float `D2B*` / `B2D*` selection
  - matrix-shaper fallback
  - gray fallback
  - profile info lookup

## Verification

- Baseline TypeScript checks:
  - `pnpm --filter lcms-ts typecheck`
  - `pnpm --filter lcms-ts test`
- Upstream API extraction:
  - `pnpm --filter lcms-ts sync:api`
- Upstream differential helpers:
  - `pnpm --filter lcms-ts oracle:build`
  - `pnpm --filter lcms-ts test:oracle`
- Current differential verification uses upstream Little CMS built locally from `tmp/Little-CMS` with `zig cc`.
- Differential coverage now includes:
  - parse results
  - tag offset/size and link behavior
  - LUT selection results
  - save-then-reparse results
  - `tmp/Little-CMS/testbed` sample profiles
  - the bundled `icc-profiles` corpus

## Practical meaning of current coverage

- For the current runtime-neutral scope, `lcms-ts` is now close to upstream Little CMS for:
  - opening ICC profiles from bytes
  - inspecting headers and tags
  - reading and writing supported tag payloads
  - saving profiles back to bytes
  - selecting upstream-like input/output/devicelink LUT pipelines
- The major remaining gap is not profile I/O anymore. It is transform creation and execution.

## Major gaps

- Transform APIs are still missing:
  - profile linking
  - optimized transform planning
  - execution over packed pixel buffers
  - proofing and BPC behavior at transform level
- Formatter coverage is still a bootstrap subset and does not yet include the full upstream stock formatter table or formatter plugin chain.
- Plugin registry and extensibility are still missing:
  - `cmsplugin`
  - richer runtime plugin registration
  - full generic MPE extensibility beyond safe preservation
- Advanced utility subsystems remain unported:
  - `cmscam02`
  - `cmscgats`
  - `cmsvirt`
  - `cmsps2`
  - `cmsnamed`
  - `cmsgmt`
  - `cmssm`

## Recommended order

1. Build transform execution foundations:
   - `cmsintrp`
   - `cmssamp`
   - `cmspack`
   - `cmsxform`
2. Add transform planning and optimization:
   - `cmscnvrt`
   - `cmsopt`
3. Port constructors and supporting utilities:
   - `cmsvirt`
   - `cmshalf`
   - `cmsalpha`
4. Port advanced and ecosystem-facing modules last:
   - `cmsplugin`
   - `cmscam02`
   - `cmsps2`
   - `cmscgats`
   - `cmsnamed`
   - `cmsgmt`
   - `cmssm`

## Porting rules

- Keep exported TypeScript names aligned to upstream `cms*` symbols where practical.
- Separate pure math from ICC binary I/O.
- Replace C ownership rules with explicit immutable inputs and constructor/free pairs only where compatibility needs them.
- Prefer `Uint8Array`, `Uint16Array`, `Float32Array`, and `DataView` for binary ICC work.
- Treat the generated upstream API list as the source of truth for public-surface tracking.
- Do not bake machine-local absolute paths into generated documentation.
