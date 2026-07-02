const esbuild = require("esbuild");
const esbuildPluginPino = require("esbuild-plugin-pino");
const path = require("path");
const { rm } = require("fs/promises");

const artifactDir = __dirname;

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });
  await esbuild.build({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node", bundle: true, format: "esm",
    outdir: distDir, outExtension: { ".js": ".mjs" }, logLevel: "info",
    external: [
      "*.node","sharp","better-sqlite3","sqlite3","canvas","bcrypt","argon2","fsevents","re2","farmhash",
      "xxhash-addon","bufferutil","utf-8-validate","ssh2","cpu-features","dtrace-provider","isolated-vm",
      "lightningcss","pg-native","oracledb","mongodb-client-encryption","nodemailer","handlebars",
      "knex","typeorm","protobufjs","onnxruntime-node","@tensorflow/*","@prisma/client","@mikro-orm/*",
      "@grpc/*","@swc/*","@aws-sdk/*","@azure/*","@opentelemetry/*","@google-cloud/*","@google/*",
      "googleapis","firebase-admin","@parcel/watcher","@sentry/profiling-node","@tree-sitter/*",
      "aws-sdk","classic-level","dd-trace","ffi-napi","grpc","hiredis","kerberos","leveldown",
      "miniflare","mysql2","newrelic","odbc","piscina","realm","ref-napi","rocksdb",
      "sass-embedded","sequelize","serialport","snappy","tinypool","usb","workerd","wrangler",
      "zeromq","zeromq-prebuilt","playwright","puppeteer","puppeteer-core","electron",
    ],
    sourcemap: "linked",
    plugins: [ esbuildPluginPino({ transports: ["pino-pretty"] }) ],
    banner: { js: "import { createRequire as __bannerCrReq } from 'node:module';" + String.fromCharCode(92,110) + "import __bannerPath from 'node:path';" + String.fromCharCode(92,110) + "import __bannerUrl from 'node:url';" + String.fromCharCode(92,110) + String.fromCharCode(92,110) + "globalThis.require = __bannerCrReq(import.meta.url);" + String.fromCharCode(92,110) + "globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);" + String.fromCharCode(92,110) + "globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);" },
  });
}

buildAll().catch((err) => { console.error(err); process.exit(1); });
