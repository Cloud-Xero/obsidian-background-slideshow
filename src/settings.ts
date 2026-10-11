import {
	type App,
	Menu,
	Modal,
	PluginSettingTab,
	type SettingDefinition,
	type SettingDefinitionItem,
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

type SettingKey = keyof BackgroundSlideshowSettings;

const isPositive = (value: number): string | void => {
	if (Number.isNaN(value) || value <= 0) return "Enter a number greater than 0";
};

const isOpacity = (value: number): string | void => {
	if (Number.isNaN(value) || value < 0 || value > 1)
		return "Enter a number between 0 and 1";
};

export class BackgroundSlideshowSettingTab extends PluginSettingTab {
	plugin: BackgroundSlideshowPlugin;

	constructor(app: App, plugin: BackgroundSlideshowPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		const settings = this.plugin.settings;

		return [
			{
				name: "Enable slideshow",
				desc: "Toggle background image slideshow",
				control: { type: "toggle", key: "enabled" },
			},
			{
				name: "Duration (seconds)",
				desc: "How long each image is displayed",
				control: {
					type: "number",
					key: "duration",
					placeholder: "60",
					defaultValue: DEFAULT_SETTINGS.duration,
					step: "any",
					validate: isPositive,
				},
			},
			{
				name: "Fade time (seconds)",
				desc: "Duration of fade transition between images",
				control: {
					type: "number",
					key: "fadeTime",
					placeholder: "5",
					defaultValue: DEFAULT_SETTINGS.fadeTime,
					step: "any",
					validate: isPositive,
				},
			},
			{
				type: "group",
				heading: "Random images",
				items: [
					{
						name: "Use random images",
						desc: "Use random photos from picsum.photos instead of manual image paths",
						control: { type: "toggle", key: "useUnsplashRandom" },
					},
					{
						name: "",
						desc: "Using Lorem Picsum for high-quality random photos.",
						searchable: false,
						visible: () => this.plugin.settings.useUnsplashRandom,
					},
				],
			},
			{
				type: "list",
				heading: "Images",
				emptyState: "No images added yet.",
				visible: () => !this.plugin.settings.useUnsplashRandom,
				items: settings.images.map((imageData, index) =>
					this.imageDefinition(imageData, index),
				),
				onReorder: (oldIndex, newIndex) => {
					const item = this.plugin.settings.images.splice(oldIndex, 1)[0];
					if (item === undefined) return;
					this.plugin.settings.images.splice(newIndex, 0, item);
					void this.saveImagesAndRefresh(true);
				},
				onDelete: (index) => {
					this.plugin.settings.images.splice(index, 1);
					void this.saveImagesAndRefresh(true);
				},
				addItem: {
					name: "Add image",
					action: (el) => this.showAddImageMenu(el),
				},
			},
			{
				type: "group",
				heading: "Transparency",
				items: [
					{
						name: "Pane opacity",
						desc: "Opacity of page backgrounds (0–1)",
						control: {
							type: "number",
							key: "paneOpacity",
							placeholder: "0.85",
							defaultValue: DEFAULT_SETTINGS.paneOpacity,
							min: 0,
							max: 1,
							step: "any",
							validate: isOpacity,
						},
					},
					{
						name: "UI opacity",
						desc: "Opacity of UI backgrounds (0–1)",
						control: {
							type: "number",
							key: "uiOpacity",
							placeholder: "0.85",
							defaultValue: DEFAULT_SETTINGS.uiOpacity,
							min: 0,
							max: 1,
							step: "any",
							validate: isOpacity,
						},
					},
					{
						name: "Tab opacity",
						desc: "Opacity of tab backgrounds (0–1)",
						control: {
							type: "number",
							key: "tabOpacity",
							placeholder: "0.85",
							defaultValue: DEFAULT_SETTINGS.tabOpacity,
							min: 0,
							max: 1,
							step: "any",
							validate: isOpacity,
						},
					},
				],
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
		this.applySideEffects(key as SettingKey);
	}

	// 設定変更に応じてスライドショーや透明度へ反映する
	private applySideEffects(key: SettingKey): void {
		const { settings } = this.plugin;
		switch (key) {
			case "enabled":
				if (settings.enabled) {
					void this.plugin.startSlideshow();
				} else {
					this.plugin.stopSlideshow();
				}
				break;
			case "useUnsplashRandom":
				// 画像リストと説明文の表示・非表示を切り替える
				this.refreshDomState();
				if (settings.enabled) void this.plugin.startSlideshow();
				break;
			case "duration":
			case "fadeTime":
				if (settings.enabled) void this.plugin.startSlideshow();
				break;
			case "paneOpacity":
			case "uiOpacity":
			case "tabOpacity":
				if (settings.enabled) this.plugin.applyTransparency();
				break;
			default:
				break;
		}
	}

	private imageDefinition(
		imageData: ImageData,
		index: number,
	): SettingDefinition<SettingKey> {
		const isUrl =
			imageData.path.startsWith("http://") ||
			imageData.path.startsWith("https://");
		const imageType = isUrl ? "URL" : "Local";
		const pathParts = imageData.path.split("/");
		const displayName = pathParts[pathParts.length - 1] || `Image ${index + 1}`;
		const nameFor = (enabled: boolean) =>
			`${enabled ? "✓" : "✗"} ${imageType} - ${displayName}`;

		return {
			name: nameFor(imageData.enabled),
			render: (setting) => {
				setting
					.setName(nameFor(imageData.enabled))
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
								setting.setName(nameFor(value));
								toggle.setTooltip(
									value ? "Disable this image" : "Enable this image",
								);
								await this.plugin.saveSettings();
								if (this.plugin.settings.enabled)
									void this.plugin.startSlideshow();
							}),
					);
			},
		};
	}

	// 追加ボタンから Vault の画像か URL を選んで追加する
	private showAddImageMenu(el: HTMLElement): void {
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle("Add image from vault")
				.setIcon("image")
				.onClick(() => {
					new MultiImageSelectModal(this.app, (files) => {
						for (const file of files) {
							this.plugin.settings.images.push({
								path: file.path,
								enabled: true,
							});
						}
						void this.saveImagesAndRefresh(true);
					}).open();
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle("Add image URL")
				.setIcon("link")
				.onClick(() => {
					this.plugin.settings.images.push({
						path: "https://",
						enabled: true,
					});
					void this.saveImagesAndRefresh(false);
				}),
		);
		const rect = el.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}

	// 画像リストの構造が変わったときに保存して画面を組み立て直す
	private async saveImagesAndRefresh(restart: boolean): Promise<void> {
		await this.plugin.saveSettings();
		this.update();
		if (restart && this.plugin.settings.enabled)
			void this.plugin.startSlideshow();
	}
}
