import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import {
	matchesImageFilter,
	MultiImageSelectModal,
} from "../src/ui/image-select-modal";

// onOpen() が使う分だけを持つ、DOM 要素の簡易版
class FakeEl {
	cls: string[] = [];
	text = "";
	children: FakeEl[] = [];
	handlers: Record<string, () => void> = {};
	checked = false;
	disabled = false;
	value = "";
	shown = true;

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
	createSpan(opts?: { cls?: string; text?: string }) {
		return this.add("span", opts);
	}
	toggle(show: boolean) {
		this.shown = show;
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

function openModal(
	files: TFile[],
	onChoose = vi.fn(),
	registeredPaths: string[] = [],
) {
	const app = { vault: { getFiles: () => files } } as unknown as App;
	const modal = new MultiImageSelectModal(app, onChoose, registeredPaths);
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

const items = (contentEl: FakeEl) =>
	contentEl.find("background-slideshow-select-item");
const pathOf = (item: FakeEl) => item.children[1]!.text;
const check = (item: FakeEl) => {
	const checkbox = item.children[0]!;
	checkbox.checked = true;
	checkbox.handlers["change"]?.();
};
const search = (contentEl: FakeEl, value: string) => {
	const input = contentEl.find("background-slideshow-select-search")[0]!;
	input.value = value;
	input.handlers["input"]!();
};
const clickAdd = (contentEl: FakeEl) => {
	const buttons = contentEl.find("background-slideshow-modal-buttons")[0]!;
	buttons.children.find((b) => b.text === "Add selected")!.handlers["click"]!();
};

describe("MultiImageSelectModal の登録済み表示", () => {
	const files = [file("a.png", "png"), file("b.png", "png")];

	it("登録済みの画像は一覧に残し、チェックできず Already added と表示する", () => {
		const { contentEl } = openModal(files, vi.fn(), ["a.png"]);
		const [registered, fresh] = items(contentEl);

		expect(items(contentEl)).toHaveLength(2);
		expect(registered!.cls).toContain("is-registered");
		expect(registered!.children[0]!.disabled).toBe(true);
		expect(registered!.children[0]!.handlers["change"]).toBeUndefined();
		expect(
			registered!.find("background-slideshow-select-registered")[0]?.text,
		).toBe("Already added");

		expect(fresh!.cls).not.toContain("is-registered");
		expect(fresh!.children[0]!.disabled).toBe(false);
		expect(fresh!.find("background-slideshow-select-registered")).toHaveLength(0);
	});

	it("登録済みの画像は選択結果に含まれない", () => {
		const { contentEl, onChoose } = openModal(files, vi.fn(), ["a.png"]);
		items(contentEl).forEach(check);
		clickAdd(contentEl);

		expect(onChoose).toHaveBeenCalledWith([files[1]]);
	});
});

describe("MultiImageSelectModal の絞り込み", () => {
	const files = [
		file("images/Red.png", "png"),
		file("images/green.png", "png"),
		file("photos/red-sky.jpg", "jpg"),
	];
	const visiblePaths = (contentEl: FakeEl) =>
		items(contentEl)
			.filter((item) => item.shown)
			.map(pathOf);

	it("一覧の上に検索欄がある", () => {
		const { contentEl } = openModal(files);
		const children = contentEl.children.map((c) => c.cls[0]);
		expect(children.indexOf("background-slideshow-select-search")).toBeLessThan(
			children.indexOf("background-slideshow-select-list"),
		);
	});

	it("パスの一部に一致する行だけを残し、大文字と小文字は区別しない", () => {
		const { contentEl } = openModal(files);
		search(contentEl, "RED");
		expect(visiblePaths(contentEl)).toEqual([
			"images/Red.png",
			"photos/red-sky.jpg",
		]);

		search(contentEl, "images/");
		expect(visiblePaths(contentEl)).toEqual([
			"images/Red.png",
			"images/green.png",
		]);
	});

	it("検索語を消すとすべての行が戻る", () => {
		const { contentEl } = openModal(files);
		search(contentEl, "zzz");
		expect(visiblePaths(contentEl)).toEqual([]);

		search(contentEl, "");
		expect(visiblePaths(contentEl)).toHaveLength(3);
	});

	it("絞り込みで隠れた行の選択も保持される", () => {
		const { contentEl, onChoose } = openModal(files);
		check(items(contentEl)[1]!);
		search(contentEl, "red");
		check(items(contentEl)[0]!);
		clickAdd(contentEl);

		expect(onChoose).toHaveBeenCalledWith([files[1], files[0]]);
	});
});

describe("matchesImageFilter", () => {
	it("前後の空白を無視し、空の検索語はすべてに一致する", () => {
		expect(matchesImageFilter("a/B.png", "  b.p ")).toBe(true);
		expect(matchesImageFilter("a/B.png", "")).toBe(true);
		expect(matchesImageFilter("a/B.png", "c")).toBe(false);
	});
});

describe("styles.css とモーダルのクラスの整合", () => {
	const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

	it("専用クラスのスタイルが定義されている", () => {
		expect(css).toContain(".background-slideshow-select-list {");
		expect(css).toContain(".background-slideshow-select-item {");
		expect(css).toContain(".background-slideshow-modal-buttons {");
		expect(css).toContain(".background-slideshow-select-search {");
		expect(css).toContain(".background-slideshow-select-registered {");
	});

	it("本体のモーダルに効く素のセレクタが残っていない", () => {
		expect(css).not.toMatch(/(^|[\s,}])\.modal-button-container\b/m);
		expect(css).not.toMatch(/\.multi-image-select-(list|item)\b/);
	});
});
