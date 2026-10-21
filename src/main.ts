import { Plugin } from "obsidian";
import {
	type BackgroundSlideshowSettings,
	DEFAULT_SETTINGS,
	BackgroundSlideshowSettingTab,
} from "./settings";
import { Slideshow } from "./slideshow";
import { applyTransparency, isTransparencyActive } from "./transparency";

export default class BackgroundSlideshowPlugin extends Plugin {
	settings: BackgroundSlideshowSettings;

	private readonly slideshow = new Slideshow(this.app, () => this.settings);

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new BackgroundSlideshowSettingTab(this.app, this));

		// テーマや CSS が変わったとき、透過を適用している間だけ新しい色で作り直す
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				if (isTransparencyActive()) {
					this.applyTransparency();
				}
			}),
		);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.enabled) {
				this.startSlideshow();
			}
		});

		this.addCommand({
			id: "toggle-slideshow",
			name: "Toggle",
			callback: () => {
				this.settings.enabled = !this.settings.enabled;
				void this.saveSettings();
				if (this.settings.enabled) {
					this.startSlideshow();
				} else {
					this.stopSlideshow();
				}
			},
		});
	}

	onunload() {
		this.stopSlideshow();
	}

	async loadSettings() {
		const savedData =
			(await this.loadData()) as Partial<BackgroundSlideshowSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

		// 既存設定のマイグレーション（文字列配列 → オブジェクト配列）
		if (
			this.settings.images.length > 0 &&
			typeof this.settings.images[0] === "string"
		) {
			this.settings.images = (this.settings.images as unknown as string[]).map(
				(path) => ({
					path,
					enabled: true,
				}),
			);
			await this.saveSettings();
		}

		// デフォルト値や読み込んだデータのオブジェクトと配列・要素を共有しないよう複製する
		this.settings.images = this.settings.images.map((imageData) => ({
			...imageData,
		}));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getImageUrls(): string[] {
		return this.slideshow.getImageUrls();
	}

	startSlideshow() {
		this.slideshow.start();
	}

	stopSlideshow() {
		this.slideshow.stop();
	}

	applyTransparency() {
		applyTransparency(this.settings);
	}
}
