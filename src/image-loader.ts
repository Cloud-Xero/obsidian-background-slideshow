/**
 * img 要素に画像を読み込ませ、描画できる状態になるまで待つ。
 * 読み込みやデコードに失敗したときは例外を投げずに false を返す。
 */
export async function loadImage(
	img: HTMLImageElement,
	url: string,
): Promise<boolean> {
	img.src = url;
	try {
		await img.decode();
		return true;
	} catch {
		return false;
	}
}
