# ▲ North: Focus & Distraction Blocker

North is a browser extension that blocks the sites, feeds and short-form
content that eat your day. Free for life: no account, no ads, no premium tier,
no data leaving your browser.

![brand](icons/icon128.png)

## What it does

### 🔒 Hard to deactivate, by design
- Disabling protection, removing a blocked site, raising a limit or loosening a
  schedule all require a **wait timer** followed by a **challenge**. The wait
  is set on a slider in Settings, anywhere from 10 seconds to 2 minutes, and
  shortening it is itself a change that takes the challenge. The timer only
  runs while you're focused on the page; switching tabs, apps or windows
  restarts it from zero.
- The challenge is the **unlock journal**: at least 20 honest words to your
  future self about why you need the site. No pasting, no keyboard mash. A
  typed reflection sentence or a multiplication can be stacked on top.
- Misclicks are cheap: protective toggles get a 10s free undo, fresh site adds
  get 30s, and "hard to undo" tags show exactly which settings cost a challenge.
- Temporary unlocks are capped (5/10/15/30 min max, configurable) and counted.
  During a focus session, no unlocks at all.

### 🎬 Short-form video: gone
- YouTube Shorts, Instagram Reels, Facebook Reels, Snapchat Spotlight are
  hidden from feeds *and* unreachable by URL. TikTok can be blocked entirely.
- Short-form blocks are **never unlockable**. That's the point.
- **One exception**: a reel or short a friend sends you. Opened from a DM,
  another app or a pasted link, that single item plays for 5 minutes. Swiping
  to the next one stays blocked, one new pass per 10 minutes.

### 🔞 Adult content: blocked for everyone
- A built-in category of known adult sites and explicit keywords, blocked
  outright. Never unlockable, not even via the challenge.

### 💬 Messages only
- Instagram, LinkedIn, Facebook and X can each run in messages-only mode: the
  site opens straight to your inbox, DMs work fully, the feed stops existing.

### 🧹 Site cleanups (no challenge, just less bait)
- **YouTube**: hide the whole sidebar, home feed, related videos, comments
  and subscriptions. Topic mode shows only videos matching your topics.
- **LinkedIn**: hide the Home and My Network nav buttons.
- **Twitch**: calm homepage, no recommended channels or categories, no
  Browse / Following / For You, no notification bell.

### ⏰ Schedules and budgets
- Per-site blocking windows (overnight windows work) and minutes-per-day
  budgets. Time only counts while the tab is active and focused. A nudge fires
  at 5 minutes left; at zero the site blocks until midnight, and an interrupted
  YouTube video resumes where it stopped.

### 🎯 Focus sessions and lockdown
- Focus: 25/50/90 min or custom. Everything on your list is sealed and ending
  early requires the full challenge.
- Lockdown: allowlist-only mode for exam week, 15 minutes to 7 days. There is
  deliberately no off switch.

### 📈 Honest progress
- Distractions dodged, focused time, unlocks used, most-blocked sites and your
  journal entries, shown for the last 14 days.

## Install (developer mode)

1. Open `chrome://extensions` (or `about:debugging` in Firefox)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder. The settings page opens
   automatically.
4. Pin North to the toolbar and **allow it in Incognito** so the blocks hold
   everywhere.

One build works in both Chrome and Firefox: the manifest declares both a
service worker (Chrome) and an event page (Firefox). Chrome logs a harmless
"background.scripts requires manifest version 2" warning. Firefox treats host
permissions as optional, so grant them once in about:addons.

## Project layout

```
manifest.json          MV3 manifest (Chrome + Firefox from one build)
src/background.js      Rules engine: navigation guard, schedules, limits,
                       time tracking, focus sessions, lockdown, unlocks, stats
content/youtube.js     Shorts removal, sidebar/feed/related/comments hiding,
                       keyword and topic video filtering
content/instagram.js   Messages-only UI stripping
content/linkedin.js    Home + My Network nav hiding
content/twitch.js      Calm homepage and recommendation stripping
content/global.js      Page-title keyword reporting + nudge toasts
pages/blocked.html     Block page with wait ring + journal unlock flow
pages/popup.html       Status, focus sessions, today's stats
pages/options.html     Full settings dashboard (gated by the challenge)
icons/                 Brand icons
```

## Honesty note

A browser extension can't stop a determined user. You can always uninstall it.
North's job is to interrupt **habit**, not to imprison you: every extra second
of friction is a chance for intention to catch up with your thumb.

## Pricing

Free for life. The [tip jar](https://ko-fi.com/jaiten) is the entire business
model.
