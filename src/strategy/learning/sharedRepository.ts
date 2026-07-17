import {
  parseSharedLearningAggregate,
  type SharedLearningAggregate,
  type SharedLearningEvent,
} from "./shared";

const requestTimeoutMs = 2_000;

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, "") : undefined;
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    requestTimeoutMs,
  );
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export function createSharedLearningRepository(
  configuredUrl = import.meta.env.VITE_SHARED_LEARNING_API_URL,
  fetcher: typeof fetch = fetch,
) {
  const baseUrl = normalizeBaseUrl(configuredUrl);
  return {
    configured: Boolean(baseUrl),
    async loadAggregate(): Promise<SharedLearningAggregate | undefined> {
      if (!baseUrl) return;
      const response = await fetchWithTimeout(
        fetcher,
        `${baseUrl}/v1/learning/aggregate`,
        { method: "GET", credentials: "omit", cache: "no-store" },
      );
      if (!response.ok) return;
      return parseSharedLearningAggregate(await response.json());
    },
    async submitEvent(event: SharedLearningEvent) {
      if (!baseUrl) return false;
      const response = await fetchWithTimeout(
        fetcher,
        `${baseUrl}/v1/learning/events`,
        {
          method: "POST",
          credentials: "omit",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(event),
        },
      );
      if (!response.ok) return false;
      const value = (await response.json()) as unknown;
      return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>).schemaVersion === 1 &&
        (value as Record<string, unknown>).accepted === true &&
        typeof (value as Record<string, unknown>).duplicate === "boolean"
      );
    },
  };
}

export const sharedLearningRepository = createSharedLearningRepository();
