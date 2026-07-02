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
fs.writeFileSync("package.json", JSON.stringify(p, null, 2));
