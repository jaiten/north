// Renders the Chrome Web Store promo tiles as no-alpha JPEG (the store wants
// "JPEG or 24-bit PNG, no alpha"; JPEG can't carry an alpha channel, so it's
// the safe choice). Brand-matched: arrow logo, Plus Jakarta Sans, lowercase
// voice, free for life.
//
//   Small promo tile   440 x 280
//   Marquee promo tile 1400 x 560
//
// Run: node scripts/create-promo-tiles.js

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "store-promo-tiles");
fs.mkdirSync(outDir, { recursive: true });

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9555 + Math.floor(Math.random() * 1000);
const userDataDir = path.join(os.tmpdir(), `north-promo-${Date.now()}`);

function asFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

const bgUrl = asFileUrl(path.join(root, "store-assets", "focus-shield-bg.png"));
const iconUrl = asFileUrl(path.join(root, "icons", "icon128.png"));

const delay = ms => new Promise(r => setTimeout(r, ms));

async function waitForChrome() {
  const url = `http://127.0.0.1:${port}/json/version`;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* still starting */ }
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
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method, sessionId) {
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
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  return new Cdp(ws);
}

// Shared brand styles. The whole canvas is an opaque gradient, so the JPEG has
// a solid background with no transparency anywhere.
function doc(width, height, body) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.bunny.net">
<link rel="stylesheet" href="https://fonts.bunny.net/css?family=plus-jakarta-sans:400,600,700,800&display=swap">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
  body {
    font-family: "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif;
    color: #1b2150;
    background:
      radial-gradient(circle at 86% 84%, rgba(45,212,191,.30), transparent 34%),
      radial-gradient(circle at 14% 12%, rgba(251,191,36,.20), transparent 32%),
      linear-gradient(135deg, #fffaf1 0%, #f4f6ff 52%, #edf9fb 100%);
  }
  .tile { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
  .brand { display: flex; align-items: center; gap: 12px; font-weight: 850; letter-spacing: 0; }
  .brand img { border-radius: 28%; box-shadow: 0 12px 26px rgba(72,86,223,.22); }
  .tag {
    display: inline-flex; align-items: center; align-self: flex-start;
    padding: 6px 13px; border-radius: 999px; font-weight: 800;
    background: rgba(99,102,241,.12); color: #8e4526; border: 1px solid rgba(99,102,241,.18);
  }
  h1 { margin: 0; line-height: .98; letter-spacing: -0.01em; font-weight: 850; }
  p { margin: 0; color: #515b88; line-height: 1.34; }
  .button {
    display: inline-flex; align-items: center; justify-content: center; align-self: flex-start;
    color: #fff; font-weight: 900; border-radius: 14px;
    background: linear-gradient(135deg, #5c65f2, #28c4bd);
    box-shadow: 0 16px 34px rgba(61,84,224,.26);
  }
  .copy { position: relative; z-index: 2; display: flex; flex-direction: column; height: 100%; }
  .hero-bg {
    position: absolute; inset: 0; z-index: 1;
    background-image:
      linear-gradient(90deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.78) 42%, rgba(255,255,255,.06) 74%),
      url("${bgUrl}");
    background-size: cover; background-position: center right;
  }
</style>
</head>
<body>${body}</body>
</html>`;
}

const SMALL = doc(440, 280, `
  <div class="tile" style="padding:30px 32px">
    <div class="copy" style="justify-content:flex-start; gap:0">
      <div class="brand" style="font-size:22px"><img src="${iconUrl}" width="40" height="40" alt="">North</div>
      <div class="tag" style="margin-top:18px; font-size:12.5px">free for life</div>
      <h1 style="margin-top:16px; font-size:33px">find your true north.</h1>
      <p style="margin-top:12px; font-size:15px; max-width:330px">block the endless feeds and the sites that eat your day.</p>
    </div>
  </div>`);

const MARQUEE = doc(1400, 560, `
  <div class="tile" style="padding:74px 84px">
    <div class="hero-bg"></div>
    <div class="copy" style="justify-content:center; gap:0; max-width:780px">
      <div class="brand" style="font-size:34px"><img src="${iconUrl}" width="60" height="60" alt="">North</div>
      <div class="tag" style="margin-top:26px; font-size:18px">free for life. actually.</div>
      <h1 style="margin-top:22px; font-size:74px; max-width:760px">block the stuff that eats your day.</h1>
      <p style="margin-top:22px; font-size:26px; max-width:640px">the endless feeds and the sites that take your day, gone. your messages stay. no account, no tracking.</p>
      <div class="button" style="margin-top:34px; min-width:280px; height:60px; font-size:20px">find your true north</div>
    </div>
  </div>`);

const tiles = [
  { file: "small-promo-tile.jpg", width: 440, height: 280, html: SMALL },
  { file: "marquee-promo-tile.jpg", width: 1400, height: 560, html: MARQUEE }
];

async function capture(cdp, sessionId, tile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: tile.width, height: tile.height, deviceScaleFactor: 1, mobile: false
  }, sessionId);
  const file = path.join(os.tmpdir(), `north-promo-${Date.now()}-${tile.file}.html`);
  fs.writeFileSync(file, tile.html);
  const loaded = cdp.once("Page.loadEventFired", sessionId);
  await cdp.send("Page.navigate", { url: asFileUrl(file) }, sessionId);
  await loaded;
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts.ready.then(() => true)",
    awaitPromise: true
  }, sessionId);
  await delay(450);
  // JPEG => no alpha channel, ever. Quality high enough that the gradient and
  // text stay crisp.
  const result = await cdp.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 95,
    fromSurface: true,
    captureBeyondViewport: false
  }, sessionId);
  fs.writeFileSync(path.join(outDir, tile.file), Buffer.from(result.data, "base64"));
  fs.rmSync(file, { force: true });
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
    "--window-size=1400,560",
    "about:blank"
  ], { stdio: "ignore" });

  try {
    const version = await waitForChrome();
    const cdp = await connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    for (const tile of tiles) await capture(cdp, sessionId, tile);
    await cdp.send("Browser.close");
  } finally {
    chrome.kill();
    await delay(500);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch { /* Windows can hold the profile lock briefly; tiles are already written */ }
  }
})();
