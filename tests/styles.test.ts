import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("styles.css", () => {
	const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

	it("!important を使わない（テーマや他のプラグインが上書きできるようにする）", () => {
		expect(css).not.toMatch(/!\s*important/i);
	});

	// コメントを除いたルール（セレクタ + 本体）の一覧
	const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
		(m) => ({ selector: m[1].trim(), body: m[2] }),
	);
	const transparencyRules = rules.filter((r) =>
		/background-color:\s*(transparent|var\(--background-(partially-|tabs-)?transparent\))\s*;/.test(
			r.body,
		),
	);
	const boosted = "body" + ".background-slideshow-active".repeat(3);

	it("背景透明化ルールが5件ある", () => {
		expect(transparencyRules).toHaveLength(5);
	});

	it("背景透明化ルールのセレクタはすべて、クラスを3回重ねて詳細度を上げている", () => {
		for (const { selector } of transparencyRules) {
			for (const part of selector.split(/,\s*(?![^()]*\))/)) {
				expect(part.trim().startsWith(`${boosted} `)).toBe(true);
			}
		}
	});

	it("詳細度を上げた記述は背景透明化ルール以外では使わない", () => {
		const others = rules.filter((r) => !transparencyRules.includes(r));
		for (const { selector } of others) {
			expect(selector).not.toContain(boosted);
		}
	});
});
