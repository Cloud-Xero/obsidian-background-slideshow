import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const yml = readFileSync(
	new URL("../.github/workflows/release.yml", import.meta.url),
	"utf8",
);

// "- name: ..." / "- uses: ..." で始まる steps の各ブロックに分割する
const stepsText = yml.slice(yml.indexOf("\n    release:"));
const steps = stepsText
	.split(/\n(?=\s+- (?:name|uses): )/)
	.slice(1)
	.map((block) => ({
		text: block,
		name: /^\s+- name: (.+)$/m.exec(block)?.[1]?.trim(),
	}));
const indexOfStep = (name: string) => steps.findIndex((s) => s.name === name);

// トップレベル permissions ブロックの中身
const permissions = /^permissions:\n((?:[ \t]+.*\n|\n)+)/m.exec(yml)?.[1] ?? "";

const attest = steps[indexOfStep("Attest release assets")];
const release = steps[indexOfStep("Create release")];

const listedFiles = (text: string): string[] =>
	/subject-path:\s*\|\n((?:\s+\S+\n?)+)/
		.exec(text)?.[1]
		?.split("\n")
		.map((l) => l.trim())
		.filter(Boolean) ?? [];

describe("release.yml のリリースノート", () => {
	const notes = steps[indexOfStep("Generate release notes")];
	const checkout = steps.find((s) => /uses:\s*actions\/checkout@/.test(s.text));

	it("前回のタグを見つけるため、checkout でタグと履歴をすべて取得する", () => {
		expect(checkout?.text).toMatch(/^\s+fetch-depth:\s*0\s*$/m);
	});

	it("英語のコミットメッセージから release-notes.md を作る", () => {
		expect(notes?.text).toMatch(
			/node release-notes\.mjs "\$VERSION" > release-notes\.md/,
		);
	});

	it("Create release は release-notes.md を使い、PR タイトルからの自動生成は使わない", () => {
		expect(release?.text).toMatch(/--notes-file release-notes\.md/);
		expect(release?.text).not.toMatch(/--generate-notes/);
	});

	it("Create release の前に、同じ条件で実行される", () => {
		const cond = /^\s+if:\s*(.+)$/m;
		expect(indexOfStep("Generate release notes")).toBeGreaterThanOrEqual(0);
		expect(indexOfStep("Generate release notes")).toBeLessThan(
			indexOfStep("Create release"),
		);
		expect(cond.exec(notes?.text ?? "")?.[1]).toBe(
			cond.exec(release?.text ?? "")?.[1],
		);
	});
});

describe("release.yml の artifact attestation", () => {
	it("attestation に必要な権限（id-token / attestations / artifact-metadata: write）を付与している", () => {
		expect(permissions).toMatch(/^\s+id-token:\s*write\s*$/m);
		expect(permissions).toMatch(/^\s+attestations:\s*write\s*$/m);
		expect(permissions).toMatch(/^\s+artifact-metadata:\s*write\s*$/m);
	});

	it("リリース作成用の contents: write を維持している", () => {
		expect(permissions).toMatch(/^\s+contents:\s*write\s*$/m);
	});

	it("Attest ステップが actions/attest（メジャーバージョン指定）を使う", () => {
		expect(attest).toBeDefined();
		expect(attest?.text).toMatch(/uses:\s*actions\/attest@v\d+\s*$/m);
	});

	it("Build の後、Create release の前に実行される", () => {
		const build = indexOfStep("Build");
		const att = indexOfStep("Attest release assets");
		const rel = indexOfStep("Create release");
		expect(build).toBeGreaterThanOrEqual(0);
		expect(att).toBeGreaterThan(build);
		expect(rel).toBeGreaterThan(att);
	});

	it("リリースが未作成のときだけ実行される（Create release と同じ条件）", () => {
		const cond = /^\s+if:\s*(.+)$/m;
		expect(cond.exec(attest?.text ?? "")?.[1]?.trim()).toBe(
			"steps.check.outputs.exists == 'false'",
		);
		expect(cond.exec(attest?.text ?? "")?.[1]).toBe(
			cond.exec(release?.text ?? "")?.[1],
		);
	});

	it("subject-path がリリースに添付する成果物（main.js / manifest.json / styles.css）と一致する", () => {
		const attested = listedFiles(attest?.text ?? "");
		const m = /gh release create "\$VERSION"((?: [\w.]+)+)/.exec(
			release?.text ?? "",
		);
		const attached = (m?.[1] ?? "").trim().split(/\s+/);
		expect(attached.sort()).toEqual(["main.js", "manifest.json", "styles.css"]);
		expect(attested.sort()).toEqual(attached);
	});
});
