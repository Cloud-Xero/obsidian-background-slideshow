import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const read = (path: string) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// 見出しから次の同階層以上の見出しまでを取り出す
const section = (heading: string): string => {
	const lines = readme.split("\n");
	const start = lines.findIndex((l) => l.trim() === heading);
	if (start < 0) return "";
	const level = heading.match(/^#+/)![0].length;
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((l) => {
		const m = l.match(/^(#+)\s/);
		return m !== null && m[1]!.length <= level;
	});
	return (end < 0 ? rest : rest.slice(0, end)).join("\n");
};

describe("README のネットワーク利用とプライバシーの記述", () => {
	const network = section("## Network use and privacy");

	it("Network use and privacy セクションが存在する", () => {
		expect(network.length).toBeGreaterThan(0);
	});

	it("ランダム画像の取得先として Lorem Picsum を明記し、実装の取得先ホストと一致する", () => {
		expect(network).toContain("picsum.photos");
		expect(read("src/slideshow.ts")).toContain("https://picsum.photos/");
	});

	it("「Use random images」が既定で On という記述が実際の既定値と一致する", () => {
		expect(network).toMatch(/\*\*Use random images\*\* is On \(the default\)/);
		expect(DEFAULT_SETTINGS.useRandomImages).toBe(true);
	});

	it("README が参照する設定名が設定画面の実際のラベルに存在する", () => {
		expect(read("src/settings.ts")).toContain('name: "Use random images"');
	});

	it("URL 指定の画像がその URL から読み込まれることを明記している", () => {
		expect(network).toMatch(/Off and you add an image URL/);
	});

	it("Vault の画像はローカル読み込みで送信されず、テレメトリも無いと明記している", () => {
		expect(network).toMatch(/never sent anywhere/);
		expect(network).toMatch(/does not send telemetry or analytics/);
	});
});

describe("README の Vault ファイル一覧の記述", () => {
	const vaultList = section("### Vault file list");

	it("Vault file list セクションが Network use and privacy 配下に存在する", () => {
		expect(vaultList.length).toBeGreaterThan(0);
		expect(section("## Network use and privacy")).toContain(
			"### Vault file list",
		);
	});

	it("操作名が実際のメニュー名と一致し、全ファイル一覧を読むことが実装（vault.getFiles）と整合する", () => {
		expect(vaultList).toContain("**Add image from vault**");
		expect(read("src/settings.ts")).toContain('.setTitle("Add image from vault")');
		expect(vaultList).toMatch(/list of all files in your vault/);
		expect(read("src/ui/image-select-modal.ts")).toMatch(/vault\s*\.getFiles\(\)/);
	});

	it("一覧は保存・送信されず、保存されるのは画像パスと有効フラグのみと明記している", () => {
		expect(vaultList).toMatch(/not saved or sent anywhere/);
		expect(vaultList).toMatch(/paths of the images you add and whether each image is enabled/);
	});

	it("設定に保存される画像データのキーが path と enabled だけで、README の記述と一致する", () => {
		const src = read("src/settings.ts");
		const body = src.match(/interface ImageData\s*{([^}]*)}/)?.[1] ?? "";
		const keys = [...body.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
		expect(keys.sort()).toEqual(["enabled", "path"]);
	});
});
