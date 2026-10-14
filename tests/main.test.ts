import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { TFile, type App, type PluginManifest } from "obsidian";
import BackgroundSlideshowPlugin from "../src/main";
import { loadImage } from "../src/image-loader";
import type { ImageData } from "../src/settings";

// 画像の読み込みはテストから完了・失敗を操作できるように差し替える
vi.mock("../src/image-loader", () => ({ loadImage: vi.fn() }));

// Vault に存在するファイルとして扱う TFile を作る
const makeFile = (path: string): TFile => {
	const file = new TFile();
	file.path = path;
	return file;
};

interface FakeVaultOptions {
	files?: TFile[];
	getFullPath?: (path: string) => string;
}

const createPlugin = (options: FakeVaultOptions = {}) => {
	const files = new Map((options.files ?? []).map((f) => [f.path, f]));
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path) ?? null,
			getResourcePath: (file: TFile) => `app://local/${file.path}`,
			adapter: options.getFullPath
				? { getFullPath: options.getFullPath }
				: {},
		},
		workspace: {
			on: vi.fn(() => ({})),
			onLayoutReady: vi.fn(),
		},
	} as unknown as App;
	return new BackgroundSlideshowPlugin(app, {} as PluginManifest);
};

describe("loadSettings", () => {
	it("保存データが無いときはデフォルト値になる", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue(null);

		await plugin.loadSettings();

		expect(plugin.settings.enabled).toBe(true);
		expect(plugin.settings.duration).toBe(60);
		expect(plugin.settings.images).toEqual([]);
	});

	it("旧形式（文字列の配列）の画像リストをオブジェクトの配列に移行して保存する", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			images: ["a.png", "https://example.com/b.jpg"],
		});
		const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue();

		await plugin.loadSettings();

		const expected: ImageData[] = [
			{ path: "a.png", enabled: true },
			{ path: "https://example.com/b.jpg", enabled: true },
		];
		expect(plugin.settings.images).toEqual(expected);
		expect(saveData).toHaveBeenCalledTimes(1);
	});

	it("新形式の画像リストはそのまま使い、保存し直さない", async () => {
		const plugin = createPlugin();
		const images: ImageData[] = [{ path: "a.png", enabled: false }];
		vi.spyOn(plugin, "loadData").mockResolvedValue({ images });
		const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue();

		await plugin.loadSettings();

		expect(plugin.settings.images).toEqual(images);
		expect(saveData).not.toHaveBeenCalled();
	});
});

