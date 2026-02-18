import {
	type App,
	Modal,
	PluginSettingTab,
	Setting,
	type TFile,
} from "obsidian";
import type BackgroundSlideshowPlugin from "./main";

export interface ImageData {
	path: string;
	enabled: boolean;
}

export interface BackgroundSlideshowSettings {
	enabled: boolean;
	images: ImageData[];
	duration: number;
	fadeTime: number;
	paneOpacity: number;
	uiOpacity: number;
	tabOpacity: number;
	useUnsplashRandom: boolean;
}

export const DEFAULT_SETTINGS: BackgroundSlideshowSettings = {
	enabled: true,
	images: [],
	duration: 60,
	fadeTime: 5,
	paneOpacity: 0.85,
	uiOpacity: 0.85,
	tabOpacity: 0.85,
	useUnsplashRandom: true,
};

export class MultiImageSelectModal extends Modal {
	private onChoose: (files: TFile[]) => void;
	private selectedFiles: TFile[];

	constructor(app: App, onChoose: (files: TFile[]) => void) {
		super(app);
		this.onChoose = onChoose;
		this.selectedFiles = [];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Select images" });

		const imageExtensions = [
			"jpg",
			"jpeg",
			"png",
			"gif",
			"webp",
			"svg",
			"bmp",
			"heic",
			"heif",
		];
		const imageFiles = this.app.vault
			.getFiles()
			.filter((file) => imageExtensions.includes(file.extension.toLowerCase()));

		const listContainer = contentEl.createDiv({
			cls: "multi-image-select-list",
		});

		imageFiles.forEach((file) => {
			const itemEl = listContainer.createDiv({
				cls: "multi-image-select-item",
			});

			const checkbox = itemEl.createEl("input", { type: "checkbox" });
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedFiles.push(file);
				} else {
					const index = this.selectedFiles.indexOf(file);
					if (index > -1) this.selectedFiles.splice(index, 1);
				}
			});

