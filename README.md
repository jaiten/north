# ▲ North — Focus Companion & Distraction Blocker

**Find your true north.** North is a free, modern Chrome extension that blocks the sites,
feeds and short-form content that eat your day — and pairs the blocking with **Nori**,
a buddy that nudges, celebrates and occasionally calls you out.

![brand](icons/icon128.png)

## Features

### 🔒 Hard to deactivate — by design
- **Strict mode**: disabling protection, removing a site, raising a limit or loosening a
  schedule all require a **wait timer** (30s–5min, your choice) followed by a **challenge** —
  typing an uncomfortable, honest sentence ("I am choosing distraction over my own goals
  right now") or solving a multiplication. Paste is disabled; you have to type it.
- **The wait demands presence**: switching tabs or unfocusing the window restarts the
  countdown from zero. You can't park it in the background.
- Temporary unlocks are capped (5/10/15/30 min max, configurable) and counted in your stats.
- During a focus session, **no unlocks at all**.

### 🎬 Short-form content: gone
- YouTube Shorts, Instagram Reels, Facebook Reels, Snapchat Spotlight are hidden from
  feeds *and* unreachable by URL (`youtube.com/shorts/...` redirects to the block page).
- TikTok is treated as 100% short-form and blocked entirely (toggleable).
- Short-form blocks are **never unlockable** — that's the point.
- **One exception**: a reel or short a friend sends you. Opened from a DM, another app
  or a pasted link, that *single item* plays for 10 minutes in that tab. Swiping to the
  next one is blocked, browsing the shorts feed stays blocked.

### 🔞 Adult content: blocked by default
- A built-in category of known adult sites and explicit keywords, blocked outright.
- These blocks can **never** be unlocked, not even via the challenge.

### 💬 Instagram: messages only
- `instagram.com` redirects straight to your DM inbox.
- DMs work fully; the feed, Explore, Reels, profiles and posts are blocked, and the
  nav icons for them are removed so there's nothing to click.

### 📺 Block the bad YouTube, keep the good
- Hide the home feed (replaced with a calm "search with intention" prompt).
- Hide related videos, comments, and/or the subscriptions feed.
- **Keyword-filter videos**: any video whose title or channel matches your keywords is
  removed from search, home and sidebars — productive YouTube stays usable.

### ⏰ Schedules
- Per-site blocking windows: pick days of the week and start/end times
  (overnight windows like 22:00–06:00 work too). Multiple windows per site.

### ⏳ Daily time limits
- Give a site a minutes-per-day budget. Time is tracked only while the tab is active
  and focused. Nori warns you when 5 minutes remain; at zero the site blocks until midnight.

### 🔤 Keyword blocking
- Any page whose **URL or title** contains a blocked keyword is stopped, on every site.

### 💙 Nori, your buddy
- Reacts on the block page with context-aware messages ("3rd visit today…"),
- nudges you when a time budget runs low,
- celebrates completed focus sessions with a notification,
- comes in two tones: **Gentle** or **Direct**. Rename it whatever you like.
- The block page's escape hatch ("Take me somewhere better") sends you to one of your
  configured growth destinations — Khan Academy, a random Wikipedia article,
  freeCodeCamp… fully editable.

### 🎯 Focus sessions
- One click in the popup: 25/50/90 min (or custom). Everything on your list is sealed,
  unlocks are disabled, and ending early requires the full challenge.

### 📈 Insights
- Distractions dodged per day, focused time, unlocks used, most-blocked sites,
  estimated time reclaimed — last 14 days, honestly told.

## Install (developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder — the settings page opens automatically
4. Pin North to the toolbar, and **allow it in Incognito** (North will remind you) so the
   blocks hold everywhere.

## Project layout

```
manifest.json          MV3 manifest
src/background.js      Rules engine: navigation guard, schedules, limits,
                       time tracking, focus sessions, unlocks, stats
content/youtube.js     Shorts removal, feed/related/comments hiding, keyword video filter
content/instagram.js   DM-only UI stripping
content/global.js      Page-title keyword reporting + buddy nudge toasts
pages/blocked.html     Block page with wait-ring + challenge unlock flow
pages/popup.html       Status, focus sessions, today's stats
pages/options.html     Full settings dashboard (gated by the challenge)
icons/                 Brand icons
```

## Honesty note

A Chrome extension can't stop a determined user — you can always uninstall it.
North's job is to interrupt **habit**, not to imprison you: every extra second of
friction is a chance for intention to catch up with your thumb.

## Pricing

Free while in beta. A Pro tier is planned — the free plan will eventually cap things like
the number of blocked sites, while Pro adds sync, cross-device coverage and
accountability features.
