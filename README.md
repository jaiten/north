# ▲ North. Focus & Distraction Blocker

North blocks everything you don't need to see, short-form videos, distracting
sites and keywords, with schedules, daily limits, and an unlock you have to
mean. Free forever: no account, no ads, no premium tier, no data leaving your
browser.

![brand](icons/icon128.png)

## What it does

### 🔒 Hard to deactivate, by design
- Disabling protection, removing a blocked site, raising a limit or loosening a
  schedule all require a **wait timer** followed by a **challenge**. The wait
  is set on a slider — first on the welcome screen, then in Settings — anywhere
  from 10 seconds to 2 minutes. Setting it during onboarding is free, since
  nothing is protected yet; shortening it afterwards is itself a change that
  takes the challenge. The timer only
  runs while you're focused on the page; switching tabs, apps or windows
  restarts it from zero.
- The challenge is the **unlock journal**: at least 20 honest words to your
  future self about why you need the site. No pasting, no keyboard mash. A
  typed reflection sentence or a multiplication can be stacked on top.
- Misclicks are cheap: protective toggles get a 10s free undo, fresh site adds
  get 30s, and "hard to undo" tags show exactly which settings cost a challenge.
- The four messages-only modes additionally carry **one free reversal each**,
  with no timer and no expiry, because they're the protections people accept
  before they know what they do. The pass is spent the first time it's used and
  recorded in settings, so it doesn't return next session (or via an import).
  Master protection, strict mode, the wait length, short videos, TikTok, and
  removing sites or keywords never get one.
- Temporary unlocks are capped (5/10/15/30 min max, configurable) and counted.
  During a focus session, no unlocks at all.
- **The one-minute pause**: the popup carries a button that turns every block
  off for exactly one minute, then switches it all back on by itself. It is
  free once a day for the first three calendar days after install — new users
  need a door, not a trap — and after that it costs the same wait and challenge
  as any other way off. Lockdown and focus sessions are never pausable, and
  adult blocking isn't lifted by it either. The allowance is stamped from
  `meta.installedAt` and spent in `pauseUse`, both in local storage.

### 🎬 Short-form video: gone
- YouTube Shorts, Instagram Reels, Facebook Reels, Snapchat Spotlight are
  hidden from feeds *and* unreachable by URL. TikTok can be blocked entirely.
- Short-form blocks are **never unlockable**. That's the point.
- **One exception**: a reel or short a friend sends you. Opened from a DM,
  another app or a pasted link, that single item plays for 5 minutes. Swiping
  to the next one stays blocked.
- The rate limit follows the conversation, not the clock alone: each DM thread
  gets one new item per 10 minutes, so three people messaging you at once open
  as three items, while a thread full of reels still can't be scrolled. Links
  from anywhere else share one 10-minute lane, as before. An item only ever
  gets one pass in its life — re-opening something you already watched is an
  old message, and old messages are how a feed gets rebuilt link by link.
  Whether a message is unread isn't knowable from the URL, and the DM page's
  own DOM isn't trustworthy for a permission check, so "one per conversation,
  never the same item twice" is the honest approximation.

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

### 👋 Introducing itself, quietly
- North's best switches are off by default and live behind a settings page most
  people never open, so for the first three weeks it introduces a few of them
  where they make sense: a card on the YouTube homepage ("this is a lot, isn't
  it?" → calm the feed), one under a video's comments, one at the foot of a news
  article, and a pointer to messages-only mode on Instagram and LinkedIn.
- A card only ever offers a switch that costs **nothing** to reverse, and it
  carries its own undo. Talking someone into a protection they then need a wait
  and a journal entry to escape would be a trap, not an introduction — so the
  two real protections among them open the settings page instead of flipping
  themselves on.
- The quotas are the point: each idea is offered **twice at most**, never more
  than **two cards a day** or **six in total**, never within three minutes of
  another, and never at all once you act on one. Nothing appears during a pause,
  a focus session or a lockdown, or after the first 21 days. Every card carries
  "don't show me tips like this", and Preferences has the same switch.

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

### Interface preview

Run `python -m http.server 8001 --bind 127.0.0.1` from the project root, then open:

- Settings: `http://127.0.0.1:8001/pages/options.html`
- Popup: `http://127.0.0.1:8001/pages/popup.html`
- Onboarding: `http://127.0.0.1:8001/pages/options.html#welcome`
- Block page: `http://127.0.0.1:8001/pages/blocked.html?reason=blocklist&site=x.com`

Browser previews use sample data through `pages/dev-shim.js`. The shim does
nothing inside the installed extension. Reload the unpacked extension to test
real blocking and saved settings.

The interface shares the website's paper and pine palette, locally bundled
DM Sans and Instrument Serif fonts, and compass identity. `pages/ui.js` supplies
navigation semantics, dialog focus management, and optional reveal animations.
Both themes support narrow screens and reduced motion. Font licenses are in
`pages/fonts/`.

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
content/news.js        Recirculation rail and chum-box stripping on news sites
content/pause-state.js Shared pause state for the site scripts, so a paused
                       North stops decluttering too (runs before each of them)
content/hints.js       The introduction cards: picks the moment and draws the
                       card; the worker owns the copy, the quotas and the switch
pages/blocked.html     Block page with wait ring + journal unlock flow
pages/popup.html       Status, focus sessions, the one-minute pause, today's stats
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
