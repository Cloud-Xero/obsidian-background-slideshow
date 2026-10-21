import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { MultiImageSelectModal } from "../src/settings";

// onOpen() が使う分だけを持つ、DOM 要素の簡易版
class FakeEl {
	cls: string[] = [];
	text = "";
	children: FakeEl[] = [];
	handlers: Record<string, () => void> = {};
	checked = false;

	constructor(
		public tag: string,
		opts: { cls?: string; text?: string } = {},
	) {
		this.cls = opts.cls ? opts.cls.split(" ") : [];
		this.text = opts.text ?? "";
	}
	private add(tag: string, opts: { cls?: string; text?: string } = {}) {
		const el = new FakeEl(tag, opts);
		this.children.push(el);
		return el;
	}
	empty() {
		this.children = [];
	}
	createEl(tag: string, opts?: { cls?: string; text?: string }) {
		return this.add(tag, opts);
	}
	createDiv(opts?: { cls?: string }) {
		return this.add("div", opts);
	}
	createSpan(opts?: { text?: string }) {
		return this.add("span", opts);
	}
	addEventListener(name: string, handler: () => void) {
		this.handlers[name] = handler;
	}
	find(cls: string): FakeEl[] {
		return [
			...(this.cls.includes(cls) ? [this] : []),
			...this.children.flatMap((c) => c.find(cls)),
		];
	}
}

const file = (path: string, extension: string) =>
	({ path, extension }) as unknown as TFile;

function openModal(files: TFile[], onChoose = vi.fn()) {
	const app = { vault: { getFiles: () => files } } as unknown as App;
	const modal = new MultiImageSelectModal(app, onChoose);
	const contentEl = new FakeEl("div");
	Object.assign(modal, { contentEl });
	modal.onOpen();
	return { modal, contentEl, onChoose };
}

describe("MultiImageSelectModal の CSS クラス", () => {
	const files = [file("a.png", "png"), file("b.JPG", "JPG"), file("c.md", "md")];

	it("一覧・項目・ボタン領域にプラグイン専用のクラスを付ける", () => {
		const { contentEl } = openModal(files);
		expect(contentEl.find("background-slideshow-select-list")).toHaveLength(1);
		expect(contentEl.find("background-slideshow-select-item")).toHaveLength(2);
		expect(contentEl.find("background-slideshow-modal-buttons")).toHaveLength(1);
	});

	it("本体のモーダルと衝突する旧クラスを使わない", () => {
		const { contentEl } = openModal(files);
		expect(contentEl.find("modal-button-container")).toHaveLength(0);
		expect(contentEl.find("multi-image-select-list")).toHaveLength(0);
		expect(contentEl.find("multi-image-select-item")).toHaveLength(0);
	});

	it("画像ファイルが無くても一覧とボタン領域は作られ、項目は 0 件", () => {
		const { contentEl } = openModal([file("c.md", "md")]);
		expect(contentEl.find("background-slideshow-select-list")).toHaveLength(1);
		expect(contentEl.find("background-slideshow-select-item")).toHaveLength(0);
		expect(contentEl.find("background-slideshow-modal-buttons")).toHaveLength(1);
	});

	it("ボタン領域の Add selected で選択したファイルが渡される", () => {
		const { contentEl, onChoose, modal } = openModal(files);
		const close = vi.spyOn(modal, "close");
		const item = contentEl.find("background-slideshow-select-item")[0]!;
		const checkbox = item.children[0]!;
		checkbox.checked = true;
		checkbox.handlers["change"]!();

		const buttons = contentEl.find("background-slideshow-modal-buttons")[0]!;
		const ok = buttons.children.find((b) => b.text === "Add selected")!;
		ok.handlers["click"]!();

		expect(onChoose).toHaveBeenCalledWith([files[0]]);
		expect(close).toHaveBeenCalled();
	});
});

describe("styles.css とモーダルのクラスの整合", () => {
	const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

	it("専用クラスのスタイルが定義されている", () => {
		expect(css).toContain(".background-slideshow-select-list {");
		expect(css).toContain(".background-slideshow-select-item {");
		expect(css).toContain(".background-slideshow-modal-buttons {");
	});

	it("本体のモーダルに効く素のセレクタが残っていない", () => {
		expect(css).not.toMatch(/(^|[\s,}])\.modal-button-container\b/m);
		expect(css).not.toMatch(/\.multi-image-select-(list|item)\b/);
	});
});
