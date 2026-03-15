# Porting Plan

## Goal

Port the public Little CMS surface and the core implementation to TypeScript without losing the upstream file-level structure.

## Current base

- `src/port/upstream-manifest.ts` maps each upstream `src/*.c` translation unit to a planned TypeScript target.
- `tmp/Little-CMS` is the in-repo upstream checkout used for API sync and source reference.
- `scripts/sync-upstream-api.mjs` extracts public API declarations from upstream `include/lcms2.h`.
- `src/color/conversions.ts` ports the current D50, `XYZ`, `xyY`, `Lab`, and `LCh` conversion helpers from `cmspcs.c` and `cmswtpnt.c`.
- `src/math/matrix.ts` ports the current 3x3 vector and matrix primitives from `cmsmtrx.c`.
- `src/tone-curve/index.ts` ports the current tone-curve subset from `cmsgamma.c`, including tabulated curves, several parametric curve types, evaluation, monotonicity checks, reverse curves, and gamma estimation.
- `src/profile/header.ts`, `src/profile/tag-table.ts`, `src/profile/tags.ts`, and `src/profile/lut.ts` parse ICC headers, tag tables, common tag payloads, and LUT tag structures used by the checked-in corpus.
- `src/profile/io-base.ts` now centralizes low-level big-endian ICC reads/writes and the first header/tag-table serialization helpers.
- `src/profile/io-tags.ts` now serializes the currently supported scalar tag payloads (`desc`, `text`, `mluc`, `XYZ `, `curv`, `para`) for write-back experiments.
- `src/profile/profile.ts` now assembles serialized headers, tag tables, and supported tag payloads into in-memory ICC profile bytes.
- `src/pipeline/index.ts` maps `mft1`, `mft2`, `mAB`, and `mBA` tags into an internal pipeline model and evaluates them in float mode with multilinear or tetrahedral interpolation.
- `src/core/context.ts` defines the first context abstraction that can later absorb plugin and error handler state.

## Current status

- `cmsmtrx`, `cmspcs`, `cmswtpnt`, `cmsgamma`, and `cmslut` are `bootstrapped` rather than `planned`.
- `cmsio0` is now `in-progress` with shared binary I/O primitives plus initial serialization support for ICC headers and tag tables.
- `cmsio1` is now `in-progress` with initial serialization support for the currently parsed non-LUT tag payloads.
- There is now a minimal profile-level memory serializer for the supported tag set, but file/stream APIs and MD5/profile ID regeneration are still missing.
- ICC profile support is currently read-oriented:
  - header parsing
  - tag table parsing
  - payload parsing for `desc`, `text`, `mluc`, `XYZ `, `curv`, `para`
  - LUT structure parsing for `mft1`, `mft2`, `mAB`, `mBA`
- Pipeline execution is currently partial:
  - float evaluation only
  - stage kinds: tone curves, matrix, 8-bit CLUT, 16-bit CLUT
  - interpolation modes: multilinear and tetrahedral for 3-channel CLUTs
- Upstream oracle checks are available via `zig cc`:
  - `oracle/pipeline_oracle.c`
  - `scripts/build-pipeline-oracle.mjs`
  - `scripts/run-pipeline-oracle-checks.mjs`
- Current automated coverage includes:
  - scalar color conversions
  - matrix math
  - tone-curve behavior
  - ICC corpus header/tag-table validation
  - ICC tag payload parsing
  - LUT tag parsing
  - pipeline construction and float evaluation
  - direct numeric comparison against upstream Little CMS for selected `mft1`/`mft2` cases

## Major gaps

- Full ICC profile I/O is still missing:
  - profile creation
  - stream/file serialization
  - tag write-back
  - full tag type coverage
- Transform creation and execution APIs are still missing:
  - profile linking
  - intent handling
  - black point compensation
  - proofing/devicelink behavior
  - formatter pack/unpack
- Interpolation support is still incomplete:
  - current tetrahedral support is limited to 3-channel CLUT float evaluation
  - higher-dimensional recursion and full upstream interpolation factory behavior are not yet separate modules
- Advanced feature sets are still unported:
  - CIECAM02
  - CGATS
  - named colors
  - virtual profile constructors
  - PostScript generators
  - plugin registry and thread/state model
  - gamut mapping helpers

## Recommended order

1. Finish ICC profile I/O first: `cmsio0`, `cmsio1`, `cmstypes`.
2. Expand interpolation and pipeline execution: `cmsintrp`, `cmssamp`, remaining `cmslut`.
3. Build transform planning/execution: `cmscnvrt`, `cmsopt`, `cmsxform`, `cmspack`.
4. Add built-in profile constructors and utility subsystems: `cmsvirt`, `cmsmd5`, `cmshalf`, `cmsalpha`.
5. Port advanced features last: `cmscam02`, `cmsplugin`, `cmsps2`, `cmscgats`, `cmsnamed`, `cmsgmt`, `cmssm`.

## Verification

- Baseline TypeScript verification:
  - `pnpm --filter lcms-ts typecheck`
  - `pnpm --filter lcms-ts test`
- Upstream API extraction:
  - `pnpm --filter lcms-ts sync:api`
- Upstream oracle build and comparison:
  - `pnpm --filter lcms-ts oracle:build`
  - `pnpm --filter lcms-ts test:oracle`
- The current oracle checks compare selected pipeline evaluations against upstream Little CMS built locally from `tmp/Little-CMS` with `zig cc`.

## Porting rules

- Keep exported TypeScript names aligned to upstream `cms*` symbols where practical.
- Separate pure math from ICC binary I/O; most performance work will depend on this split.
- Replace C ownership rules with explicit immutable inputs and constructor/free pairs only where needed for API compatibility.
- Prefer `Uint8Array`, `Uint16Array`, and `DataView` for binary profile operations instead of ad-hoc number arrays.
- Treat the generated API list as the source of truth for public surface tracking.
- Do not bake machine-local absolute paths into generated documentation.
