// テスト実行時に "obsidian" の代わりに読み込まれる最小限のモック。
// obsidian パッケージは型定義だけで実行時の中身を持たないため、
// テスト対象のコードが import するものだけをここで用意する。
// 型は本物の obsidian.d.ts から来るので、ここは実行時の挙動だけを担う。

export class Component {
	load(): void {}
	unload(): void {}
	registerEvent(_eventRef: unknown): void {}
}

export class Plugin extends Component {
	app: unknown;
	manifest: unknown;

	constructor(app: unknown, manifest: unknown) {
		super();
		this.app = app;
		this.manifest = manifest;
	}

	async loadData(): Promise<unknown> {
		return null;
	}

	async saveData(_data: unknown): Promise<void> {}

	addSettingTab(_tab: unknown): void {}

	addCommand(command: unknown): unknown {
		return command;
	}
}

export abstract class TAbstractFile {
	path = "";
	name = "";
}

export class TFile extends TAbstractFile {
	extension = "";
}

export class SettingTab {}

export class PluginSettingTab extends SettingTab {
	app: unknown;
	plugin: unknown;

	constructor(app: unknown, plugin: unknown) {
		super();
		this.app = app;
		this.plugin = plugin;
	}

	hide(): void {}
}

export class Modal {
	app: unknown;

	constructor(app: unknown) {
		this.app = app;
	}

	open(): void {}
	close(): void {}
}

export class Menu extends Component {}

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\/|\/$/g, "");
}

// 本物と同じく、呼ぶたびにタイマーを延長し、run() / cancel() を持つ
export function debounce<T extends unknown[], V>(
	cb: (...args: [...T]) => V,
	timeout = 0,
	resetTimer = false,
) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pendingArgs: [...T] | null = null;

	const fire = (): V | void => {
		if (pendingArgs === null) return;
		const args = pendingArgs;
		pendingArgs = null;
		if (timer !== null) clearTimeout(timer);
		timer = null;
		return cb(...args);
	};

	const debounced = (...args: [...T]) => {
		pendingArgs = args;
		if (timer === null || resetTimer) {
			if (timer !== null) clearTimeout(timer);
			timer = setTimeout(fire, timeout);
		}
		return debounced;
	};
	debounced.cancel = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		pendingArgs = null;
		return debounced;
	};
	debounced.run = fire;
	return debounced;
}
