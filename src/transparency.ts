import type { BackgroundSlideshowSettings } from "./settings";

// 透過の設定と削除で同じ名前を使うため、変数名はここにまとめる
export const TRANSPARENCY_VARS = [
	"--background-transparent",
	"--background-partially-transparent",
	"--background-tabs-transparent",
] as const;

export const TRANSPARENCY_ACTIVE_CLASS = "background-slideshow-active";

// 透過を適用している間かどうか
export function isTransparencyActive(): boolean {
	return document.body.classList.contains(TRANSPARENCY_ACTIVE_CLASS);
}

const FALLBACK_RGB = "30, 30, 30";

function getBackgroundRgb(): string {
	// 一時要素の背景色に --background-primary を直接指定し、ブラウザに解決させた
	// rgb() 値を取得する。styles.css に頼ると、有効化の直後（styles.css の読み込み前）は
	// 背景色が透明になってしまうため、要素に直接指定している。
	const el = document.body.createDiv();
	el.setCssStyles({
		display: "none",
		backgroundColor: "var(--background-primary)",
	});
	const color = getComputedStyle(el).backgroundColor;
	el.remove();

	// ブラウザは常に "rgb(r, g, b)" または "rgba(r, g, b, a)" で返す
	const match = color.match(
		/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/,
	);
	if (!match) {
		return FALLBACK_RGB;
	}

	// 透明（アルファ 0）は色が取れなかったとみなし、黒として使わない
	if (match[4] !== undefined && Number(match[4]) === 0) {
		return FALLBACK_RGB;
	}

	return `${match[1]}, ${match[2]}, ${match[3]}`;
}

export function applyTransparency(settings: BackgroundSlideshowSettings): void {
	const rgb = getBackgroundRgb();
	const [paneVar, uiVar, tabVar] = TRANSPARENCY_VARS;
	document.body.style.setProperty(
		paneVar,
		`rgba(${rgb}, ${settings.paneOpacity})`,
	);
	document.body.style.setProperty(uiVar, `rgba(${rgb}, ${settings.uiOpacity})`);
	document.body.style.setProperty(
		tabVar,
		`rgba(${rgb}, ${settings.tabOpacity})`,
	);
	document.body.classList.add(TRANSPARENCY_ACTIVE_CLASS);
}

export function removeTransparency(): void {
	document.body.classList.remove(TRANSPARENCY_ACTIVE_CLASS);
	for (const name of TRANSPARENCY_VARS) {
		document.body.style.removeProperty(name);
	}
}
