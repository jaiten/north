import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const H = 'http://localhost:8123/pages/';
const errs = [];

// The dev fixture randomises its numbers and ships a short 10s wait for
// testing. Store shots want the shipped default and stable sample data, so
// patch the fixture in flight rather than editing the repo.
const IG = [2,3,3,5,4,6,5,7,6,8,7,9,8,10];
const RD = [2,2,2,3,3,4,4,5,5,6,6,6,6,7];
const YT = [1,2,1,2,2,3,2,4,3,4,4,5,4,5];
const XC = [1,2,2,3,2,3,3,3,3,4,3,4,3,4];
const FM = [140,96,120,80,110,60,95,70,88,45,75,50,65,40];
const UN = [0,1,0,1,0,2,1,1,2,1,2,2,1,3];
const a = xs => `[${xs.join(",")}][i]`;

const patch = (src, { wait = 60 } = {}) => src
  .replace('waitSeconds: 10', `waitSeconds: ${wait}`)
  // Index 0 is today, so these series read as a fortnight of steady improvement
  // rather than the fixture's noise -- and, unlike a single fixed object shared
  // by every day, they give the bar chart an actual shape.
  .replace('blocks: { "x.com": Math.floor(Math.random() * 9), "reddit.com": Math.floor(Math.random() * 6), "youtube.com": Math.floor(Math.random() * 4) }',
           `blocks: { "instagram.com": ${a(IG)}, "reddit.com": ${a(RD)}, "youtube.com": ${a(YT)}, "x.com": ${a(XC)} }`)
  .replace('focusMinutes: Math.floor(Math.random() * 120)', `focusMinutes: ${a(FM)}`)
  .replace('unlocks: Math.floor(Math.random() * 3)', `unlocks: ${a(UN)}`)
  .replace('isAllowedIncognitoAccess: cb => cb(false)', 'isAllowedIncognitoAccess: cb => cb(true)');

async function grab(name, url, vp, { fn, clip, wait = 60 } = {}) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push(name + ': ' + e.message));
  await p.route('**/dev-shim.js', async route => {
    const res = await route.fetch();
    route.fulfill({ body: patch(await res.text(), { wait }), contentType: 'application/javascript' });
  });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  if (fn) await fn(p);
  await (clip ? p.locator(clip) : p).screenshot({ path: `src/${name}.png` });
  await p.close();
}

const B = H + 'blocked.html?reason=blocklist&site=instagram.com';
await grab('blocked', B, { width: 1120, height: 800 }, { clip: '#main-card' });
await grab('wait', B, { width: 1120, height: 840 }, {
  clip: '#unlock-card',
  fn: async p => { await p.click('#btn-unlock'); await p.waitForTimeout(3400); }
});
// Reaching step two needs the timer to finish, so this one keeps the short wait.
await grab('journal', B, { width: 1120, height: 920 }, {
  wait: 10, clip: '#unlock-card',
  fn: async p => {
    await p.click('#btn-unlock');
    await p.waitForTimeout(11800);
    await p.fill('#challenge-why', "I need one specific thread for my coursework, not a scroll break. Ten minutes, then I close the tab and get back to the draft.");
    await p.waitForTimeout(600);
  }
});
await grab('popup', H + 'popup.html', { width: 380, height: 700 }, { clip: 'body' });
await grab('popup-active', H + 'popup.html', { width: 380, height: 700 }, {
  clip: 'body',
  fn: async p => { await p.click('.chip[data-mins="50"]'); await p.click('#btn-focus'); await p.waitForTimeout(1000); }
});
const sec = (name, id, h) => grab(name, H + 'options.html', { width: 1240, height: h }, {
  clip: '.layout',
  fn: p => p.click(`.nav-item[data-section="${id}"]`).then(() => p.waitForTimeout(800))
});
await grab('sites', H + 'options.html', { width: 1240, height: 900 }, { clip: '.layout' });
await sec('shorts', 'shorts', 940);
await sec('social', 'social', 940);
await sec('strict', 'strict', 940);
await sec('stats', 'stats', 940);
console.log('errors:', errs.length ? errs : 'none');
await b.close();
