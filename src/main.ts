import { Plugin } from "obsidian";
import {
	type BackgroundSlideshowSettings,
	DEFAULT_SETTINGS,
	BackgroundSlideshowSettingTab,
} from "./settings";
import { loadImage } from "./image-loader";
import { findVaultFile } from "./vault-file";

export default class BackgroundSlideshowPlugin extends Plugin {
	settings: BackgroundSlideshowSettings;

	private backgroundContainer: HTMLElement | null = null;
	// 「表示中」と「次」の2枚だけを持ち、切り替えのたびに入れ替える
	private layers: HTMLElement[] = [];
	private activeLayerIndex = 0;
	// 表示中の画像の番号（レイヤーとは別に管理する）
	private imageUrls: string[] = [];
	private currentImageIndex = 0;
	private isLoading = false;
	// 停止・再起動のたびに増やし、古い読み込みの完了を無視するために使う
	private generation = 0;
	private timer: number | null = null;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new BackgroundSlideshowSettingTab(this.app, this));

		// テーマや CSS が変わったとき、透過を適用している間だけ新しい色で作り直す
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				if (document.body.classList.contains("background-slideshow-active")) {
					this.applyTransparency();
				}
			}),
		);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.enabled) {
				void this.startSlideshow();
			}
		});

		this.addCommand({
			id: "toggle-slideshow",
			name: "Toggle",
			callback: () => {
				this.settings.enabled = !this.settings.enabled;
				void this.saveSettings();
				if (this.settings.enabled) {
					void this.startSlideshow();
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

	private generatePicsumUrl(): string {
		const random = Math.floor(Math.random() * 1000);
		return `https://picsum.photos/1920/1080?random=${random}`;
	}

	getImageUrls(): string[] {
		if (this.settings.useUnsplashRandom) {
			// 起動時は1枚目の分だけ作る。以降は切り替えのたびに1件ずつ作る
			return [this.generatePicsumUrl()];
		}

		const urls: string[] = [];
		for (const imageData of this.settings.images) {
			if (!imageData.enabled) continue;

			const imagePath = imageData.path;
			if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
				urls.push(imagePath);
			} else {
				try {
					// Vault の外のファイルは読まない。見つからないものは警告して飛ばす
					const file = findVaultFile(this.app, imagePath);
					if (file) {
						urls.push(this.app.vault.getResourcePath(file));
					} else {
						console.warn(
							"[BackgroundSlideshow] Image not found in vault, skipping:",
							imagePath,
						);
					}
				} catch (error) {
					console.warn(
						"[BackgroundSlideshow] Failed to load image:",
						imagePath,
						error,
					);
				}
			}
		}
		return urls;
	}

	startSlideshow() {
		this.stopSlideshow();

		this.backgroundContainer = document.createElement("div");
		this.backgroundContainer.className = "background-slideshow-container";
		document.body.prepend(this.backgroundContainer);

		const imageUrls = this.getImageUrls();
		if (imageUrls.length === 0) return;

		this.imageUrls = imageUrls;

		this.layers = [0, 1].map((index) => {
			const layer = document.createElement("div");
			layer.className = "background-slideshow-layer";

			const img = document.createElement("img");
			img.addClass("background-slideshow-image");
			// 起動時に読み込むのは表示する1枚目だけ
			if (index === 0 && imageUrls[0]) img.src = imageUrls[0];

			layer.appendChild(img);
			layer.style.opacity = index === 0 ? "1" : "0";
			layer.style.transition = `opacity ${this.settings.fadeTime}s ease-in-out`;
			this.backgroundContainer?.appendChild(layer);
			return layer;
		});

		this.applyTransparency();
		this.activeLayerIndex = 0;
		this.currentImageIndex = 0;
		this.startTimer();
	}

	private startTimer() {
		this.timer = window.setInterval(() => {
			void this.nextSlide();
		}, this.settings.duration * 1000);
	}

	private async nextSlide() {
		// 前回の読み込みがまだ終わっていなければ、この回は何もしない
		if (this.isLoading) return;

		const useRandom = this.settings.useUnsplashRandom;
		if (!useRandom && this.imageUrls.length <= 1) return;

		const nextImageIndex = useRandom
			? 0
			: (this.currentImageIndex + 1) % this.imageUrls.length;
		const nextUrl = useRandom
			? this.generatePicsumUrl()
			: this.imageUrls[nextImageIndex];
		const nextLayerIndex = 1 - this.activeLayerIndex;
		const currentLayer = this.layers[this.activeLayerIndex];
		const nextLayer = this.layers[nextLayerIndex];
		const img = nextLayer?.querySelector("img");
		if (!nextUrl || !currentLayer || !nextLayer || !img) return;

		const generation = this.generation;
		this.isLoading = true;
		const loaded = await loadImage(img, nextUrl);

		// 読み込み中に停止・再起動された場合は、古い処理から画面を触らない
		if (generation !== this.generation) return;
		this.isLoading = false;

		if (!loaded) {
			// 失敗したらこの回の切り替えは見送り、今の画像を表示し続ける
			console.warn("[BackgroundSlideshow] Failed to load image:", nextUrl);
			return;
		}

		currentLayer.setCssProps({ opacity: "0" });
		nextLayer.setCssProps({ opacity: "1" });
		this.activeLayerIndex = nextLayerIndex;
		this.currentImageIndex = nextImageIndex;
	}

	stopSlideshow() {
		this.generation++;
		this.isLoading = false;

		if (this.timer !== null) {
			window.clearInterval(this.timer);
			this.timer = null;
		}

		if (this.backgroundContainer) {
			this.backgroundContainer.remove();
			this.backgroundContainer = null;
		}

		this.layers = [];
		this.imageUrls = [];
		this.removeTransparency();
	}

	private getBackgroundRgb(): string {
		// CSS クラスを使って一時要素を作成し、ブラウザに --background-primary を
		// 解決させた rgb() 値を取得する。
		const el = document.body.createDiv({
			cls: "background-slideshow-color-probe",
		});
		const color = getComputedStyle(el).backgroundColor;
		el.remove();

		// ブラウザは常に "rgb(r, g, b)" または "rgba(r, g, b, a)" で返す
		const match = color.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
		if (match) {
			return `${match[1]}, ${match[2]}, ${match[3]}`;
		}

		return "30, 30, 30";
	}

	applyTransparency() {
		const rgb = this.getBackgroundRgb();
		document.body.style.setProperty(
			"--background-transparent",
			`rgba(${rgb}, ${this.settings.paneOpacity})`,
		);
		document.body.style.setProperty(
			"--background-partially-transparent",
			`rgba(${rgb}, ${this.settings.uiOpacity})`,
		);
		document.body.style.setProperty(
			"--background-tabs-transparent",
			`rgba(${rgb}, ${this.settings.tabOpacity})`,
		);
		document.body.classList.add("background-slideshow-active");
	}

	private removeTransparency() {
		document.body.classList.remove("background-slideshow-active");
	}
}
