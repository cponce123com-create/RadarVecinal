const path = require("path");
const fs = require("fs");

// Con node-linker=hoisted, los paquetes están en la raíz del proyecto.
// Buscamos vite subiendo en el árbol de directorios.
function findUp(name, dir) {
  const c = path.join(dir, "node_modules", name, "dist", "node", "index.js");
  if (fs.existsSync(c)) return c;
  const p = path.dirname(dir);
  if (p === dir) throw new Error("Cannot find " + name);
  return findUp(name, p);
}

const vite = require(findUp("vite", __dirname));
vite.build({ configFile: path.join(__dirname, "vite.config.ts"), logLevel: "info" }).catch(e => { console.error(e); process.exit(1); });
