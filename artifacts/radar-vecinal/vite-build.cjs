const { createRequire } = require("module");
const require2 = createRequire(__filename);
const vite = require2("./node_modules/vite/dist/node/index.js");
vite.build({ configFile: "./vite.config.ts", logLevel: "info" }).catch(e => { console.error(e); process.exit(1); });
