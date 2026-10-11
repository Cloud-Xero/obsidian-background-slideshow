import { describe, expect, it, vi } from "vitest";
import { TFile, type App, type PluginManifest } from "obsidian";
import BackgroundSlideshowPlugin from "../src/main";
import type { ImageData } from "../src/settings";

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

	it("ランダム画像が有効なときは Lorem Picsum の URL を5件返す", async () => {
		const plugin = createPlugin();
		await loadWith(plugin, { useUnsplashRandom: true });

		const urls = plugin.getImageUrls();

		expect(urls).toHaveLength(5);
		for (const url of urls) {
			expect(url).toMatch(/^https:\/\/picsum\.photos\/1920\/1080\?random=\d+$/);
		}
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
