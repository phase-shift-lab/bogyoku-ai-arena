export const AUTO_RESET_DELAY_MS = 3_000;

export function scheduleAutoReset(onReset: () => void): () => void {
  const timer = window.setTimeout(onReset, AUTO_RESET_DELAY_MS);
  return () => window.clearTimeout(timer);
}
