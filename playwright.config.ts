import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "tests/e2e",
	use: { baseURL: "http://127.0.0.1:4173" },
	webServer: {
		command: "npx --yes http-server -p 4173 -s .",
		url: "http://127.0.0.1:4173/tests/e2e/index.html",
	},
	projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
