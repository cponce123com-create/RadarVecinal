async function main() {
  const { build } = await import("./node_modules/vite/dist/node/index.js");
  await build({ configFile: "./vite.config.ts", logLevel: "info" });
}
main().catch(e => { console.error(e); process.exit(1); });