describe("getImageUrls", () => {
	const loadWith = async (
		plugin: BackgroundSlideshowPlugin,
		data: Record<string, unknown>,
	) => {
		vi.spyOn(plugin, "loadData").mockResolvedValue(data);
		await plugin.loadSettings();
	};

	it("ランダム画像が有効なときは、起動時に表示する1件分の Lorem Picsum の URL だけを返す", async () => {
		const plugin = createPlugin();
		await loadWith(plugin, { useUnsplashRandom: true });

		const urls = plugin.getImageUrls();

		expect(urls).toHaveLength(1);
		expect(urls[0]).toMatch(/^https:\/\/picsum\.photos\/1920\/1080\?random=\d+$/);
	});

	it("無効にした画像は含めない", async () => {
		const plugin = createPlugin();
		await loadWith(plugin, {
			useUnsplashRandom: false,
			images: [
				{ path: "https://example.com/on.jpg", enabled: true },
				{ path: "https://example.com/off.jpg", enabled: false },
			],
		});

		expect(plugin.getImageUrls()).toEqual(["https://example.com/on.jpg"]);
	});

	it("http:// と https:// の URL はそのまま返す", async () => {
		const plugin = createPlugin();
		await loadWith(plugin, {
			useUnsplashRandom: false,
			images: [
				{ path: "http://example.com/a.jpg", enabled: true },
				{ path: "https://example.com/b.jpg", enabled: true },
			],
		});

		expect(plugin.getImageUrls()).toEqual([
			"http://example.com/a.jpg",
			"https://example.com/b.jpg",
		]);
	});

	it("Vault 内のファイルはリソースパスに変換する", async () => {
		const plugin = createPlugin({ files: [makeFile("images/a.png")] });
		await loadWith(plugin, {
			useUnsplashRandom: false,
			images: [{ path: "images/a.png", enabled: true }],
		});

		expect(plugin.getImageUrls()).toEqual(["app://local/images/a.png"]);
	});

	it("Vault に無く、絶対パスも得られないファイルは含めない", async () => {
		const plugin = createPlugin();
		await loadWith(plugin, {
			useUnsplashRandom: false,
			images: [{ path: "missing.png", enabled: true }],
		});

		expect(plugin.getImageUrls()).toEqual([]);
	});

	it("Vault に無いファイルは、絶対パスが得られれば file:// URL にする", async () => {
		const plugin = createPlugin({
			getFullPath: (path) => `/vault/${path}`,
		});
		await loadWith(plugin, {
			useUnsplashRandom: false,
			images: [{ path: "outside.png", enabled: true }],
		});

		expect(plugin.getImageUrls()).toEqual(["file:///vault/outside.png"]);
	});

	it("1件の読み込みで例外が出ても、その画像だけ除いて警告し、他は返す", async () => {
		const plugin = createPlugin({
			getFullPath: (path) => {
				if (path === "broken.png") throw new Error("boom");
				return `/vault/${path}`;
			},
		});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await loadWith(plugin, {
			useUnsplashRandom: false,
			images: [
				{ path: "broken.png", enabled: true },
				{ path: "https://example.com/ok.jpg", enabled: true },
			],
		});

		expect(plugin.getImageUrls()).toEqual(["https://example.com/ok.jpg"]);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});
});

// startSlideshow() / nextSlide() が使う分だけを持つ、DOM の簡易版
class FakeElement {
	className = "";
	src = "";
	style: Record<string, string> = {};
	children: FakeElement[] = [];
	removed = false;
	constructor(public tagName: string) {}
	appendChild(child: FakeElement) {
		this.children.push(child);
		return child;
	}
	prepend(child: FakeElement) {
		this.children.unshift(child);
	}
	remove() {
		this.removed = true;
	}
	addClass(cls: string) {
		this.className = cls;
	}
	setCssProps(props: Record<string, string>) {
		Object.assign(this.style, props);
	}
	querySelector(tag: string): FakeElement | null {
		return this.children.find((c) => c.tagName === tag) ?? null;
	}
}

interface Deferred {
	url: string;
	resolve: (ok: boolean) => void;
}

