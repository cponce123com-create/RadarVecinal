const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "artifacts/api-server/build.cjs");
let content = fs.readFileSync(filePath, "utf-8");

// Find and replace the broken banner section
const bannerStart = content.indexOf("banner: {");
if (bannerStart < 0) {
  console.error("banner not found");
  process.exit(1);
}

const bannerEnd = content.indexOf("}", bannerStart);
const afterBanner = content.indexOf(",", bannerEnd);
const before = content.substring(0, bannerStart);
const after = content.substring(afterBanner + 1);

const newline = String.fromCharCode(92, 110);
const banner = [
  "banner: {",
  '      js: [',
  "        `import { createRequire as __bannerCrReq } from 'node:module';`,",
  "        `import __bannerPath from 'node:path';`,",
  "        `import __bannerUrl from 'node:url';`,",
  "        ``,",
  "        `globalThis.require = __bannerCrReq(import.meta.url);`,",
  "        `globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);`,",
  "        `globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,",
  `      ].join("${newline}"),`,
  "    },",
].join("
");

content = before + banner + after;
fs.writeFileSync(filePath, content);
console.log("Fixed build.cjs banner section");
