import { describe, expect, it } from "vitest";
import { TAbstractFile, TFile, type App } from "obsidian";
import { findVaultFile } from "../src/vault-file";

// フォルダを表す、TFile ではない TAbstractFile
class FakeFolder extends TAbstractFile {}

const makeApp = (entries: Record<string, TAbstractFile>) =>
	({
		vault: {
			getAbstractFileByPath: (path: string) => entries[path] ?? null,
		},
	}) as unknown as App;

const makeFile = (path: string): TFile => {
	const file = new TFile();
	file.path = path;
	return file;
};

describe("findVaultFile", () => {
	it("Vault にあるファイルを返す", () => {
		const file = makeFile("images/a.png");
		const app = makeApp({ "images/a.png": file });

		expect(findVaultFile(app, "images/a.png")).toBe(file);
	});

	it("先頭の / や重複した / を正規化して探す", () => {
		const file = makeFile("images/a.png");
		const app = makeApp({ "images/a.png": file });

		expect(findVaultFile(app, "/images//a.png")).toBe(file);
	});

	it("Vault に無いパスは null を返す", () => {
		expect(findVaultFile(makeApp({}), "/outside/a.png")).toBeNull();
	});

	it("フォルダを指しているときは null を返す", () => {
		const folder = new FakeFolder();
		folder.path = "images";
		const app = makeApp({ images: folder });

		expect(findVaultFile(app, "images")).toBeNull();
	});
});
