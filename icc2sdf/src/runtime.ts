import type { DawnNodeModule, GpuRuntime } from "./types.js";

function assertGpuAvailable(gpu: GPU | undefined): GPU {
  if (gpu == null) throw new Error("WebGPU is not available in this runtime");
  return gpu;
}

function createRuntime(gpu: GPU): GpuRuntime {
  return {
    gpu,
    async requestAdapter(options) {
      const adapter = await gpu.requestAdapter(options);
      if (adapter == null) throw new Error("No WebGPU adapter was found");
      return adapter;
    },
    async requestDevice(adapterOptions, descriptor) {
      const adapter = await this.requestAdapter(adapterOptions);
      return adapter.requestDevice(descriptor);
    },
  };
}

export function createBrowserGpuRuntime(): GpuRuntime {
  return createRuntime(assertGpuAvailable(globalThis.navigator?.gpu));
}

export async function createNodeGpuRuntime(
  dawnFlags: string[] = [],
): Promise<GpuRuntime> {
  let dawnModule: DawnNodeModule;
  try {
    const module = await import("webgpu");
    dawnModule = { create: module.create };
    if (module.globals != null) dawnModule.globals = module.globals;
  } catch (error) {
    throw new Error(
      "Node WebGPU runtime is unavailable. Install the `webgpu` package backed by dawn.node before calling createNodeGpuRuntime().",
      { cause: error },
    );
  }
  if (dawnModule.globals != null) Object.assign(globalThis, dawnModule.globals);
  return createRuntime(assertGpuAvailable(dawnModule.create(dawnFlags)));
}
