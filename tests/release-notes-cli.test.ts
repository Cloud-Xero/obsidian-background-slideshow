import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const script = new URL("../release-notes.mjs", import.meta.url).pathname;

let dir: string;
const git = (...args: string[]) =>
	execFileSync("git", args, { cwd: dir, encoding: "utf8" });
const commit = (subject: string) =>
	git("commit", "--allow-empty", "-m", subject);
const run = (...args: string[]) =>
	execFileSync("node", [script, ...args], {
		cwd: dir,
		encoding: "utf8",
		env: { ...process.env, GITHUB_REPOSITORY: "owner/repo" },
	});

// master に 1.0.0 タグを打ち、その後 PR #2 をマージコミットで、直接コミットを 1 件積む
beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "release-notes-"));
	git("init", "-q", "-b", "master");
	git("config", "user.email", "t@example.com");
	git("config", "user.name", "t");
	git("config", "commit.gpgsign", "false");
	git("config", "tag.gpgsign", "false");
	commit("feat: Old feature");
	git("tag", "1.0.0");
	git("checkout", "-q", "-b", "topic");
	writeFileSync(join(dir, "a.txt"), "a");
	git("add", ".");
	commit("feat: Add filter");
	commit("test: Add tests");
	commit("fix: Fix fade");
	git("checkout", "-q", "master");
	commit("chore: Direct commit");
	git("merge", "--no-ff", "-q", "topic", "-m", "Merge pull request #2 from o/topic");
	commit("perf: Direct perf");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("release-notes.mjs（CLI）", () => {
	it("直前のタグ以降を対象に、マージコミットを PR のコミットへ展開して PR 番号を付ける", () => {
		const out = run("1.1.0");
		expect(out).toContain("## Features\n\n- Add filter (#2)\n");
		expect(out).toContain("## Bug fixes\n\n- Fix fade (#2)\n");
		expect(out).toContain("## Performance\n\n- Direct perf\n");
		expect(out).not.toContain("Old feature");
		expect(out).not.toContain("Add tests");
		expect(out).not.toContain("Merge pull request");
		expect(out.trimEnd().split("\n").slice(-1)[0]).toBe(
			"**Full Changelog**: https://github.com/owner/repo/compare/1.0.0...1.1.0",
		);
	});

	it("今回の version と同名のタグは前回のタグとして扱わない", () => {
		git("tag", "1.1.0");
		try {
			expect(run("1.1.0")).toContain("compare/1.0.0...1.1.0");
		} finally {
			git("tag", "-d", "1.1.0");
		}
	});

	it("from を指定すると、その範囲だけを対象にする", () => {
		const out = run("1.1.0", "1.0.0", "HEAD~1");
		expect(out).not.toContain("Direct perf");
		expect(out).toContain("- Add filter (#2)");
	});

	it("version が無ければ usage を出して異常終了する", () => {
		expect(() =>
			execFileSync("node", [script], { cwd: dir, stdio: "pipe" }),
		).toThrow(/usage/);
	});
});
