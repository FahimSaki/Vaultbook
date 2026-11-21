import fs from "node:fs";

const out = "dist/Vaultbook-Portable";
fs.rmSync("dist", { recursive: true, force: true });
for (const d of ["app", "launcher", "node", "data/tmp"])
  fs.mkdirSync(`${out}/${d}`, { recursive: true });

const cp = (from, to) =>
  fs.cpSync(from, to, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
cp(".next/standalone", `${out}/app`);
const pnpmDir = "node_modules/.pnpm";

if (fs.existsSync(pnpmDir)) {
  for (const d of fs.readdirSync(pnpmDir)) {
    if (!d.startsWith("@img+sharp")) continue;

    const dest = `${out}/app/node_modules/.pnpm/${d}`;

    fs.rmSync(dest, { recursive: true, force: true });
    cp(`${pnpmDir}/${d}`, dest);
  }
}
cp(".next/static", `${out}/app/.next/static`);
if (fs.existsSync("public")) cp("public", `${out}/app/public`);
cp("src/server/db/migrations", `${out}/app/migrations`);
fs.cpSync("packages/portable/launcher.js", `${out}/launcher/launcher.js`);
for (const f of ["start.bat", "start.sh", "README.txt"])
  fs.cpSync(`packages/portable/${f}`, `${out}/${f}`);

// never ship local env files or dev data
for (const f of fs.readdirSync(`${out}/app`))
  if (f.startsWith(".env")) fs.rmSync(`${out}/app/${f}`, { force: true });
fs.rmSync(`${out}/app/.devdata`, { recursive: true, force: true });
fs.writeFileSync(`${out}/data/.keep`, "");
console.log("Packaged to " + out);