describe("スライドの切り替え", () => {
	const DURATION_SECONDS = 10;
	let body: FakeElement & {
		classList: { add: () => void; remove: () => void };
		createDiv: () => FakeElement;
	};
	let loads: Deferred[];

	beforeEach(() => {
		vi.useFakeTimers();
		body = Object.assign(new FakeElement("body"), {
			classList: { add: () => {}, remove: () => {} },
			createDiv: () => new FakeElement("div"),
		});
		body.style = Object.assign(body.style, { setProperty: () => {} });
		vi.stubGlobal("document", {
			body,
			createElement: (tag: string) => new FakeElement(tag),
		});
		vi.stubGlobal("window", globalThis);
		vi.stubGlobal("getComputedStyle", () => ({
			backgroundColor: "rgb(1, 2, 3)",
		}));

		// 読み込みは呼ばれた順に記録し、テスト側で resolve するまで終わらない
		loads = [];
		vi.mocked(loadImage).mockReset();
		vi.mocked(loadImage).mockImplementation(
			(img, url) =>
				new Promise<boolean>((resolve) => {
					(img as unknown as FakeElement).src = url;
					loads.push({ url, resolve });
				}),
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const start = async (data: Record<string, unknown>) => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			duration: DURATION_SECONDS,
			...data,
		});
		await plugin.loadSettings();
		plugin.startSlideshow();
		const container = body.children[0]!;
		return { plugin, container };
	};

	const opacities = (container: FakeElement) =>
		container.children.map((layer) => layer.style.opacity);
	const srcs = (container: FakeElement) =>
		container.children.map((layer) => layer.querySelector("img")!.src);

	const tick = async () => {
		vi.advanceTimersByTime(DURATION_SECONDS * 1000);
		await Promise.resolve();
	};
	const settle = async (index: number, ok: boolean) => {
		loads[index]!.resolve(ok);
		// await の続きを実行させる
		await Promise.resolve();
		await Promise.resolve();
	};

	const urlImages = [
		{ path: "https://example.com/a.jpg", enabled: true },
		{ path: "https://example.com/b.jpg", enabled: true },
		{ path: "https://example.com/c.jpg", enabled: true },
	];

	it("登録画像が何枚あってもレイヤーは2枚だけ作り、起動時は1枚目だけ読み込む", async () => {
		const { container } = await start({
			useUnsplashRandom: false,
			images: urlImages,
		});

		expect(container.children).toHaveLength(2);
		expect(srcs(container)).toEqual(["https://example.com/a.jpg", ""]);
		expect(opacities(container)).toEqual(["1", "0"]);
	});

	it("次の画像の読み込みが終わるまではフェードを始めず、終わってから切り替える", async () => {
		const { container } = await start({
			useUnsplashRandom: false,
			images: urlImages,
		});

		await tick();
		expect(loads.map((l) => l.url)).toEqual(["https://example.com/b.jpg"]);
		expect(opacities(container)).toEqual(["1", "0"]);

		await settle(0, true);
		expect(opacities(container)).toEqual(["0", "1"]);
	});

	it("レイヤーを入れ替えながら、登録順に画像を切り替えて先頭に戻る", async () => {
		const { container } = await start({
			useUnsplashRandom: false,
			images: urlImages,
		});

		for (let i = 0; i < 3; i++) {
			await tick();
			await settle(i, true);
		}

		expect(loads.map((l) => l.url)).toEqual([
			"https://example.com/b.jpg",
			"https://example.com/c.jpg",
			"https://example.com/a.jpg",
		]);
		expect(opacities(container)).toEqual(["0", "1"]);
		expect(srcs(container)[1]).toBe("https://example.com/a.jpg");
	});

	it("ランダム画像では、切り替えのたびに新しい URL を1件作って読み込む", async () => {
		await start({ useUnsplashRandom: true });

		await tick();
		await settle(0, true);
		await tick();

		expect(loads).toHaveLength(2);
		for (const { url } of loads) {
			expect(url).toMatch(/^https:\/\/picsum\.photos\/1920\/1080\?random=\d+$/);
		}
	});

	it("読み込みに失敗したら切り替えを見送り、今の画像を表示し続ける", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { container } = await start({
			useUnsplashRandom: false,
			images: urlImages,
		});

		await tick();
		await settle(0, false);

		expect(opacities(container)).toEqual(["1", "0"]);
		expect(warn).toHaveBeenCalledTimes(1);

		// 次の回は同じ画像から改めて試す
		await tick();
		expect(loads[1]!.url).toBe("https://example.com/b.jpg");
		warn.mockRestore();
	});

	it("読み込み中に次の切り替え時刻が来ても、その回は何もしない", async () => {
		await start({ useUnsplashRandom: false, images: urlImages });

		await tick();
		await tick();

		expect(loads).toHaveLength(1);
	});

	it("停止後に読み込みが終わっても、画面を触らない", async () => {
		const { plugin, container } = await start({
			useUnsplashRandom: false,
			images: urlImages,
		});

		await tick();
		plugin.stopSlideshow();
		await settle(0, true);

		expect(opacities(container)).toEqual(["1", "0"]);
	});

	it("再起動後に古い読み込みが終わっても、新しいスライドショーに影響しない", async () => {
		const { plugin, container: oldContainer } = await start({
			useUnsplashRandom: false,
			images: urlImages,
		});

		await tick();
		plugin.startSlideshow();
		const newContainer = body.children[0]!;
		await settle(0, true);

		expect(opacities(oldContainer)).toEqual(["1", "0"]);
		expect(opacities(newContainer)).toEqual(["1", "0"]);

		// 新しいスライドショーは古い読み込みに妨げられず切り替えられる
		await tick();
		expect(loads).toHaveLength(2);
		await settle(1, true);
		expect(opacities(newContainer)).toEqual(["0", "1"]);
	});

	it("画像が1枚だけなら切り替えない", async () => {
		await start({
			useUnsplashRandom: false,
			images: [{ path: "https://example.com/a.jpg", enabled: true }],
		});

		await tick();

		expect(loads).toHaveLength(0);
	});
});

