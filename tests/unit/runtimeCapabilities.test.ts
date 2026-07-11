import { describe, expect, it } from "vitest";

import { chooseRuntime } from "../../src/engine/runtimeCapabilities";

describe("chooseRuntime", () => {
  it("selects threaded only when isolation and SharedArrayBuffer are both available", () => {
    expect(chooseRuntime(true, true)).toBe("threaded");
    expect(chooseRuntime(true, false)).toBe("single");
    expect(chooseRuntime(false, true)).toBe("single");
    expect(chooseRuntime(false, false)).toBe("single");
  });
});
