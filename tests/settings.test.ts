import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, Setting, SettingGroup } from "obsidian";
import type BackgroundSlideshowPlugin from "../src/main";
import {
	BackgroundSlideshowSettingTab,
	DEFAULT_SETTINGS,
	type BackgroundSlideshowSettings,
	type ImageData,
} from "../src/settings";

type ChangeHandler<T> = (value: T) => unknown;

// render() が使う分だけを持つ、Setting と各コンポーネントの簡易版
class FakeText {
	value = "";
	placeholder = "";
	handler: ChangeHandler<string> | null = null;
	setValue(value: string) {
		this.value = value;
		return this;
	}
	setPlaceholder(placeholder: string) {
		this.placeholder = placeholder;
		return this;
	}
	onChange(handler: ChangeHandler<string>) {
		this.handler = handler;
		return this;
	}
	// ユーザーが入力欄に打ち込んだときと同じく、値を変えて onChange を呼ぶ
	input(value: string) {
		this.value = value;
		void this.handler?.(value);
	}
}

class FakeToggle {
	value = false;
	tooltip = "";
	handler: ChangeHandler<boolean> | null = null;
	setValue(value: boolean) {
		this.value = value;
		return this;
	}
	setTooltip(tooltip: string) {
		this.tooltip = tooltip;
		return this;
	}
	onChange(handler: ChangeHandler<boolean>) {
		this.handler = handler;
		return this;
	}
	async click(value: boolean) {
		this.value = value;
		await this.handler?.(value);
	}
}

class FakeSetting {
	name = "";
	text = new FakeText();
	toggle = new FakeToggle();
	setName(name: string) {
		this.name = name;
		return this;
	}
	addText(cb: (text: FakeText) => unknown) {
		cb(this.text);
		return this;
	}
	addToggle(cb: (toggle: FakeToggle) => unknown) {
		cb(this.toggle);
		return this;
	}
}

const setup = (
	images: ImageData[],
	overrides: Partial<BackgroundSlideshowSettings> = {},
) => {
	const settings: BackgroundSlideshowSettings = {
		...DEFAULT_SETTINGS,
		useUnsplashRandom: false,
		...overrides,
		images,
	};
	const plugin = {
		settings,
		saveSettings: vi.fn(async () => {}),
		startSlideshow: vi.fn(),
	};
	const tab = new BackgroundSlideshowSettingTab(
		{} as App,
		plugin as unknown as BackgroundSlideshowPlugin,
	);

	// 画像リストの1行目を組み立てる
	const list = tab
		.getSettingDefinitions()
		.find((item) => "type" in item && item.type === "list");
	if (!list || !("items" in list)) throw new Error("画像リストが見つかりません");
	const row = list.items?.[0];
	if (!row || !("render" in row) || !row.render) {
		throw new Error("画像の行が見つかりません");
	}
	const setting = new FakeSetting();
	// render() は group を使わないので空のオブジェクトを渡す
	row.render(setting as unknown as Setting, {} as SettingGroup);

	return { plugin, tab, setting };
};

describe("画像パスの入力", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("連続して入力しても、入力が止まるまで保存もスライドショーの作り直しもしない", async () => {
		const { plugin, setting } = setup([{ path: "", enabled: true }]);

		for (const value of ["i", "im", "img", "img/", "img/a.png"]) {
			setting.text.input(value);
			await vi.advanceTimersByTimeAsync(100);
		}

		expect(plugin.settings.images[0]?.path).toBe("img/a.png");
		expect(plugin.saveSettings).not.toHaveBeenCalled();
		expect(plugin.startSlideshow).not.toHaveBeenCalled();
	});

	it("最後の入力から1秒たつと、1回だけ保存してスライドショーを作り直す", async () => {
		const { plugin, setting } = setup([{ path: "", enabled: true }]);

		setting.text.input("a");
		setting.text.input("a.png");
		await vi.advanceTimersByTimeAsync(999);
		expect(plugin.saveSettings).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(plugin.startSlideshow).toHaveBeenCalledTimes(1);
	});

	it("入力のたびに待ち時間が延びる", async () => {
		const { plugin, setting } = setup([{ path: "", enabled: true }]);

		setting.text.input("a");
		await vi.advanceTimersByTimeAsync(600);
		setting.text.input("ab");
		await vi.advanceTimersByTimeAsync(600);
		expect(plugin.saveSettings).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(400);
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("スライドショーが無効なら、保存だけしてスライドショーは作り直さない", async () => {
		const { plugin, setting } = setup([{ path: "", enabled: true }], {
			enabled: false,
		});

		setting.text.input("a.png");
		await vi.advanceTimersByTimeAsync(1000);

		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(plugin.startSlideshow).not.toHaveBeenCalled();
	});

	it("入力に合わせて、行の見出しとプレースホルダーがすぐ変わる", () => {
		const { setting } = setup([{ path: "images/red.png", enabled: true }]);
		expect(setting.name).toBe("✓ Local - red.png");
		expect(setting.text.placeholder).toBe("path/to/image.png");

		setting.text.input("images/green.png");
		expect(setting.name).toBe("✓ Local - green.png");

		setting.text.input("https://example.com/blue.jpg");
		expect(setting.name).toBe("✓ URL - blue.jpg");
		expect(setting.text.placeholder).toBe("https://...");
	});
});

describe("設定画面を閉じたとき", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("待ち中の保存があれば、1秒を待たずにすぐ保存する", async () => {
		const { plugin, tab, setting } = setup([{ path: "", enabled: true }]);

		setting.text.input("a.png");
		tab.hide();
		await vi.advanceTimersByTimeAsync(0);

		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(plugin.startSlideshow).toHaveBeenCalledTimes(1);

		// 待ち中の分はもう消化しているので、1秒後に二重に保存しない
		await vi.advanceTimersByTimeAsync(1000);
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("待ち中の保存がなければ、何もしない", async () => {
		const { plugin, tab } = setup([{ path: "a.png", enabled: true }]);

		tab.hide();
		await vi.advanceTimersByTimeAsync(1000);

		expect(plugin.saveSettings).not.toHaveBeenCalled();
		expect(plugin.startSlideshow).not.toHaveBeenCalled();
	});
});

describe("画像の有効・無効のトグル", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("切り替えるとすぐ保存し、見出しの ✓ / ✗ も変わる", async () => {
		const { plugin, setting } = setup([{ path: "images/red.png", enabled: true }]);

		await setting.toggle.click(false);

		expect(plugin.settings.images[0]?.enabled).toBe(false);
		expect(setting.name).toBe("✗ Local - red.png");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(plugin.startSlideshow).toHaveBeenCalledTimes(1);
	});

	it("パスの入力直後に切り替えても、保存と作り直しは1回だけ", async () => {
		const { plugin, setting } = setup([{ path: "", enabled: true }]);

		setting.text.input("images/red.png");
		await setting.toggle.click(false);
		await vi.advanceTimersByTimeAsync(1000);

		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(plugin.startSlideshow).toHaveBeenCalledTimes(1);
		// パスの変更もトグルの保存に含まれている
		expect(plugin.settings.images[0]).toEqual({
			path: "images/red.png",
			enabled: false,
		});
		expect(setting.name).toBe("✗ Local - red.png");
	});
});
