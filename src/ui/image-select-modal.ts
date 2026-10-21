import { type App, Modal, type TFile } from "obsidian";

// パスに検索語を含むか（大文字と小文字は区別しない）。空の検索語はすべてに一致する
export const matchesImageFilter = (path: string, query: string): boolean =>
	path.toLowerCase().includes(query.trim().toLowerCase());

export class MultiImageSelectModal extends Modal {
	private onChoose: (files: TFile[]) => void;
	private selectedFiles: TFile[];
	private registeredPaths: Set<string>;

	constructor(
		app: App,
		onChoose: (files: TFile[]) => void,
		registeredPaths: string[] = [],
	) {
		super(app);
		this.onChoose = onChoose;
		this.selectedFiles = [];
		this.registeredPaths = new Set(registeredPaths);
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

		const searchInput = contentEl.createEl("input", {
			type: "search",
			cls: "background-slideshow-select-search",
			attr: { placeholder: "Filter by path" },
		});

		const listContainer = contentEl.createDiv({
			cls: "background-slideshow-select-list",
		});

		const rows: { file: TFile; itemEl: HTMLElement }[] = [];

		imageFiles.forEach((file) => {
			const isRegistered = this.registeredPaths.has(file.path);
			const itemEl = listContainer.createDiv({
				cls: isRegistered
					? "background-slideshow-select-item is-registered"
					: "background-slideshow-select-item",
			});

			const checkbox = itemEl.createEl("input", { type: "checkbox" });
			if (isRegistered) {
				// 登録済みの画像は選べないようにして、重複登録を防ぐ
				checkbox.disabled = true;
			} else {
				checkbox.addEventListener("change", () => {
					if (checkbox.checked) {
						this.selectedFiles.push(file);
					} else {
						const index = this.selectedFiles.indexOf(file);
						if (index > -1) this.selectedFiles.splice(index, 1);
					}
				});
			}

			itemEl.createSpan({ text: file.path });
			if (isRegistered) {
				itemEl.createSpan({
					text: "Already added",
					cls: "background-slideshow-select-registered",
				});
			}
			rows.push({ file, itemEl });
		});

		// 絞り込みは表示を切り替えるだけなので、隠れた行の選択も保持される
		searchInput.addEventListener("input", () => {
			const query = searchInput.value;
			for (const { file, itemEl } of rows) {
				itemEl.toggle(matchesImageFilter(file.path, query));
			}
		});

		const buttonContainer = contentEl.createDiv({
			cls: "background-slideshow-modal-buttons",
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
