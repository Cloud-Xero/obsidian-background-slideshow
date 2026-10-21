import type { App } from "obsidian";
import type { BackgroundSlideshowSettings } from "./settings";
import { loadImage } from "./image-loader";
import { findVaultFile } from "./vault-file";
import { applyTransparency, removeTransparency } from "./transparency";

function generatePicsumUrl(): string {
	const random = Math.floor(Math.random() * 1000);
	return `https://picsum.photos/1920/1080?random=${random}`;
}

export class Slideshow {
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

	// 設定オブジェクトは読み込み時に差し替わるため、毎回 getter から最新のものを取る
	constructor(
		private readonly app: App,
		private readonly getSettings: () => BackgroundSlideshowSettings,
	) {}

	private get settings(): BackgroundSlideshowSettings {
		return this.getSettings();
	}

	getImageUrls(): string[] {
		if (this.settings.useUnsplashRandom) {
			// 起動時は1枚目の分だけ作る。以降は切り替えのたびに1件ずつ作る
			return [generatePicsumUrl()];
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

	start(): void {
		this.stop();

		// 画像が0枚なら、空のコンテナを挿入せずに終える
		const imageUrls = this.getImageUrls();
		if (imageUrls.length === 0) return;

		const container = document.createElement("div");
		container.className = "background-slideshow-container";
		document.body.prepend(container);
		this.backgroundContainer = container;

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
			container.appendChild(layer);
			return layer;
		});

		applyTransparency(this.settings);
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
			? generatePicsumUrl()
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

	stop(): void {
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
		removeTransparency();
	}
}
