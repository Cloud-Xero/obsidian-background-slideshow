import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";
import {
	applyTransparency,
	isTransparencyActive,
	removeTransparency,
	TRANSPARENCY_ACTIVE_CLASS,
	TRANSPARENCY_VARS,
} from "../src/transparency";

const settings = {
	...DEFAULT_SETTINGS,
	paneOpacity: 0.1,
	uiOpacity: 0.2,
	tabOpacity: 0.3,
};

describe("transparency", () => {
	let classes: Set<string>;
	let vars: Map<string, string>;
	let probeRemoved: boolean;

	const stubColor = (backgroundColor: string) => {
		vi.stubGlobal("getComputedStyle", () => ({ backgroundColor }));
	};

	beforeEach(() => {
		classes = new Set();
		vars = new Map();
		probeRemoved = false;
		vi.stubGlobal("document", {
			body: {
				classList: {
					add: (c: string) => classes.add(c),
					remove: (c: string) => classes.delete(c),
					contains: (c: string) => classes.has(c),
				},
				style: {
					setProperty: (n: string, v: string) => vars.set(n, v),
					removeProperty: (n: string) => vars.delete(n),
				},
				createDiv: () => ({
					remove: () => {
						probeRemoved = true;
					},
				}),
			},
		});
		stubColor("rgb(1, 2, 3)");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("3つの CSS 変数に、背景色と各不透明度を組み合わせた値を設定する", () => {
		applyTransparency(settings);

		expect(vars.get("--background-transparent")).toBe("rgba(1, 2, 3, 0.1)");
		expect(vars.get("--background-partially-transparent")).toBe(
			"rgba(1, 2, 3, 0.2)",
		);
		expect(vars.get("--background-tabs-transparent")).toBe(
			"rgba(1, 2, 3, 0.3)",
		);
	});

	it("適用すると有効フラグが立ち、色取得用の一時要素は取り除かれる", () => {
		expect(isTransparencyActive()).toBe(false);

		applyTransparency(settings);

		expect(isTransparencyActive()).toBe(true);
		expect(classes.has(TRANSPARENCY_ACTIVE_CLASS)).toBe(true);
		expect(probeRemoved).toBe(true);
	});

	it("rgba() 形式の背景色からも rgb 成分だけを取り出す", () => {
		stubColor("rgba(10, 20, 30, 0.5)");

		applyTransparency(settings);

		expect(vars.get("--background-transparent")).toBe("rgba(10, 20, 30, 0.1)");
	});

	it("背景色を解釈できないときは既定色 30, 30, 30 を使う", () => {
		stubColor("");

		applyTransparency(settings);

		expect(vars.get("--background-transparent")).toBe(
			"rgba(30, 30, 30, 0.1)",
		);
	});

	it("解除すると有効フラグと3つの CSS 変数がすべて消える", () => {
		applyTransparency(settings);

		removeTransparency();

		expect(isTransparencyActive()).toBe(false);
		for (const name of TRANSPARENCY_VARS) {
			expect(vars.has(name)).toBe(false);
		}
	});

	it("適用していない状態で解除しても例外にならない", () => {
		expect(() => removeTransparency()).not.toThrow();
		expect(isTransparencyActive()).toBe(false);
	});
});
