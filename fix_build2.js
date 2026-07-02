const fs = require("fs");
// Read build.cjs
let c = fs.readFileSync("artifacts/api-server/build.cjs", "utf8");
// Remove broken banner section
const si = c.indexOf("banner:");
const ei = c.indexOf("},", si);
c = c.substring(0, si) + c.substring(ei + 2);
// Insert a simple banner as a single string
const nl = String.fromCharCode(92, 110);
const b = '  banner: { js: `import { createRequire as __bannerCrReq } from "node:module";' + nl + 'import __bannerPath from "node:path";' + nl + 'import __bannerUrl from "node:url";' + nl + nl + 'globalThis.require = __bannerCrReq(import.meta.url);' + nl + 'globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);' + nl + 'globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);` },';
const extEnd = c.lastIndexOf("],");
c = c.substring(0, extEnd + 1) + ",
" + b + "
" + c.substring(extEnd + 1);
fs.writeFileSync("artifacts/api-server/build.cjs", c);
console.log("OK");
