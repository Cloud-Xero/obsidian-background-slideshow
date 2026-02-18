import { Plugin, TFile, normalizePath } from "obsidian";
import {
	type BackgroundSlideshowSettings,
	DEFAULT_SETTINGS,
	BackgroundSlideshowSettingTab,
} from "./settings";

export default class BackgroundSlideshowPlugin extends Plugin {
	settings: BackgroundSlideshowSettings;

	private backgroundContainer: HTMLElement | null = null;
	private layers: HTMLElement[] = [];
	private currentIndex = 0;
	private timer: number | null = null;
	private blobUrls: string[] = [];

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new BackgroundSlideshowSettingTab(this.app, this));

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
			return Array.from({ length: 5 }, () => this.generatePicsumUrl());
		}

		const urls: string[] = [];
		for (const imageData of this.settings.images) {
			if (!imageData.enabled) continue;

			const imagePath = imageData.path;
			if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
				urls.push(imagePath);
			} else {
				try {
					const normalizedPath = normalizePath(imagePath);
					const file = this.app.vault.getAbstractFileByPath(normalizedPath);
					if (file instanceof TFile) {
						const resourcePath = this.app.vault.getResourcePath(file);
						urls.push(resourcePath);
					} else {
						const adapter = this.app.vault.adapter as {
							getFullPath?: (path: string) => string;
						};
						if (adapter.getFullPath) {
							const fullPath = adapter.getFullPath(normalizedPath);
							urls.push(`file://${fullPath}`);
						}
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

	async startSlideshow() {
		this.stopSlideshow();

		this.backgroundContainer = document.createElement("div");
		this.backgroundContainer.className = "background-slideshow-container";
		document.body.prepend(this.backgroundContainer);

		const imageUrls = this.getImageUrls();
		if (imageUrls.length === 0) return;

		this.blobUrls = imageUrls.filter((url) => url.startsWith("blob:"));

		this.layers = [];
		imageUrls.forEach((url, index) => {
			const layer = document.createElement("div");
			layer.className = "background-slideshow-layer";

			const img = document.createElement("img");
			img.src = url;
			img.addClass("background-slideshow-image");

			layer.appendChild(img);
			layer.style.opacity = index === 0 ? "1" : "0";
			layer.style.transition = `opacity ${this.settings.fadeTime}s ease-in-out`;
			if (this.backgroundContainer) {
				this.backgroundContainer.appendChild(layer);
			}
			this.layers.push(layer);
		});

		this.applyTransparency();
		this.currentIndex = 0;
		this.startTimer();
	}

	private startTimer() {
		this.timer = window.setInterval(() => {
			this.nextSlide();
		}, this.settings.duration * 1000);
	}

	private nextSlide() {
		const totalImages = this.layers.length;
		if (totalImages <= 1) return;

		const currentLayer = this.layers[this.currentIndex];
		if (currentLayer) currentLayer.setCssProps({ opacity: "0" });

		this.currentIndex = (this.currentIndex + 1) % totalImages;

		const nextLayer = this.layers[this.currentIndex];
		if (this.settings.useUnsplashRandom && nextLayer) {
			const newUrl = this.generatePicsumUrl();
			const img = nextLayer.querySelector("img");
			if (img) img.src = newUrl;
		}

		if (nextLayer) nextLayer.setCssProps({ opacity: "1" });
	}

	stopSlideshow() {
		if (this.timer !== null) {
			window.clearInterval(this.timer);
			this.timer = null;
		}

		if (this.blobUrls.length > 0) {
			this.blobUrls.forEach((url) => URL.revokeObjectURL(url));
			this.blobUrls = [];
		}

		if (this.backgroundContainer) {
			this.backgroundContainer.remove();
			this.backgroundContainer = null;
		}

		this.layers = [];
		this.removeTransparency();
	}

	applyTransparency() {
		document.body.style.setProperty(
			"--background-transparent",
			`rgba(var(--background-primary-rgb), ${this.settings.paneOpacity})`,
		);
		document.body.style.setProperty(
			"--background-partially-transparent",
			`rgba(var(--background-primary-rgb), ${this.settings.uiOpacity})`,
		);
		document.body.style.setProperty(
			"--background-tabs-transparent",
			`rgba(var(--background-primary-rgb), ${this.settings.tabOpacity})`,
		);
		document.body.classList.add("background-slideshow-active");
	}

	private removeTransparency() {
		document.body.classList.remove("background-slideshow-active");
	}
}
