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

function getBackgroundRgb(): string {
	// CSS クラスを使って一時要素を作成し、ブラウザに --background-primary を
	// 解決させた rgb() 値を取得する。
	const el = document.body.createDiv({
		cls: "background-slideshow-color-probe",
	});
	const color = getComputedStyle(el).backgroundColor;
	el.remove();

	// ブラウザは常に "rgb(r, g, b)" または "rgba(r, g, b, a)" で返す
	const match = color.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
	if (match) {
		return `${match[1]}, ${match[2]}, ${match[3]}`;
	}

	return "30, 30, 30";
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