describe("css-change によるテーマ追従", () => {
	const DURATION_SECONDS = 10;
	let classes: Set<string>;
	let body: FakeElement & {
		classList: {
			add: (cls: string) => void;
			remove: (cls: string) => void;
			contains: (cls: string) => boolean;
		};
		createDiv: () => FakeElement;
	};

	beforeEach(() => {
		vi.useFakeTimers();
		classes = new Set();
		body = Object.assign(new FakeElement("body"), {
			classList: {
				add: (cls: string) => classes.add(cls),
				remove: (cls: string) => classes.delete(cls),
				contains: (cls: string) => classes.has(cls),
			},
			createDiv: () => new FakeElement("div"),
		});
		body.style = Object.assign(body.style, { setProperty: () => {} });
		vi.stubGlobal("document", {
			body,
			createElement: (tag: string) => new FakeElement(tag),
		});
		vi.stubGlobal("window", globalThis);
		vi.stubGlobal("getComputedStyle", () => ({
			backgroundColor: "rgb(1, 2, 3)",
		}));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	// onload() を実行し、登録された css-change のハンドラを取り出す
	const loadPlugin = async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			useUnsplashRandom: false,
			images: [{ path: "https://example.com/a.jpg", enabled: true }],
			duration: DURATION_SECONDS,
		});
		const registerEvent = vi.spyOn(plugin, "registerEvent");
		await plugin.onload();
		const { workspace } = plugin.app as unknown as {
			workspace: { on: Mock };
		};
		const on = workspace.on;
		const call = on.mock.calls.find(([name]) => name === "css-change");
		const handler = call?.[1] as () => void;
		return { plugin, registerEvent, handler, on };
	};

	it("css-change を登録し、戻り値を registerEvent に渡す", async () => {
		const { on, registerEvent } = await loadPlugin();

		expect(on).toHaveBeenCalledWith("css-change", expect.any(Function));
		expect(registerEvent).toHaveBeenCalledWith(on.mock.results[0]?.value);
	});

	it("透過を適用している間は、css-change で透過色を作り直す", async () => {
		const { plugin, handler } = await loadPlugin();
		plugin.startSlideshow();
		expect(classes.has("background-slideshow-active")).toBe(true);
		const apply = vi.spyOn(plugin, "applyTransparency");

		handler();

		expect(apply).toHaveBeenCalledTimes(1);
	});

	it("透過を適用していないときは、css-change で何もしない", async () => {
		const { plugin, handler } = await loadPlugin();
		const apply = vi.spyOn(plugin, "applyTransparency");

		handler();

		expect(classes.has("background-slideshow-active")).toBe(false);
		expect(apply).not.toHaveBeenCalled();
	});

	it("停止後の css-change では透過を再適用しない", async () => {
		const { plugin, handler } = await loadPlugin();
		plugin.startSlideshow();
		plugin.stopSlideshow();
		const apply = vi.spyOn(plugin, "applyTransparency");

		handler();

		expect(apply).not.toHaveBeenCalled();
	});
});
