import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTO_RESET_DELAY_MS,
  scheduleAutoReset,
} from "../../src/app/autoReset";

describe("scheduleAutoReset", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets after the result has remained visible for three seconds", () => {
    vi.useFakeTimers();
    const onReset = vi.fn();

    scheduleAutoReset(onReset);
    vi.advanceTimersByTime(AUTO_RESET_DELAY_MS - 1);
    expect(onReset).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("cancels a pending automatic reset", () => {
    vi.useFakeTimers();
    const onReset = vi.fn();

    const cancel = scheduleAutoReset(onReset);
    cancel();
    vi.advanceTimersByTime(AUTO_RESET_DELAY_MS);

    expect(onReset).not.toHaveBeenCalled();
  });
});