			itemEl.createSpan({ text: file.path });
		});

		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
		});

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		const okButton = buttonContainer.createEl("button", {
			text: "Add selected",
			cls: "mod-cta",
		});
		okButton.addEventListener("click", () => {
			this.onChoose(this.selectedFiles);
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class BackgroundSlideshowSettingTab extends PluginSettingTab {
	plugin: BackgroundSlideshowPlugin;

	constructor(app: App, plugin: BackgroundSlideshowPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const scrollPosition = containerEl.scrollTop;
		containerEl.empty();

		setTimeout(() => {
			containerEl.scrollTop = scrollPosition;
		}, 0);

		// 有効/無効トグル
		new Setting(containerEl)
			.setName("Enable slideshow")
			.setDesc("Toggle background image slideshow")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
						if (value) {
							void this.plugin.startSlideshow();
						} else {
							this.plugin.stopSlideshow();
						}
					}),
			);

		// 表示時間
		new Setting(containerEl)
			.setName("Duration (seconds)")
			.setDesc("How long each image is displayed")
			.addText((text) =>
				text
					.setPlaceholder("60")
					.setValue(String(this.plugin.settings.duration))
					.onChange(async (value) => {
						const num = Number(value);
						if (!Number.isNaN(num) && num > 0) {
							this.plugin.settings.duration = num;
							await this.plugin.saveSettings();
							if (this.plugin.settings.enabled)
								void this.plugin.startSlideshow();
						}
					}),
			);

		// フェード時間
		new Setting(containerEl)
			.setName("Fade time (seconds)")
			.setDesc("Duration of fade transition between images")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.fadeTime))
					.onChange(async (value) => {
						const num = Number(value);
						if (!Number.isNaN(num) && num > 0) {
							this.plugin.settings.fadeTime = num;
							await this.plugin.saveSettings();
							if (this.plugin.settings.enabled)
								void this.plugin.startSlideshow();
						}
					}),
			);

		// ランダム画像設定
		new Setting(containerEl).setName("Random images").setHeading();

		new Setting(containerEl)
			.setName("Use random images")
			.setDesc(
				"Use random photos from picsum.photos instead of manual image paths",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useUnsplashRandom)
					.onChange(async (value) => {
						this.plugin.settings.useUnsplashRandom = value;
						await this.plugin.saveSettings();
						this.display();
						if (this.plugin.settings.enabled) void this.plugin.startSlideshow();
					}),
			);

		if (this.plugin.settings.useUnsplashRandom) {
			containerEl.createDiv({
				text: "Using Lorem Picsum for high-quality random photos.",
				cls: "setting-item-description",
			});
		}

		// 画像リスト（ランダムモードがオフの場合のみ表示）
		if (!this.plugin.settings.useUnsplashRandom) {
			new Setting(containerEl).setName("Images").setHeading();

			this.plugin.settings.images.forEach((imageData, index) => {
				const isUrl =
					imageData.path.startsWith("http://") ||
					imageData.path.startsWith("https://");
				const imageType = isUrl ? "URL" : "Local";
				const statusIcon = imageData.enabled ? "✓" : "✗";
				const pathParts = imageData.path.split("/");
				const displayName =
					pathParts[pathParts.length - 1] || `Image ${index + 1}`;

				const setting = new Setting(containerEl)
					.setName(`${statusIcon} ${imageType} - ${displayName}`)
					.addExtraButton((button) =>
						button
							.setIcon("arrow-up")
							.setTooltip("Move up")
							.onClick(async () => {
								if (index > 0) {
									const prev = this.plugin.settings.images[index - 1];
									const curr = this.plugin.settings.images[index];
									if (prev !== undefined && curr !== undefined) {
										this.plugin.settings.images[index - 1] = curr;
										this.plugin.settings.images[index] = prev;
									}
									await this.plugin.saveSettings();
									this.display();
									if (this.plugin.settings.enabled)
										void this.plugin.startSlideshow();
								}
							}),
					)
					.addExtraButton((button) =>
						button
							.setIcon("arrow-down")
							.setTooltip("Move down")
							.onClick(async () => {
								if (index < this.plugin.settings.images.length - 1) {
									const curr = this.plugin.settings.images[index];
									const next = this.plugin.settings.images[index + 1];
									if (curr !== undefined && next !== undefined) {
										this.plugin.settings.images[index] = next;
										this.plugin.settings.images[index + 1] = curr;
									}
									await this.plugin.saveSettings();
									this.display();
									if (this.plugin.settings.enabled)
										void this.plugin.startSlideshow();
								}
							}),
					)
					.addText((text) =>
						text
							.setPlaceholder(isUrl ? "https://..." : "path/to/image.png")
							.setValue(imageData.path)
							.onChange(async (value) => {
								const entry = this.plugin.settings.images[index];
								if (entry) entry.path = value;
								await this.plugin.saveSettings();
								if (this.plugin.settings.enabled)
									void this.plugin.startSlideshow();
							}),
					)
					.addToggle((toggle) =>
						toggle
							.setValue(imageData.enabled)
							.setTooltip(
								imageData.enabled ? "Disable this image" : "Enable this image",
							)
							.onChange(async (value) => {
								const entry = this.plugin.settings.images[index];
								if (entry) entry.enabled = value;
								await this.plugin.saveSettings();
								this.display();
								if (this.plugin.settings.enabled)
									void this.plugin.startSlideshow();
							}),
					)
					.addButton((button) =>
						button
							.setButtonText("Delete")
							.setWarning()
							.onClick(async () => {
								this.plugin.settings.images.splice(index, 1);
								await this.plugin.saveSettings();
								this.display();
								if (this.plugin.settings.enabled)
									void this.plugin.startSlideshow();
							}),
					);

				// ドラッグ&ドロップ
				const settingEl = setting.settingEl;
				settingEl.draggable = true;
				settingEl.dataset.index = index.toString();

				settingEl.addEventListener("dragstart", (e: DragEvent) => {
					if (e.dataTransfer) {
						e.dataTransfer.effectAllowed = "move";
						e.dataTransfer.setData("text/plain", index.toString());
					}
					settingEl.setCssProps({ opacity: "0.5" });
				});
				settingEl.addEventListener("dragend", () => {
					settingEl.setCssProps({ opacity: "1" });
				});
				settingEl.addEventListener("dragover", (e: DragEvent) => {
					e.preventDefault();
					if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
					settingEl.setCssProps({
						"border-top": "2px solid var(--interactive-accent)",
					});
				});
				settingEl.addEventListener("dragleave", () => {
					settingEl.setCssProps({ "border-top": "" });
				});
				settingEl.addEventListener("drop", (e: DragEvent) => {
					e.preventDefault();
					settingEl.setCssProps({ "border-top": "" });
					if (!e.dataTransfer) return;
					const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
					if (fromIndex !== index) {
						const item = this.plugin.settings.images.splice(fromIndex, 1)[0];
						if (item !== undefined) {
							this.plugin.settings.images.splice(index, 0, item);
						}
						void this.plugin.saveSettings().then(() => {
							this.display();
							if (this.plugin.settings.enabled)
								void this.plugin.startSlideshow();
						});
					}
				});
			});

			// Vault内画像を追加
			new Setting(containerEl)
				.setName("Add image from vault")
				.setDesc("Select images from your Obsidian vault (multiple selection)")
				.addButton((button) =>
					button.setButtonText("Browse vault").onClick(() => {
						new MultiImageSelectModal(this.app, (files) => {
							void (async () => {
								for (const file of files) {
									this.plugin.settings.images.push({
										path: file.path,
										enabled: true,
									});
								}
								await this.plugin.saveSettings();
								this.display();
								if (this.plugin.settings.enabled)
									void this.plugin.startSlideshow();
							})();
						}).open();
					}),
				);

			// URL追加
			new Setting(containerEl)
				.setName("Add image URL")
				.setDesc("Add an image URL from the internet")
				.addButton((button) =>
					button.setButtonText("Add").onClick(async () => {
						this.plugin.settings.images.push({
							path: "https://",
							enabled: true,
						});
						await this.plugin.saveSettings();
						this.display();
					}),
				);
		}

		// 透明度設定
		new Setting(containerEl).setName("Transparency").setHeading();

		new Setting(containerEl)
			.setName("Pane opacity")
			.setDesc("Opacity of page backgrounds (0–1)")
			.addText((text) =>
				text
					.setPlaceholder("0.85")
					.setValue(String(this.plugin.settings.paneOpacity))
					.onChange(async (value) => {
						const num = Number(value);
						if (!Number.isNaN(num) && num >= 0 && num <= 1) {
							this.plugin.settings.paneOpacity = num;
							await this.plugin.saveSettings();
							if (this.plugin.settings.enabled) this.plugin.applyTransparency();
						}
					}),
			);

		new Setting(containerEl)
			.setName("UI opacity")
			.setDesc("Opacity of UI backgrounds (0–1)")
			.addText((text) =>
				text
					.setPlaceholder("0.85")
					.setValue(String(this.plugin.settings.uiOpacity))
					.onChange(async (value) => {
						const num = Number(value);
						if (!Number.isNaN(num) && num >= 0 && num <= 1) {
							this.plugin.settings.uiOpacity = num;
							await this.plugin.saveSettings();
							if (this.plugin.settings.enabled) this.plugin.applyTransparency();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Tab opacity")
			.setDesc("Opacity of tab backgrounds (0–1)")
			.addText((text) =>
				text
					.setPlaceholder("0.85")
					.setValue(String(this.plugin.settings.tabOpacity))
					.onChange(async (value) => {
						const num = Number(value);
						if (!Number.isNaN(num) && num >= 0 && num <= 1) {
							this.plugin.settings.tabOpacity = num;
							await this.plugin.saveSettings();
							if (this.plugin.settings.enabled) this.plugin.applyTransparency();
						}
					}),
			);
	}
}
