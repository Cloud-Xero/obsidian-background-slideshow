import { type App, TFile, normalizePath } from "obsidian";

/**
 * Vault の中にある画像ファイルを返す。
 * 無いとき・フォルダを指しているときは null を返す（Vault の外は読まない）。
 */
export function findVaultFile(app: App, path: string): TFile | null {
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	return file instanceof TFile ? file : null;
}
