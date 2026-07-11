export type EngineRuntime = "threaded" | "single";

export interface RuntimeCapabilities {
  readonly crossOriginIsolated: boolean;
  readonly sharedArrayBuffer: boolean;
  readonly logicalCores: number;
  readonly deviceMemoryGiB: number | null;
  readonly recommendedRuntime: EngineRuntime;
  readonly recommendedThreads: number;
  readonly recommendedHashMb: number;
  readonly warning?: string;
}

interface NavigatorWithDeviceMemory extends Navigator {
  readonly deviceMemory?: number;
}

export function chooseRuntime(
  crossOriginIsolated: boolean,
  sharedArrayBuffer: boolean,
): EngineRuntime {
  return crossOriginIsolated && sharedArrayBuffer ? "threaded" : "single";
}

export function getRuntimeCapabilities(): RuntimeCapabilities {
  const crossOriginIsolated = Boolean(window.crossOriginIsolated);
  const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const browserNavigator = navigator as NavigatorWithDeviceMemory;

  const logicalCores = navigator.hardwareConcurrency || 1;
  const deviceMemoryGiB = browserNavigator.deviceMemory ?? null;
  const recommendedRuntime = chooseRuntime(
    crossOriginIsolated,
    sharedArrayBuffer,
  );
  const recommendedThreads = recommendedRuntime === "threaded" ? 4 : 1;
  const recommendedHashMb =
    deviceMemoryGiB !== null && deviceMemoryGiB <= 2
      ? 32
      : deviceMemoryGiB !== null && deviceMemoryGiB <= 4
        ? 64
        : 128;

  return {
    crossOriginIsolated,
    sharedArrayBuffer,
    logicalCores,
    deviceMemoryGiB,
    recommendedRuntime,
    recommendedThreads,
    recommendedHashMb,
    warning:
      recommendedRuntime === "single"
        ? "SharedArrayBufferを利用できないため、互換モードで動作します。"
        : undefined,
  };
}
