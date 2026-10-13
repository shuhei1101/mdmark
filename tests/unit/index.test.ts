import { expect, test } from "vitest";

test("version は埋めた版を返す", async () => {
	(globalThis as Record<string, unknown>).__MDMARK_VERSION__ = "v9.9.9";
	const { version } = await import("../../src/index");
	expect(version()).toBe("v9.9.9");
});
