declare module "webgpu" {
  const dawnModule: {
    create(flags?: string[]): GPU;
    globals?: Record<string, unknown>;
  };

  export = dawnModule;
}
