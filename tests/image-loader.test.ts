import { describe, expect, it } from "vitest";
import { loadImage } from "../src/image-loader";

const fakeImg = (decode: () => Promise<void>) =>
	({ src: "", decode }) as unknown as HTMLImageElement;

describe("loadImage", () => {
	it("src を設定し、デコードが終わったら true を返す", async () => {
		const img = fakeImg(() => Promise.resolve());

		await expect(loadImage(img, "https://example.com/a.jpg")).resolves.toBe(
			true,
		);
		expect(img.src).toBe("https://example.com/a.jpg");
	});

	it("読み込みやデコードに失敗したら、例外を投げずに false を返す", async () => {
		const img = fakeImg(() => Promise.reject(new Error("EncodingError")));

		await expect(loadImage(img, "https://example.com/a.jpg")).resolves.toBe(
			false,
		);
	});
});
