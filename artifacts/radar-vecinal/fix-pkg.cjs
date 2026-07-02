const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf-8"));

const C = {
  "@tailwindcss/vite": "^4.1.14", "@tanstack/react-query": "^5.90.21",
  "@types/node": "^25.3.3", "@types/react": "^19.2.0", "@types/react-dom": "^19.2.0",
  "@vitejs/plugin-react": "^5.0.4", "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1", "framer-motion": "12.35.1", "lucide-react": "^0.545.0",
  "react": "^19.1.0", "react-dom": "^19.1.0", "tailwind-merge": "^3.3.1",
  "tailwindcss": "^4.1.14", "vite": "^7.3.0", "zod": "^3.25.76", "tsx": "^4.21.0"
};
for (const key of ["dependencies", "devDependencies"]) {
  p[key] = Object.fromEntries(
    Object.entries(p[key] || {})
      .filter(([n, v]) => !n.startsWith("@workspace/") && !v.startsWith("workspace:"))
      .map(([n, v]) => [n, v === "catalog:" ? (C[n] || "latest") : v])
  );
}

// Check what's actually in node_modules after npm install
function checkNodeModules() {
  const nm = "node_modules";
  if (!fs.existsSync(nm)) {
    console.log("node_modules DOES NOT EXIST");
    return;
  }
  const dirs = fs.readdirSync(nm);
  console.log("node_modules count:", dirs.length);
  const scoped = dirs.filter(d => d.startsWith("@"));
  console.log("scoped packages:", scoped.length);
  // Check for vitejs specifically
  if (fs.existsSync(nm + "/@vitejs")) {
    console.log("@vitejs contents:", fs.readdirSync(nm + "/@vitejs"));
  } else {
    console.log("@vitejs DIR NOT FOUND");
    // Search for vitejs anywhere
    const found = dirs.filter(d => d.includes("vite"));
    console.log("dirs containing 'vite':", found.join(", "));
  }
  // Check if the issue is package.json doesnt have the dep
  const all = { ...p.dependencies, ...p.devDependencies };
  console.log("package.json has @vitejs/plugin-react:", !!all["@vitejs/plugin-react"]);
  console.log("package.json has @tailwindcss/vite:", !!all["@tailwindcss/vite"]);
  console.log("package.json has vite:", !!all["vite"]);
  console.log("package.json has react:", !!all["react"]);
}

checkNodeModules();
fs.writeFileSync("package.json", JSON.stringify(p, null, 2));
