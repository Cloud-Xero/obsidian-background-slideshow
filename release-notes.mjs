// リリースノートを、PR タイトル（日本語）ではなく英語のコミットメッセージから作る。
// 前回のタグから今回までに master へマージされた PR のコミットのうち、
// 利用者に関係する種類（feat / fix / perf / 破壊的変更）だけを見出しごとに並べる。
//
//   node release-notes.mjs <version>                  # 直前のタグ〜HEAD（Release ワークフロー用）
//   node release-notes.mjs <version> <from> [<to>]    # 範囲を指定（過去のリリースの作り直し用）
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// 見出しの並び順。type は小文字で比較する
const SECTIONS = [
	{ title: "Breaking changes", types: ["breaking", "major"] },
	{ title: "Features", types: ["feat", "feature"] },
	{ title: "Bug fixes", types: ["fix"] },
	{ title: "Performance", types: ["perf"] },
];

// "type(scope)!: subject" を分解する
const HEADER = /^(\w+)(?:\([^)]*\))?(!)?:\s*(.+)$/;

/**
 * Conventional Commits の件名を分解する。形式に合わなければ null。
 * @param {string} subject
 */
export function parseCommit(subject) {
	const m = HEADER.exec(subject.trim());
	if (!m) return null;
	const [, type, bang, text] = m;
	return {
		type: type.toLowerCase(),
		breaking: Boolean(bang),
		text: text.charAt(0).toUpperCase() + text.slice(1),
	};
}

/**
 * @param {{
 *   commits: { subject: string, pr?: string }[],
 *   previousTag?: string | null,
 *   version: string,
 *   repo: string,
 * }} options commits は古い順
 */
export function buildReleaseNotes({ commits, previousTag, version, repo }) {
	const items = SECTIONS.map(() => []);
	for (const { subject, pr } of commits) {
		const parsed = parseCommit(subject);
		if (!parsed) continue;
		const index = parsed.breaking
			? 0
			: SECTIONS.findIndex((s) => s.types.includes(parsed.type));
		if (index < 0) continue;
		items[index].push(`- ${parsed.text}${pr ? ` (#${pr})` : ""}`);
	}

	const blocks = SECTIONS.flatMap((s, i) =>
		items[i].length > 0 ? [`## ${s.title}\n\n${items[i].join("\n")}`] : [],
	);
	if (blocks.length === 0) {
		blocks.push("No user-facing changes in this release.");
	}
	if (previousTag) {
		blocks.push(
			`**Full Changelog**: https://github.com/${repo}/compare/${previousTag}...${version}`,
		);
	}
	return `${blocks.join("\n\n")}\n`;
}

/** @param {string[]} args */
function git(args) {
	return execFileSync("git", args, { encoding: "utf8" });
}

/** @param {string} text */
const lines = (text) => text.split("\n").filter(Boolean);

/**
 * master の履歴（first-parent）をたどり、PR のマージコミットはその PR のコミットに展開する。
 * @param {string | null} from 含まない起点。null なら履歴の先頭から
 * @param {string} to
 */
export function collectCommits(from, to) {
	const range = from ? `${from}..${to}` : to;
	const commits = [];
	for (const line of lines(
		git(["log", "--first-parent", "--reverse", "--format=%H %P%x1f%s", range]),
	)) {
		const [ids, subject] = line.split("\x1f");
		const [, parent, mergedHead] = ids.split(" ");
		if (!mergedHead) {
			commits.push({ subject });
			continue;
		}
		const pr = /^Merge pull request #(\d+)/.exec(subject)?.[1];
		for (const inner of lines(
			git(["log", "--no-merges", "--reverse", "--format=%s", `${parent}..${mergedHead}`]),
		)) {
			commits.push({ subject: inner, pr });
		}
	}
	return commits;
}

/**
 * to から見て直前のタグ。今回の version のタグは除く。タグが無ければ null。
 * @param {string} version
 * @param {string} to
 */
function findPreviousTag(version, to) {
	try {
		return git(["describe", "--tags", "--abbrev=0", "--exclude", version, to]).trim();
	} catch {
		return null;
	}
}

function findRepo() {
	if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
	const url = git(["remote", "get-url", "origin"]).trim();
	const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(url);
	if (!m) throw new Error(`origin から GitHub のリポジトリ名を読み取れません: ${url}`);
	return m[1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [version, fromArg, to = "HEAD"] = process.argv.slice(2);
	if (!version) {
		console.error("usage: node release-notes.mjs <version> [<from> [<to>]]");
		process.exit(1);
	}
	const previousTag = fromArg ?? findPreviousTag(version, to);
	process.stdout.write(
		buildReleaseNotes({
			commits: collectCommits(previousTag, to),
			previousTag,
			version,
			repo: findRepo(),
		}),
	);
}
