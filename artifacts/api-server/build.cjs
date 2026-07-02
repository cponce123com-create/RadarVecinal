// build.cjs — Radar Vecinal
// Encuentra módulos directamente en node_modules/.pnpm/ iterando sobre
// todas las versiones disponibles. NO depende de symlinks en node_modules/
// que pueden estar rotos en Render.

const fs = require("fs");
const p = require("path");
const { rm } = require("fs/promises");

function resolveFromPnpm(name, startDir) {
  let dir = startDir;
  while (dir) {
    const pnpmDir = p.join(dir, "node_modules", ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      const entries = fs.readdirSync(pnpmDir);
      // Probar TODAS las versiones, no solo la primera
      for (const entry of entries) {
        if (entry.startsWith(name + "@")) {
          const pkgDir = p.join(pnpmDir, entry, "node_modules", name);
          const pkgJson = p.join(pkgDir, "package.json");
          if (fs.existsSync(pkgJson)) {
            const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
            const main = pkg.main || "index.js";
            const mainPath = p.join(pkgDir, main);
            if (fs.existsSync(mainPath)) {
              return mainPath;
            }
          }
        }
      }
    }
    const parent = p.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Cannot resolve ${name} from .pnpm store`);
}

// Cargar esbuild y plugin desde .pnpm
const esbuild = require(resolveFromPnpm("esbuild", __dirname));

// esbuild-plugin-pino tiene peer deps, su entry tiene _ en el nombre
let esbuildPluginPino;
try {
  esbuildPluginPino = require(resolveFromPnpm("esbuild-plugin-pino", __dirname));
} catch {
  esbuildPluginPino = null;
}

const artifactDir = __dirname;

async function buildAll() {
  const distDir = p.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });
  await esbuild.build({
    entryPoints: [p.resolve(artifactDir, "src/index.ts")],
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
      "zeromq","zeromq-prebuilt","playwright","puppeteer","puppeteer-core","electron","pdfkit",
    ],
    sourcemap: "linked",
    plugins: esbuildPluginPino ? [esbuildPluginPino({ transports: ["pino-pretty"] })] : [],
    banner: {
      js: [
        "import { createRequire as __bannerCrReq } from 'node:module';",
        "import __bannerPath from 'node:path';",
        "import __bannerUrl from 'node:url';",
        "",
        "globalThis.require = __bannerCrReq(import.meta.url);",
        "globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);",
        "globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);",
      ].join("\n"),
    },
  });
}

buildAll().catch((err) => { console.error(err); process.exit(1); });
