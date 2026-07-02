const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf-8"));
const before = { ...p.dependencies, ...p.devDependencies };
console.log("Before fix - catalog deps:", Object.entries(before).filter(([,v])=>v==="catalog:").map(([n])=>n).join(","));
console.log("Before fix - workspace deps:", Object.entries(before).filter(([,v])=>v.startsWith("workspace:")).map(([n])=>n).join(","));

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
const after = { ...p.dependencies, ...p.devDependencies };
console.log("After fix - vite:", after.vite);
console.log("After fix - react:", after.react);
console.log("After fix - @vitejs/plugin-react:", after["@vitejs/plugin-react"]);
console.log("After fix - total deps:", Object.keys(after).length);
fs.writeFileSync("package.json", JSON.stringify(p, null, 2));
