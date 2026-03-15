# icc2sdf

`icc2sdf` is a workspace package for converting ICC profile gamuts into signed distance fields in Lab space.

## Current scope

- Shared volume and pipeline config types
- WebGPU runtime helpers for browser and Node.js
- `f32` 3D NRRD read/write helpers

## Planned pipeline

1. Sample the ICC gamut into a Lab voxel grid.
2. Build an occupancy or boundary volume on WebGPU.
3. Run distance propagation on GPU.
4. Apply a 1-voxel Gaussian blur on GPU.
5. Keep the result in memory as typed arrays in browsers.
6. Optionally serialize the volume to NRRD in Node.js.

## Node.js WebGPU

The intended Node.js path is the `webgpu` package backed by Dawn (`dawn.node`). The package is loaded dynamically so browser builds stay clean and Node users can opt in when they want GPU execution.

Example:

```ts
import { createNodeGpuRuntime } from "icc2sdf";

const runtime = await createNodeGpuRuntime();
const device = await runtime.requestDevice();
```

If `webgpu` is not installed, `createNodeGpuRuntime()` throws with guidance.

## NRRD I/O

NRRD is modeled here as an `f32` 3D volume format rather than an SDF-specific export path.

- `serializeNrrd()` writes embedded raw NRRD payloads
- `parseNrrd()` reads embedded raw NRRD payloads

Only `type: float` raw embedded NRRD volumes are supported.
