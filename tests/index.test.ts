import { describe, test, expect } from "bun:test";
describe("agent-context-compressor", () => {
  test("module loads", async () => { const m = await import("../src/index"); expect(m).toBeDefined(); });
});
