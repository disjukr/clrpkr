import type { CmsHandle } from "../types/primitives.js";

export interface CmsContext extends CmsHandle<"context"> {
  readonly userData?: unknown;
  readonly pluginIds: readonly string[];
}

export interface CmsContextOptions {
  readonly userData?: unknown;
  readonly pluginIds?: readonly string[];
}

let nextContextId = 1;

export function cmsCreateContext(options: CmsContextOptions = {}): CmsContext {
  return {
    id: `ctx-${nextContextId++}`,
    kind: "context",
    userData: options.userData,
    pluginIds: [...(options.pluginIds ?? [])],
  };
}

export function cmsDupContext(
  context: CmsContext,
  userData: unknown = context.userData,
): CmsContext {
  return cmsCreateContext({
    userData,
    pluginIds: context.pluginIds,
  });
}

export function cmsGetContextUserData(context: CmsContext): unknown {
  return context.userData;
}
