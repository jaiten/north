import { chromium } from 'playwright';
import fs from 'fs';

const FONTS = 'http://localhost:8123/pages/fonts';
const IMG = 'http://localhost:8125/src';

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.62' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='.07'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";

const MARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 20 22 12 17.3 4 22Z" fill="currentColor"/><path d="M12 1.5v15.8" fill="none" stroke="var(--seam)" stroke-width=".8"/></svg>`;

const shell = (w, h, theme, body) => `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}/dm-sans.css">
<link rel="stylesheet" href="${FONTS}/instrument-serif.css">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{
    position:relative;
    font-family:'DM Sans',system-ui,sans-serif;
    background:${theme === 'cream' ? '#f5f3eb' : '#22322a'};
    color:${theme === 'cream' ? '#282e27' : '#eeece2'};
    --seam:${theme === 'cream' ? '#f5f3eb' : '#22322a'};
    --accent:${theme === 'cream' ? '#315744' : '#b0c7a9'};
    --dim:${theme === 'cream' ? '#606659' : '#aab5a2'};
  }
  .grain{position:absolute;inset:0;background-image:${GRAIN};pointer-events:none;z-index:5}
  .glow{position:absolute;inset:0;pointer-events:none;
    background:radial-gradient(70% 80% at 78% 8%, ${theme === 'cream' ? 'rgba(255,255,255,.75)' : 'rgba(150,190,160,.14)'}, transparent 62%)}
  .brand{display:flex;align-items:center;gap:9px;font-size:21px;font-weight:500;letter-spacing:-.03em}
  .brand svg{width:20px;height:26px;color:var(--accent)}
  .brand b{font-weight:500}
  .brand i{font-style:normal;color:var(--accent)}
  .eyebrow{font-size:12px;font-weight:500;letter-spacing:.17em;text-transform:uppercase;color:var(--accent)}
  h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.015em;line-height:1.04}
  h1 em{font-style:italic;color:var(--accent)}
  p.sub{color:var(--dim);line-height:1.55}
  .shot{border-radius:16px;box-shadow:0 2px 6px rgba(20,30,22,.10),0 40px 80px -28px rgba(20,30,22,${theme === 'cream' ? '.30' : '.7'});display:block}
  .chips{display:flex;gap:9px;flex-wrap:wrap}
  .chip{font-size:14px;font-weight:500;color:var(--dim);border:1px solid ${theme === 'cream' ? '#d8dbcf' : 'rgba(238,236,226,.22)'};border-radius:999px;padding:7px 15px}
  .chip.fill{background:var(--accent);color:${theme === 'cream' ? '#f5f3eb' : '#22322a'};border-color:var(--accent)}
</style>
<div class="glow"></div>${body}<div class="grain"></div>`;

// ---- the five store screenshots, 1280 x 800 --------------------------------
const panel = ({ theme, eyebrow, title, sub, imgs, layout = 'right' }) => shell(1280, 800, theme, `
<div style="position:absolute;inset:0;display:grid;grid-template-columns:${layout === 'right' ? '486px 1fr' : '1fr'};align-items:center">
  <div style="padding:0 0 0 72px;${layout === 'centre' ? 'text-align:center;padding:64px 90px 0' : ''};z-index:2">
    <div class="brand" style="margin-bottom:34px;${layout === 'centre' ? 'justify-content:center' : ''}">${MARK}<b>north<i>.</i></b></div>
    <p class="eyebrow" style="margin-bottom:16px">${eyebrow}</p>
    <h1 style="font-size:${layout === 'centre' ? 50 : 46}px;margin-bottom:18px">${title}</h1>
    <p class="sub" style="font-size:17.5px;max-width:${layout === 'centre' ? '760px' : '400px'};${layout === 'centre' ? 'margin:0 auto' : ''}">${sub}</p>
  </div>
  <div style="position:relative;height:100%">${imgs}</div>
</div>`);

