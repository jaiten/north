const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "store-screenshots");
fs.mkdirSync(outDir, { recursive: true });
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9333 + Math.floor(Math.random() * 1000);
const userDataDir = path.join(os.tmpdir(), `north-store-shots-${Date.now()}`);

function fileUrl(relativePath, suffix = "") {
  const absolute = path.join(root, relativePath).replace(/\\/g, "/");
  return `file:///${absolute}${suffix}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForChrome() {
  const url = `http://127.0.0.1:${port}/json/version`;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error("Chrome did not start with a remote debugging endpoint.");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        return;
      }
      const key = msg.sessionId ? `${msg.sessionId}:${msg.method}` : msg.method;
      const list = this.listeners.get(key) || [];
      list.forEach(resolve => resolve(msg.params));
      this.listeners.delete(key);
    };
  }

  send(method, params = {}, sessionId = undefined) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  once(method, sessionId = undefined) {
    const key = sessionId ? `${sessionId}:${method}` : method;
    return new Promise(resolve => {
      const list = this.listeners.get(key) || [];
      list.push(resolve);
      this.listeners.set(key, list);
    });
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return new Cdp(ws);
}

async function navigate(cdp, sessionId, url) {
  const loaded = cdp.once("Page.loadEventFired", sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  await loaded;
  await delay(600);
}

async function evaluate(cdp, sessionId, expression) {
  return cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);
}

async function prepareOptionsShot(cdp, sessionId) {
  await evaluate(cdp, sessionId, `
    document.getElementById("incognito-banner")?.classList.add("hidden");
    document.scrollingElement.scrollTo(0, 0);
  `);
  await delay(150);
}

async function shot(cdp, sessionId, name) {
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true
  }, sessionId);
  fs.writeFileSync(path.join(outDir, name), Buffer.from(result.data, "base64"));
}

(async () => {
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome was not found at ${chromePath}. Set CHROME_PATH to override.`);
  }

  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,800",
    "about:blank"
  ], { stdio: "ignore" });

  try {
    const version = await waitForChrome();
    const cdp = await connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    }, sessionId);

    await navigate(cdp, sessionId, fileUrl("pages/options.html"));
    await prepareOptionsShot(cdp, sessionId);
    await shot(cdp, sessionId, "01-site-rules.png");

    await evaluate(cdp, sessionId, `document.querySelector('[data-section="shorts"]').click()`);
    await prepareOptionsShot(cdp, sessionId);
    await shot(cdp, sessionId, "02-short-video-blocking.png");

    await evaluate(cdp, sessionId, `document.querySelector('[data-section="youtube"]').click()`);
    await prepareOptionsShot(cdp, sessionId);
    await shot(cdp, sessionId, "03-youtube-focus-tools.png");

    await evaluate(cdp, sessionId, `document.querySelector('[data-section="stats"]').click()`);
    await prepareOptionsShot(cdp, sessionId);
    await shot(cdp, sessionId, "04-progress-stats.png");

    const blockedQuery = new URLSearchParams({
      reason: "limit",
      site: "reddit.com",
      detail: "20",
      from: "https://www.reddit.com/"
    }).toString();
    await navigate(cdp, sessionId, fileUrl("pages/blocked.html", `?${blockedQuery}`));
    await shot(cdp, sessionId, "05-blocked-page.png");

    await cdp.send("Browser.close");
  } finally {
    chrome.kill();
    await delay(500);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Chrome can hold a profile lock briefly on Windows; the screenshots are already written.
    }
  }
})();
