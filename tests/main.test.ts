import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { TFile, type App, type PluginManifest } from "obsidian";
import BackgroundSlideshowPlugin from "../src/main";
import { loadImage } from "../src/image-loader";
import { DEFAULT_SETTINGS, type ImageData } from "../src/settings";

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
	// このパスを調べると例外を投げる（想定外のエラーの再現用）
	throwOn?: string[];
}

const createPlugin = (options: FakeVaultOptions = {}) => {
	const files = new Map((options.files ?? []).map((f) => [f.path, f]));
	const throwOn = options.throwOn ?? [];
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => {
				if (throwOn.includes(path)) throw new Error("boom");
				return files.get(path) ?? null;
			},
			getResourcePath: (file: TFile) => `app://local/${file.path}`,
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

	it("旧キー useUnsplashRandom の値を useRandomImages に移し、旧キーを消して保存する", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({ useUnsplashRandom: false });
		const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue();

		await plugin.loadSettings();

		expect(plugin.settings.useRandomImages).toBe(false);
		expect(plugin.settings).not.toHaveProperty("useUnsplashRandom");
		expect(saveData).toHaveBeenCalledTimes(1);
		const saved = saveData.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(saved.useRandomImages).toBe(false);
		expect(saved).not.toHaveProperty("useUnsplashRandom");
	});

	it("新キーがすでにあるときは旧キーの値で上書きしない", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			useUnsplashRandom: false,
			useRandomImages: true,
		});
		vi.spyOn(plugin, "saveData").mockResolvedValue();

		await plugin.loadSettings();

		expect(plugin.settings.useRandomImages).toBe(true);
		expect(plugin.settings).not.toHaveProperty("useUnsplashRandom");
	});

	it("旧キーが無いときは保存し直さない", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({ useRandomImages: false });
		const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue();

		await plugin.loadSettings();

		expect(plugin.settings.useRandomImages).toBe(false);
		expect(saveData).not.toHaveBeenCalled();
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

	it("保存データが無いとき、画像リストはデフォルト値と別の配列になる", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue(null);

		await plugin.loadSettings();
		plugin.settings.images.push({ path: "a.png", enabled: true });

		expect(plugin.settings.images).not.toBe(DEFAULT_SETTINGS.images);
		expect(DEFAULT_SETTINGS.images).toEqual([]);
	});

	it("設定の画像を追加しても、デフォルト値の画像リストは空のままになる", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({});

		await plugin.loadSettings();
		plugin.settings.images.push({ path: "a.png", enabled: true });
		plugin.settings.images.splice(0, 1);

		expect(DEFAULT_SETTINGS.images).toEqual([]);
	});

	it("保存データの要素を書き換えても、読み込み元のデータは変わらない", async () => {
		const plugin = createPlugin();
		const saved = { images: [{ path: "a.png", enabled: true }] };
		vi.spyOn(plugin, "loadData").mockResolvedValue(saved);

		await plugin.loadSettings();
		const first = plugin.settings.images[0];
		if (!first) throw new Error("画像が読み込まれていません");
		first.enabled = false;
		first.path = "b.png";

		expect(saved.images).toEqual([{ path: "a.png", enabled: true }]);
	});

	it("保存データの画像リストに追加・削除しても、読み込み元の配列は変わらない", async () => {
		const plugin = createPlugin();
		const saved = { images: [{ path: "a.png", enabled: true }] };
		vi.spyOn(plugin, "loadData").mockResolvedValue(saved);

		await plugin.loadSettings();
		plugin.settings.images.push({ path: "b.png", enabled: true });
		plugin.settings.images.shift();

		expect(plugin.settings.images).not.toBe(saved.images);
		expect(saved.images).toEqual([{ path: "a.png", enabled: true }]);
	});

	it("別のインスタンスで読み込んだ設定は、画像リストを共有しない", async () => {
		const first = createPlugin();
		const second = createPlugin();
		vi.spyOn(first, "loadData").mockResolvedValue(null);
		vi.spyOn(second, "loadData").mockResolvedValue(null);

		await first.loadSettings();
		await second.loadSettings();
		first.settings.images.push({ path: "a.png", enabled: true });

		expect(second.settings.images).toEqual([]);
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
		await loadWith(plugin, { useRandomImages: true });

		const urls = plugin.getImageUrls();

		expect(urls).toHaveLength(1);
		expect(urls[0]).toMatch(/^https:\/\/picsum\.photos\/1920\/1080\?random=\d+$/);
	});

	it("無効にした画像は含めない", async () => {
		const plugin = createPlugin();
		await loadWith(plugin, {
			useRandomImages: false,
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
			useRandomImages: false,
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
			useRandomImages: false,
			images: [{ path: "images/a.png", enabled: true }],
		});

		expect(plugin.getImageUrls()).toEqual(["app://local/images/a.png"]);
	});

	it("Vault に無いファイルは含めず、警告を出して飛ばす（file:// にはしない）", async () => {
		const plugin = createPlugin();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await loadWith(plugin, {
			useRandomImages: false,
			images: [{ path: "/outside/missing.png", enabled: true }],
		});

		expect(plugin.getImageUrls()).toEqual([]);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("not found"),
			"/outside/missing.png",
		);
		warn.mockRestore();
	});

	it("1件の読み込みで例外が出ても、その画像だけ除いて警告し、他は返す", async () => {
		const plugin = createPlugin({ throwOn: ["broken.png"] });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await loadWith(plugin, {
			useRandomImages: false,
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
	// Obsidian の createEl / createDiv と同じく、作った要素を親の末尾に追加する
	createEl(tag: string, opts?: { cls?: string }): FakeElement {
		return this.appendChild(newFakeElement(tag, opts));
	}
	createDiv(opts?: { cls?: string }): FakeElement {
		return this.appendChild(newFakeElement("div", opts));
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

// Obsidian のグローバル createEl / createDiv と同じく、親に付けずに要素を作る
function newFakeElement(tag: string, opts?: { cls?: string }): FakeElement {
	const el = new FakeElement(tag);
	if (opts?.cls) el.className = opts.cls;
	return el;
}

// document.body と、Obsidian のグローバル createDiv を差し替える
function stubDom(body: FakeElement) {
	vi.stubGlobal("document", { body });
	vi.stubGlobal("createDiv", (opts?: { cls?: string }) =>
		newFakeElement("div", opts),
	);
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
		body.style = Object.assign(body.style, {
			setProperty: () => {},
			removeProperty: () => {},
		});
		stubDom(body);
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
			useRandomImages: false,
			images: urlImages,
		});

		expect(container.children).toHaveLength(2);
		expect(srcs(container)).toEqual(["https://example.com/a.jpg", ""]);
		expect(opacities(container)).toEqual(["1", "0"]);
	});

	it("次の画像の読み込みが終わるまではフェードを始めず、終わってから切り替える", async () => {
		const { container } = await start({
			useRandomImages: false,
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
			useRandomImages: false,
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
		await start({ useRandomImages: true });

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
			useRandomImages: false,
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
		await start({ useRandomImages: false, images: urlImages });

		await tick();
		await tick();

		expect(loads).toHaveLength(1);
	});

	it("停止後に読み込みが終わっても、画面を触らない", async () => {
		const { plugin, container } = await start({
			useRandomImages: false,
			images: urlImages,
		});

		await tick();
		plugin.stopSlideshow();
		await settle(0, true);

		expect(opacities(container)).toEqual(["1", "0"]);
	});

	it("再起動後に古い読み込みが終わっても、新しいスライドショーに影響しない", async () => {
		const { plugin, container: oldContainer } = await start({
			useRandomImages: false,
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
			useRandomImages: false,
			images: [{ path: "https://example.com/a.jpg", enabled: true }],
		});

		await tick();

		expect(loads).toHaveLength(0);
	});

	it("停止しても、画面の部品を片付けるだけで URL の解放は行わない", async () => {
		const revoke = vi.spyOn(URL, "revokeObjectURL");
		const { plugin } = await start({
			useRandomImages: false,
			images: urlImages,
		});

		const container = body.children[0]!;

		plugin.stopSlideshow();

		expect(container.removed).toBe(true);
		expect(revoke).not.toHaveBeenCalled();
		revoke.mockRestore();
	});

	it("停止と再起動を繰り返しても、古い背景は取り除かれ最新の1組だけが残り、URL の解放は行わない", async () => {
		const revoke = vi.spyOn(URL, "revokeObjectURL");
		const { plugin } = await start({
			useRandomImages: false,
			images: urlImages,
		});

		const first = body.children[0]!;

		plugin.startSlideshow();
		const second = body.children[0]!;
		plugin.stopSlideshow();
		plugin.startSlideshow();
		const third = body.children[0]!;

		expect([first.removed, second.removed, third.removed]).toEqual([
			true,
			true,
			false,
		]);
		expect(third.children).toHaveLength(2);
		expect(revoke).not.toHaveBeenCalled();
		revoke.mockRestore();
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
		body.style = Object.assign(body.style, {
			setProperty: () => {},
			removeProperty: () => {},
		});
		stubDom(body);
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
			useRandomImages: false,
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

	it("css-change で、変わった背景色を透過色に反映する", async () => {
		const { plugin, handler } = await loadPlugin();
		plugin.startSlideshow();
		const vars = new Map<string, string>();
		(
			body.style as unknown as {
				setProperty: (name: string, value: string) => void;
			}
		).setProperty = (name, value) => {
			vars.set(name, value);
		};
		const opacity = plugin.settings.paneOpacity;
		vi.stubGlobal("getComputedStyle", () => ({
			backgroundColor: "rgb(200, 100, 50)",
		}));

		handler();

		expect(vars.get("--background-transparent")).toBe(
			`rgba(200, 100, 50, ${opacity})`,
		);
	});
});

describe("透過用 CSS 変数の後片付け", () => {
	const DURATION_SECONDS = 10;
	const TRANSPARENCY_VARS = [
		"--background-transparent",
		"--background-partially-transparent",
		"--background-tabs-transparent",
	];
	let vars: Map<string, string>;
	let classes: Set<string>;
	let body: FakeElement;

	beforeEach(() => {
		vi.useFakeTimers();
		vars = new Map();
		classes = new Set();
		body = Object.assign(new FakeElement("body"), {
			classList: {
				add: (cls: string) => classes.add(cls),
				remove: (cls: string) => classes.delete(cls),
				contains: (cls: string) => classes.has(cls),
			},
			createDiv: () => new FakeElement("div"),
		});
		body.style = Object.assign(body.style, {
			setProperty: (name: string, value: string) => vars.set(name, value),
			removeProperty: (name: string) => vars.delete(name),
		});
		stubDom(body);
		vi.stubGlobal("window", globalThis);
		vi.stubGlobal("getComputedStyle", () => ({
			backgroundColor: "rgb(1, 2, 3)",
		}));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const loadPlugin = async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			useRandomImages: false,
			images: [{ path: "https://example.com/a.jpg", enabled: true }],
			duration: DURATION_SECONDS,
		});
		await plugin.loadSettings();
		return plugin;
	};

	it("スライドショーを開始すると3つの変数とクラスが設定される", async () => {
		const plugin = await loadPlugin();

		plugin.startSlideshow();

		for (const name of TRANSPARENCY_VARS) {
			expect(vars.has(name)).toBe(true);
		}
		expect(classes.has("background-slideshow-active")).toBe(true);
	});

	it("スライドショーを停止すると、3つの変数とクラスが body から消える", async () => {
		const plugin = await loadPlugin();
		plugin.startSlideshow();

		plugin.stopSlideshow();

		expect([...vars.keys()]).toEqual([]);
		expect(classes.has("background-slideshow-active")).toBe(false);
	});

	it("プラグインを無効化（onunload）したときも、3つの変数が残らない", async () => {
		const plugin = await loadPlugin();
		plugin.startSlideshow();

		plugin.onunload();

		for (const name of TRANSPARENCY_VARS) {
			expect(vars.has(name)).toBe(false);
		}
	});

	it("停止しても、透過用以外の body の変数は消さない", async () => {
		const plugin = await loadPlugin();
		vars.set("--other-var", "keep");
		plugin.startSlideshow();

		plugin.stopSlideshow();

		expect([...vars.keys()]).toEqual(["--other-var"]);
	});

	it("停止後に再び開始すると、変数が改めて設定される", async () => {
		const plugin = await loadPlugin();
		plugin.startSlideshow();
		plugin.stopSlideshow();

		plugin.startSlideshow();

		for (const name of TRANSPARENCY_VARS) {
			expect(vars.has(name)).toBe(true);
		}
		expect(classes.has("background-slideshow-active")).toBe(true);
	});

	it("画像が0枚のときは、コンテナを挿入せず透過用のクラスと変数も付けない", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			useRandomImages: false,
			images: [],
			duration: DURATION_SECONDS,
		});
		await plugin.loadSettings();

		plugin.startSlideshow();

		expect(body.children).toHaveLength(0);
		expect(classes.has("background-slideshow-active")).toBe(false);
		expect([...vars.keys()]).toEqual([]);
	});

	it("有効な画像が無いときも、コンテナを挿入しない", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			useRandomImages: false,
			images: [{ path: "https://example.com/a.jpg", enabled: false }],
			duration: DURATION_SECONDS,
		});
		await plugin.loadSettings();

		plugin.startSlideshow();

		expect(body.children).toHaveLength(0);
		expect(classes.has("background-slideshow-active")).toBe(false);
	});
});
