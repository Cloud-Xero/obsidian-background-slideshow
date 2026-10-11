import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			// obsidian パッケージは型定義だけなので、実行時はモックに差し替える
			obsidian: fileURLToPath(
				new URL("./tests/__mocks__/obsidian.ts", import.meta.url),
			),
		},
	},
	test: {
		include: ["tests/**/*.test.ts"],
	},
});
