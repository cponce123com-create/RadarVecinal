const fs = require("fs");
const p = require("path");
const f = p.join(__dirname, "artifacts/api-server/build.cjs");
let c = fs.readFileSync(f, "utf-8");
// Remove broken banner section
const s = c.indexOf("banner: {");
const e = c.indexOf("}", s);
const cm = c.indexOf(",", e);
c = c.substring(0, s) + c.substring(cm + 1);
// Add simple banner
const B = '  banner: { js: `import { createRequire as __bannerCrReq } from "node:module";
import __bannerPath from "node:path";
import __bannerUrl from "node:url";

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);` },';
// Insert before external closing
const extEnd = c.lastIndexOf("],");
c = c.substring(0, extEnd + 1) + ",
" + B + "
" + c.substring(extEnd + 1);
fs.writeFileSync(f, c);
console.log("OK");
