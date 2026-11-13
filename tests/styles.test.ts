import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("styles.css", () => {
	const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

	it("!important を使わない（テーマや他のプラグインが上書きできるようにする）", () => {
		expect(css).not.toMatch(/!\s*important/i);
	});
});
