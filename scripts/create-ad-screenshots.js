const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "store-ad-screenshots");
fs.mkdirSync(outDir, { recursive: true });

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9444 + Math.floor(Math.random() * 1000);
const userDataDir = path.join(os.tmpdir(), `north-ad-shots-${Date.now()}`);

function asFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

const bgUrl = asFileUrl(path.join(root, "store-assets", "focus-shield-bg.png"));
const iconUrl = asFileUrl(path.join(root, "icons", "icon128.png"));

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

function html(title, body, extraClass = "") {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1280,height=800">
<link rel="preconnect" href="https://fonts.bunny.net">
<link rel="stylesheet" href="https://fonts.bunny.net/css?family=plus-jakarta-sans:400,600,700,800&display=swap">
<style>
  * { box-sizing: border-box; }
  html, body { width: 1280px; height: 800px; margin: 0; overflow: hidden; }
  body {
    font-family: "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif;
    color: #171c3f;
    background:
      radial-gradient(circle at 85% 82%, rgba(45,212,191,.26), transparent 30%),
      radial-gradient(circle at 16% 14%, rgba(251,191,36,.18), transparent 30%),
      linear-gradient(135deg, #fffaf1 0%, #f4f6ff 50%, #edf9fb 100%);
  }
  .slide { position: relative; width: 1280px; height: 800px; padding: 64px 80px; overflow: hidden; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 850; font-size: 24px; letter-spacing: 0; }
  .brand img { width: 52px; height: 52px; border-radius: 14px; box-shadow: 0 16px 34px rgba(72,86,223,.22); }
  .tag { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px; background: rgba(255,255,255,.72); border: 1px solid rgba(127,136,179,.24); color: #4d5784; font-size: 14px; font-weight: 750; }
  h1 { margin: 34px 0 16px; font-size: 70px; line-height: .98; max-width: 700px; letter-spacing: 0; }
  h2 { margin: 0 0 14px; font-size: 44px; line-height: 1.02; letter-spacing: 0; }
  p { margin: 0; color: #515b88; font-size: 22px; line-height: 1.42; max-width: 620px; }
  .copy { position: relative; z-index: 2; }
  .chips { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 30px; max-width: 630px; }
  .chip { padding: 12px 16px; border-radius: 999px; background: rgba(255,255,255,.78); border: 1px solid rgba(118,129,176,.23); color: #36416d; font-size: 16px; font-weight: 800; box-shadow: 0 12px 28px rgba(32,40,90,.07); }
  .button { display: inline-flex; align-items: center; justify-content: center; margin-top: 34px; min-width: 250px; height: 54px; border-radius: 15px; color: white; font-size: 17px; font-weight: 900; background: linear-gradient(135deg, #5c65f2, #28c4bd); box-shadow: 0 18px 38px rgba(61,84,224,.25); }
  .panel { background: rgba(255,255,255,.82); border: 1px solid rgba(130,140,185,.23); border-radius: 28px; box-shadow: 0 28px 70px rgba(34,43,97,.14); backdrop-filter: blur(10px); }
  .hero-bg { position: absolute; inset: 0; background-image: linear-gradient(90deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.72) 40%, rgba(255,255,255,.05) 72%), url("${bgUrl}"); background-size: cover; background-position: center; }
  .hero .copy { width: 610px; }
  .hero h1 { max-width: 680px; }
  .right-stack { position: absolute; right: 82px; top: 108px; width: 430px; display: grid; gap: 18px; z-index: 2; }
  .metric { display: flex; align-items: center; justify-content: space-between; padding: 22px 24px; border-radius: 22px; background: rgba(255,255,255,.84); border: 1px solid rgba(129,140,191,.22); box-shadow: 0 24px 54px rgba(29,38,91,.11); }
  .metric strong { font-size: 34px; }
  .metric span { color: #667098; font-weight: 800; }
  .phone-wall { position: absolute; right: 70px; top: 84px; width: 470px; height: 640px; }
  .phone { position: absolute; width: 154px; height: 254px; border-radius: 28px; background: #161b35; box-shadow: 0 26px 64px rgba(30,38,85,.22); padding: 12px; transform: rotate(var(--r)); }
  .phone:nth-child(1) { left: 24px; top: 34px; --r: -9deg; }
  .phone:nth-child(2) { left: 188px; top: 118px; --r: 8deg; }
  .phone:nth-child(3) { left: 92px; top: 350px; --r: -4deg; }
  .screen { width: 100%; height: 100%; border-radius: 20px; background: linear-gradient(160deg, #fb7185, #a9552f 62%, #7f9c62); position: relative; overflow: hidden; }
  .screen:before { content: ""; position: absolute; inset: 18px; border-radius: 18px; border: 3px solid rgba(255,255,255,.84); }
  .blocked { position: absolute; inset: 0; display: grid; place-items: center; color: white; font-size: 82px; font-weight: 900; background: rgba(18,23,54,.35); }
  .slash { width: 92px; height: 92px; border-radius: 50%; border: 8px solid white; position: relative; }
  .slash:after { content: ""; position: absolute; left: 38px; top: -12px; width: 8px; height: 112px; border-radius: 9px; background: white; transform: rotate(42deg); }
  .rule-grid { position: absolute; right: 74px; top: 92px; width: 522px; display: grid; gap: 18px; }
  .rule { padding: 26px; border-radius: 26px; background: white; border: 1px solid rgba(129,140,191,.25); box-shadow: 0 22px 52px rgba(34,43,97,.12); }
  .rule-top { display: flex; align-items: center; gap: 14px; color: #1c244e; font-size: 24px; font-weight: 900; margin-bottom: 14px; }
  .rule-icon { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; color: white; font-weight: 950; background: linear-gradient(135deg, #5b66f2, #2cc6bd); }
  .rule p { font-size: 17px; line-height: 1.38; }
  .mock-block { position: absolute; right: 92px; top: 108px; width: 480px; padding: 46px; text-align: center; }
  .north-mark { width: 70px; height: 70px; margin: 0 auto 28px; border-radius: 20px; box-shadow: 0 18px 42px rgba(86,105,236,.25); }
  .pills { display: flex; justify-content: center; gap: 10px; margin: 22px 0; flex-wrap: wrap; }
  .pill { padding: 10px 14px; border-radius: 999px; background: #eef1ff; color: #323c72; font-size: 14px; font-weight: 900; border: 1px solid #d9def5; }
  .unlock { margin: 24px auto 0; width: 270px; padding: 15px; border-radius: 14px; background: linear-gradient(135deg,#5c65f2,#28c4bd); color: white; font-weight: 900; }
  .text-lines { display: grid; gap: 10px; margin: 22px auto 0; width: 320px; }
  .text-lines i { display: block; height: 12px; border-radius: 999px; background: #dfe4f5; }
  .dashboard { position: absolute; right: 78px; top: 92px; width: 560px; height: 610px; padding: 28px; }
  .dash-top { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 22px; }
  .stat { padding: 20px; border-radius: 18px; background: #f4f7ff; }
  .stat b { display: block; font-size: 36px; color: #171c3f; }
  .stat span { display: block; margin-top: 6px; color: #63709b; font-weight: 800; font-size: 14px; }
  .bar { height: 34px; border-radius: 999px; background: #edf1fb; overflow: hidden; margin: 14px 0; }
  .bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #5c65f2, #28c4bd); }
  .feed-clean { position: absolute; right: 74px; top: 92px; width: 548px; height: 612px; padding: 30px; }
  .feed-row { display: grid; grid-template-columns: 58px 1fr auto; gap: 16px; align-items: center; padding: 18px 0; border-bottom: 1px solid #e4e8f6; }
  .avatar { width: 58px; height: 58px; border-radius: 18px; background: linear-gradient(135deg,#5c65f2,#7f9c62); }
  .feed-row b { display: block; font-size: 18px; }
  .feed-row span { color: #667098; font-size: 15px; font-weight: 750; }
  .toggle { width: 62px; height: 34px; border-radius: 999px; background: #a9552f; position: relative; }
  .toggle:after { content: ""; width: 26px; height: 26px; border-radius: 50%; background: white; position: absolute; top: 4px; right: 4px; }
  .clean-banner { margin-top: 24px; padding: 24px; border-radius: 22px; background: linear-gradient(135deg, rgba(92,101,242,.1), rgba(45,212,191,.16)); border: 1px solid rgba(99,102,241,.15); }
  .clean-banner b { display: block; font-size: 26px; margin-bottom: 8px; }
  .clean-banner span { color: #58638d; font-weight: 750; }
  .footer-note { position: absolute; left: 80px; bottom: 58px; color: #7a83a9; font-size: 15px; font-weight: 750; }
</style>
</head>
<body class="${extraClass}">${body}</body>
</html>`;
}

const slides = [
  {
    file: "01-block-distractions.png",
    html: html("block distractions", `
      <div class="slide hero">
        <div class="hero-bg"></div>
        <div class="copy">
          <div class="brand"><img src="${iconUrl}" alt="">North</div>
          <div class="tag" style="margin-top:18px">free for life. actually.</div>
          <h1>block distractions before they become the day.</h1>
          <p>stop short videos, distracting sites, keywords, schedules and daily limits with one calm blocker.</p>
          <div class="chips">
            <span class="chip">short videos</span>
            <span class="chip">sites</span>
            <span class="chip">keywords</span>
            <span class="chip">time limits</span>
          </div>
          <div class="button">find your true north</div>
        </div>
      </div>`)
  },
  {
    file: "02-short-videos-stay-closed.png",
    html: html("short videos", `
      <div class="slide">
        <div class="copy">
          <div class="brand"><img src="${iconUrl}" alt="">North</div>
          <h1>short videos stay closed.</h1>
          <p>block the formats built for endless swiping: Shorts, Reels, TikTok, Spotlight and more.</p>
          <div class="chips">
            <span class="chip">no infinite feed</span>
            <span class="chip">shared links still play</span>
            <span class="chip">category-level blocking</span>
          </div>
        </div>
        <div class="phone-wall">
          <div class="phone"><div class="screen"><div class="blocked"><span class="slash"></span></div></div></div>
          <div class="phone"><div class="screen"><div class="blocked"><span class="slash"></span></div></div></div>
          <div class="phone"><div class="screen"><div class="blocked"><span class="slash"></span></div></div></div>
        </div>
        <div class="footer-note">generic visuals. North works on real web pages inside your browser.</div>
      </div>`)
  },
  {
    file: "03-rules-that-hold.png",
    html: html("rules", `
      <div class="slide">
        <div class="copy">
          <div class="brand"><img src="${iconUrl}" alt="">North</div>
          <h1>rules for the sites that pull you in.</h1>
          <p>block always, during certain hours, or after your daily time budget runs out.</p>
          <div class="chips">
            <span class="chip">always blocked</span>
            <span class="chip">schedules</span>
            <span class="chip">daily limits</span>
          </div>
        </div>
        <div class="rule-grid">
          <div class="rule"><div class="rule-top"><span class="rule-icon">A</span>always</div><p>close the site every time, with no bargaining in the moment.</p></div>
          <div class="rule"><div class="rule-top"><span class="rule-icon">S</span>schedule</div><p>protect work hours, study blocks, evenings, or any repeating window.</p></div>
          <div class="rule"><div class="rule-top"><span class="rule-icon">L</span>limit</div><p>use a site intentionally, then stop when the daily budget is spent.</p></div>
        </div>
      </div>`)
  },
  {
    file: "04-unlock-with-intention.png",
    html: html("unlock", `
      <div class="slide">
        <div class="copy">
          <div class="brand"><img src="${iconUrl}" alt="">North</div>
          <h1>unlocks you have to mean.</h1>
          <p>when you actually need access, North adds friction: wait, write your reason, then choose a short unlock.</p>
          <div class="chips">
            <span class="chip">mindful wait</span>
            <span class="chip">20-word journal</span>
            <span class="chip">temporary access</span>
          </div>
        </div>
        <div class="panel mock-block">
          <img class="north-mark" src="${iconUrl}" alt="">
          <h2>you've hit today's limit.</h2>
          <p style="font-size:17px;margin:auto;max-width:360px">pause before opening the door again.</p>
          <div class="pills"><span class="pill">reddit.com</span><span class="pill">20 min/day</span></div>
          <div class="text-lines"><i></i><i style="width:88%"></i><i style="width:72%"></i></div>
          <div class="unlock">unlock intentionally</div>
        </div>
      </div>`)
  },
  {
    file: "05-keep-useful-parts.png",
    html: html("keep useful parts", `
      <div class="slide">
        <div class="copy">
          <div class="brand"><img src="${iconUrl}" alt="">North</div>
          <h1 style="max-width:560px">keep the useful parts. lose the feeds.</h1>
          <p style="max-width:560px">use messages-only modes and focused YouTube cleanup to keep what helps without opening the scroll.</p>
          <div class="chips">
            <span class="chip">messages-only social</span>
            <span class="chip">YouTube cleanup</span>
            <span class="chip">feed reduction</span>
          </div>
        </div>
        <div class="panel feed-clean">
          <div class="feed-row"><div class="avatar"></div><div><b>messages</b><span>stay available</span></div><div class="toggle"></div></div>
          <div class="feed-row"><div class="avatar"></div><div><b>feeds</b><span>blocked or hidden</span></div><div class="toggle"></div></div>
          <div class="feed-row"><div class="avatar"></div><div><b>Shorts</b><span>category blocked</span></div><div class="toggle"></div></div>
          <div class="feed-row"><div class="avatar"></div><div><b>recommendations</b><span>trimmed down</span></div><div class="toggle"></div></div>
          <div class="clean-banner"><b>no accounts. no ads. no tracking.</b><span>your settings and stats stay local in your browser.</span></div>
        </div>
      </div>`)
  }
];

async function capture(cdp, sessionId, slide) {
  const file = path.join(os.tmpdir(), `north-ad-${Date.now()}-${slide.file}.html`);
  fs.writeFileSync(file, slide.html);
  const loaded = cdp.once("Page.loadEventFired", sessionId);
  await cdp.send("Page.navigate", { url: asFileUrl(file) }, sessionId);
  await loaded;
  // Wait for the brand web font so headings don't capture in the fallback face.
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts.ready.then(() => true)",
    awaitPromise: true
  }, sessionId);
  await delay(450);
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true
  }, sessionId);
  fs.writeFileSync(path.join(outDir, slide.file), Buffer.from(result.data, "base64"));
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

    for (const slide of slides) await capture(cdp, sessionId, slide);
    await cdp.send("Browser.close");
  } finally {
    chrome.kill();
    await delay(500);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Chrome can hold a profile lock briefly on Windows; screenshots are already written.
    }
  }
})();
