import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = <T>(path: string): T =>
	JSON.parse(
		readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
	) as T;

const manifest = readJson<{ version: string; minAppVersion: string }>(
	"manifest.json",
);
const pkg = readJson<{ version: string }>("package.json");
const lock = readJson<{
	version: string;
	packages: Record<string, { version?: string }>;
}>("package-lock.json");
const versions = readJson<Record<string, string>>("versions.json");

describe("リリースメタデータの整合性", () => {
	it("version が SemVer (x.y.z) 形式である", () => {
		expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("manifest.json と package.json の version が一致する", () => {
		expect(manifest.version).toBe(pkg.version);
	});

	it("package-lock.json の version（ルートとルートパッケージ）が package.json と一致する", () => {
		expect(lock.version).toBe(pkg.version);
		expect(lock.packages[""]?.version).toBe(pkg.version);
	});

	it("versions.json に現在の version が登録され、値が manifest の minAppVersion と一致する", () => {
		expect(versions[manifest.version]).toBe(manifest.minAppVersion);
	});

	it("versions.json の全エントリが x.y.z 形式のキーを持つ", () => {
		for (const key of Object.keys(versions)) {
			expect(key).toMatch(/^\d+\.\d+\.\d+$/);
		}
	});
});
