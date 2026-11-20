import { spawn } from "node:child_process";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const tmpDir = path.join(dataDir, "tmp");
const profileDir = path.join(tmpDir, "browser-profile");
const token = crypto.randomBytes(24).toString("hex");
fs.mkdirSync(tmpDir, { recursive: true });

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });

const onPath = (n) =>
  (process.env.PATH || "")
    .split(path.delimiter)
    .some((d) => d && fs.existsSync(path.join(d, n)));

function candidates() {
  if (process.platform === "win32") {
    const roots = [
      process.env["ProgramFiles"],
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);
    return roots.flatMap((r) => [
      [
        path.join(r, "Microsoft", "Edge", "Application", "msedge.exe"),
        "--inprivate",
      ],
      [
        path.join(r, "Google", "Chrome", "Application", "chrome.exe"),
        "--incognito",
      ],
    ]);
  }
  if (process.platform === "darwin") {
    return [
      [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--incognito",
      ],
      [
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "--inprivate",
      ],
    ];
  }
  return [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
  ].map((b) => [b, "--incognito"]);
}

function openPrivate(url) {
  for (const [bin, flag] of candidates()) {
    if (!(path.isAbsolute(bin) ? fs.existsSync(bin) : onPath(bin))) continue;
    return spawn(
      bin,
      [
        "--user-data-dir=" + profileDir,
        flag,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        url,
      ],
      { stdio: "ignore" },
    );
  }
  return null;
}

function openDefault(url) {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

const cleanProfile = () =>
  fs.rmSync(profileDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 300,
  });

(async () => {
  const port = await freePort();
  const base = "http://127.0.0.1:" + port;
  const server = spawn(
    process.execPath,
    [path.join(root, "app", "server.js")],
    {
      cwd: path.join(root, "app"),
      env: {
        ...process.env,
        DEPLOY_MODE: "portable",
        HOSTNAME: "127.0.0.1",
        PORT: String(port),
        DATA_DIR: dataDir,
        MIGRATIONS_DIR: path.join(root, "app", "migrations"),
        TMPDIR: tmpDir,
        TEMP: tmpDir,
        TMP: tmpDir,
        NEXT_TELEMETRY_DISABLED: "1",
        LAUNCHER_TOKEN: token,
      },
      stdio: "inherit",
    },
  );
  server.on("exit", () => {
    cleanProfile();
    process.exit(0);
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await fetch(base + "/api/internal/shutdown", {
        method: "POST",
        headers: { "x-launcher-token": token },
      });
    } catch {}
    setTimeout(() => server.kill(), 5000).unref(); // force-stop if it does not exit by itself
  };

  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/heartbeat")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }

  const t0 = Date.now();
  const browser = openPrivate(base);
  if (browser) {
    browser.on("exit", () => {
      if (Date.now() - t0 > 10_000) setTimeout(shutdown, 3000);
    });
  } else {
    openDefault(base);
    console.log(
      "Chrome or Edge not found, so your default browser was opened. It may keep history.",
    );
  }
  console.log(
    "Vaultbook is running. Close the browser window to lock and exit.",
  );

  // watchdog: no page heartbeat for 3 minutes means the browser was closed
  setInterval(async () => {
    try {
      const r = await (await fetch(base + "/api/heartbeat")).json();
      if (r.idleMs > 180_000) shutdown();
    } catch {}
  }, 10_000);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
