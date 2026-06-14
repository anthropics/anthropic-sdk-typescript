export type AnthropicTracingChannel<Context extends object> = {
  readonly hasSubscribers: boolean;
  tracePromise<T>(fn: () => Promise<T>, context?: Context): Promise<T>;
};

type DiagnosticsChannelModule = {
  tracingChannel?: <Context extends object>(name: string) => AnthropicTracingChannel<Context>;
};

type ProcessWithBuiltinModule = {
  getBuiltinModule?: (id: string) => unknown;
};

type TracingChannelFactory = (name: string) => AnthropicTracingChannel<any> | null;

let diagnosticsChannelModulePromise: Promise<DiagnosticsChannelModule | null> | undefined;
let tracingChannelFactoryForTesting: TracingChannelFactory | undefined;

function isNodeRuntime(): boolean {
  const process = (globalThis as any).process;
  return Object.prototype.toString.call(process ?? 0) === '[object process]';
}

function loadDiagnosticsChannelSync(): DiagnosticsChannelModule | null {
  const process = (globalThis as any).process as ProcessWithBuiltinModule | undefined;
  if (!process?.getBuiltinModule) {
    return null;
  }

  try {
    const module = process.getBuiltinModule('node:diagnostics_channel') as DiagnosticsChannelModule;
    return typeof module?.tracingChannel === 'function' ? module : null;
  } catch {
    return null;
  }
}

async function loadDiagnosticsChannel(): Promise<DiagnosticsChannelModule | null> {
  const syncModule = loadDiagnosticsChannelSync();
  if (syncModule) {
    return syncModule;
  }

  if (!isNodeRuntime()) {
    return null;
  }

  try {
    const module = (await import('node:diagnostics_channel')) as unknown as DiagnosticsChannelModule;
    return typeof module?.tracingChannel === 'function' ? module : null;
  } catch {
    return null;
  }
}

export async function getTracingChannel<Context extends object>(
  name: string,
): Promise<AnthropicTracingChannel<Context> | null> {
  if (tracingChannelFactoryForTesting) {
    return tracingChannelFactoryForTesting(name) as AnthropicTracingChannel<Context> | null;
  }

  diagnosticsChannelModulePromise ??= loadDiagnosticsChannel();
  const module = await diagnosticsChannelModulePromise;
  return module?.tracingChannel?.<Context>(name) ?? null;
}

export function hasTracingChannelSubscribers<Context extends object>(
  channel: AnthropicTracingChannel<Context> | null,
): channel is AnthropicTracingChannel<Context> {
  return channel?.hasSubscribers === true;
}

export function setTracingChannelFactoryForTesting(factory: TracingChannelFactory | undefined): () => void {
  const previous = tracingChannelFactoryForTesting;
  tracingChannelFactoryForTesting = factory;
  return () => {
    tracingChannelFactoryForTesting = previous;
  };
}
