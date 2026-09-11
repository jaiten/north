# Store assets

Everything the Chrome Web Store listing needs, at the exact sizes it accepts.
All seven files are 24-bit PNG with no alpha channel, which is what the store
requires — a PNG with an alpha channel is rejected at upload even when nothing
in it is transparent.

| File | Size | Slot |
| --- | --- | --- |
| `screenshot-1.png` | 1280 × 800 | Screenshot — the block page |
| `screenshot-2.png` | 1280 × 800 | Screenshot — short videos |
| `screenshot-3.png` | 1280 × 800 | Screenshot — messages-only modes |
| `screenshot-4.png` | 1280 × 800 | Screenshot — the unlock |
| `screenshot-5.png` | 1280 × 800 | Screenshot — progress and privacy |
| `promo-small.png` | 440 × 280 | Small promo tile |
| `promo-marquee.png` | 1400 × 560 | Marquee promo tile |

`focus-shield-bg.png` is an older unused background and is not part of the
listing.

## Regenerating

The screenshots are real renders of the extension's own pages, not mockups, so
they stay honest as the UI changes. Three steps, from the repository root:

```sh
python3 -m http.server 8123                     # serves pages/ and its fonts
cd store-assets/tools
python3 -m http.server 8125                     # serves src/ to the compositor
node cap.mjs        # captures the UI into src/ at 2x
node build.mjs      # composites the seven canvases into out/
python3 convert.py  # flattens out/ to 24-bit no-alpha PNG in final/
```

`cap.mjs` patches `pages/dev-shim.js` in flight rather than editing it: the
fixture randomises its numbers and ships a 10-second wait for testing, while
the store shots want the shipped 60-second default and a stable fortnight of
sample data. `convert.py` also asserts every output's exact dimensions, so a
layout change that resizes a canvas fails the build instead of reaching the
store at the wrong size.
