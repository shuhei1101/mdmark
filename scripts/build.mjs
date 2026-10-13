import { build } from "esbuild";

// 埋める版はビルドの引数で受け取る
const version = process.argv[2];
if (!version) {
	throw new Error(
		"埋める版を引数で渡してください（例: node scripts/build.mjs v0.0.0）",
	);
}

await build({
	entryPoints: ["src/index.ts", "src/index.css"],
	outdir: "dist",
	bundle: true,
	format: "esm",
	define: { __MDMARK_VERSION__: JSON.stringify(version) },
});