const panels = [
  // 1 — the block page
  panel({
    theme: 'green', eyebrow: 'The moment it matters',
    title: 'A pause, right where<br>the scroll <em>begins.</em>',
    sub: 'North replaces the blocked page with a moment to choose — and a way back to what you were actually doing.',
    imgs: `<img class="shot" src="${IMG}/blocked.png" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:706px">`
  }),
  // 2 — short video
  panel({
    theme: 'cream', eyebrow: 'Blocked as a category',
    title: 'Short video.<br><em>Closed for good.</em>',
    sub: 'Endless vertical feeds are hidden wherever they appear and unreachable by address. A clip a friend sends still plays — that one, for five minutes.',
    imgs: `<img class="shot" src="${IMG}/shorts.png" style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:830px">`
  }),
  // 3 — messages only
  panel({
    theme: 'cream', eyebrow: 'Messages-only modes',
    title: 'Lose the feed.<br><em>Keep your people.</em>',
    sub: 'A social network can open straight to your inbox instead of its feed. Your conversations work exactly as before; the feed stops loading.',
    imgs: `<img class="shot" src="${IMG}/social.png" style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:830px">`
  }),
  // 4 — the unlock
  panel({
    theme: 'green', eyebrow: 'An unlock you have to mean',
    title: 'A wait you set.<br><em>Then twenty words.</em>',
    sub: 'The timer only counts while North is in front of you. Leave the page and it starts again. Then you write, in your own words, why.',
    imgs: `<img class="shot" src="${IMG}/wait.png" style="position:absolute;left:-6px;top:64px;width:430px">
           <img class="shot" src="${IMG}/journal.png" style="position:absolute;left:274px;top:246px;width:470px">`
  }),
  // 5 — free + private
  panel({
    theme: 'cream', eyebrow: 'Free forever · No account',
    title: 'Your progress. Your words.<br><em>Your device.</em>',
    sub: 'Every feature, for everyone, with no trial and no premium tier. Settings, journal and stats never leave your browser.',
    imgs: `<img class="shot" src="${IMG}/stats.png" style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:830px">`
  })
];

// ---- small promo tile, 440 x 280 ------------------------------------------
const small = shell(440, 280, 'green', `
<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 38px;z-index:2">
  <div class="brand" style="font-size:30px;margin-bottom:20px">${MARK}<b>north<i>.</i></b></div>
  <h1 style="font-size:30px;margin-bottom:14px">Block the feed.<br><em>Keep the good parts.</em></h1>
  <p class="sub" style="font-size:13.5px">The endless feeds and the sites that take your day.</p>
  <p style="margin-top:16px;font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)">Free forever</p>
</div>`);

// ---- marquee promo tile, 1400 x 560 ---------------------------------------
const marquee = shell(1400, 560, 'green', `
<div style="position:absolute;inset:0;display:grid;grid-template-columns:640px 1fr;align-items:center;z-index:2">
  <div style="padding-left:78px">
    <div class="brand" style="font-size:26px;margin-bottom:34px">${MARK}<b>north<i>.</i></b></div>
    <h1 style="font-size:56px;margin-bottom:22px">A little less feed.<br><em>A little more life.</em></h1>
    <p class="sub" style="font-size:19px;max-width:470px;margin-bottom:30px">Blocks the feeds and the sites that take your day — and makes switching it off cost more than leaving it on.</p>
    <div class="chips">
      <span class="chip fill">Free forever</span>
      <span class="chip">No account</span>
      <span class="chip">Nothing leaves your browser</span>
    </div>
  </div>
  <div style="position:relative;height:100%">
    <img class="shot" src="${IMG}/blocked.png" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:600px">
  </div>
</div>`);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function render(name, html, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `out/${name}.png` });
  await p.close();
  console.log(name, w + 'x' + h, Math.round(fs.statSync(`out/${name}.png`).size / 1024) + 'KB');
}
for (let i = 0; i < panels.length; i++) await render(`screenshot-${i + 1}`, panels[i], 1280, 800);
await render('promo-small', small, 440, 280);
await render('promo-marquee', marquee, 1400, 560);
await b.close();
