import { describe, expect, it } from "vitest";
import { buildReleaseNotes, parseCommit } from "../release-notes.mjs";

const repo = "owner/repo";
const build = (
	commits: { subject: string; pr?: string }[],
	previousTag: string | null = "1.0.0",
) => buildReleaseNotes({ commits, previousTag, version: "1.1.0", repo });

describe("parseCommit", () => {
	it("type・scope・! を分解し、件名の先頭を大文字にする", () => {
		expect(parseCommit("fix(settings)!: remove old key")).toEqual({
			type: "fix",
			breaking: true,
			text: "Remove old key",
		});
	});

	it("Conventional Commits の形式でない件名は null", () => {
		expect(parseCommit("Merge pull request #1 from a/b")).toBeNull();
		expect(parseCommit("Initial commit")).toBeNull();
	});
});

describe("buildReleaseNotes", () => {
	it("feat / fix / perf / 破壊的変更を、決まった順の見出しに分ける", () => {
		const notes = build([
			{ subject: "perf: Cache images", pr: "4" },
			{ subject: "fix: Fix fade", pr: "3" },
			{ subject: "feat: Add filter", pr: "2" },
			{ subject: "BREAKING: Drop old setting", pr: "1" },
		]);
		const headings = notes.match(/^## .+$/gm);
		expect(headings).toEqual([
			"## Breaking changes",
			"## Features",
			"## Bug fixes",
			"## Performance",
		]);
		expect(notes).toContain("## Features\n\n- Add filter (#2)\n");
	});

	it("feature は Features、! 付きは種類によらず Breaking changes に入る", () => {
		const notes = build([
			{ subject: "feature: Add toggle" },
			{ subject: "fix!: Change default" },
		]);
		expect(notes).toContain("## Breaking changes\n\n- Change default\n");
		expect(notes).toContain("## Features\n\n- Add toggle\n");
		expect(notes).not.toContain("## Bug fixes");
	});

	it("利用者に関係しない種類（test / ci / chore / refactor / docs / build）は載せない", () => {
		const notes = build([
			{ subject: "test: Add tests", pr: "1" },
			{ subject: "ci: Use Node 24", pr: "2" },
			{ subject: "chore: Bump version to 1.1.0", pr: "3" },
			{ subject: "refactor: Split modules", pr: "4" },
			{ subject: "docs: Update README", pr: "5" },
			{ subject: "build(deps-dev): bump esbuild", pr: "6" },
			{ subject: "fix: Fix fade", pr: "7" },
		]);
		expect(notes.match(/^- /gm)).toHaveLength(1);
		expect(notes).toContain("- Fix fade (#7)");
	});

	it("渡された順（古い順）を保ち、PR が無いコミットは番号を付けない", () => {
		const notes = build([
			{ subject: "fix: first" },
			{ subject: "fix: second", pr: "9" },
		]);
		expect(notes).toContain("## Bug fixes\n\n- First\n- Second (#9)\n");
	});

	it("載せる変更が無ければ、その旨を書く", () => {
		const notes = build([{ subject: "ci: Use Node 24", pr: "1" }]);
		expect(notes).toContain("No user-facing changes in this release.");
		expect(notes).not.toMatch(/^## /m);
	});

	it("前回のタグとの比較リンクを末尾に付け、タグが無ければ付けない", () => {
		const notes = build([{ subject: "fix: Fix fade" }]);
		expect(notes.trimEnd().split("\n").slice(-1)[0]).toBe(
			"**Full Changelog**: https://github.com/owner/repo/compare/1.0.0...1.1.0",
		);
		expect(build([{ subject: "fix: Fix fade" }], null)).not.toContain(
			"Full Changelog",
		);
	});
});
