# Chrome Web Store listing

Copy for the [developer dashboard](https://chrome.google.com/webstore/devconsole).
Kept here so a resubmission doesn't mean rewriting it from scratch.

Upload artifact: `faceit-crosshair-peek-vX.Y.Z.zip` from the GitHub release for that tag.

---

## Store listing tab

**Name** (45 char limit)

```
FACEIT Crosshair Peek
```

**Summary** (132 char limit — must match `description` in `manifest.json`)

```
Hover a match on a FACEIT profile to preview every player's CS2 crosshair, rendered from their share code.
```

**Category:** Tools
**Language:** English

**Detailed description**

```
See every player's actual CS2 crosshair without leaving the profile page.

FACEIT already records each player's crosshair for every match, but it's buried: you have
to open the match room, switch to Stats, switch to the Advanced tab, and copy out a share
code that means nothing until you paste it into the game.

FACEIT Crosshair Peek puts it one hover away. Point at any match row on a player's profile
and you get all ten players' crosshairs, drawn to scale, side by side.

FEATURES

• Hover any match row to see all ten crosshairs at once
• Rendered, not just the share code — using CS2's own pixel math, so what you see matches
  what the player actually sees at 1080p
• Works on the match history and on the recent matches list on the profile overview
• Click any share code to copy it to your clipboard, ready to paste into CS2
• The profile owner's row is highlighted so you can find them at a glance
• Kills and deaths shown alongside each player

HOW IT WORKS

The extension reads the crosshair data FACEIT already publishes for a match, decodes the
share code, and draws it to a canvas. It runs only on faceit.com, and only makes a request
when you actually hover a match row. Results are cached for as long as the tab is open.

PRIVACY

No accounts, no tracking, no analytics, no data collection of any kind. The extension has
no background process and no storage — close the tab and nothing of it remains. It requests
no Chrome permissions at all beyond running on faceit.com.

It is also fully open source and GPL-3 licensed:
https://github.com/lednifrolg/faceit-crosshair-peek

GOOD TO KNOW

• Not every match has crosshair data. FACEIT only records it where the demo was parsed;
  those matches say so instead.
• The legacy dynamic crosshair styles (cl_crosshairstyle 0 and 1) can't be drawn as a
  static image and are shown as "dynamic".

Not affiliated with FACEIT or Valve. Counter-Strike is a trademark of Valve Corporation.
```

---

## Graphic assets

| Asset | Requirement | Status |
| --- | --- | --- |
| Store icon | 128×128 PNG | `src/icons/icon128.png` ✅ |
| Screenshot | **exactly** 1280×800 or 640×400, 1–5 of them | ⚠️ `docs/screenshot.png` is 686×588 — must be redone |
| Small promo tile | 440×280 PNG, optional | optional |

Best screenshot is the popup open mid-hover with all ten crosshairs visible. Since the
popup is narrower than 1280px, capture the surrounding FACEIT page for context rather than
upscaling the popup — upscaled screenshots look blurry and get flagged as low quality.

---

## Privacy tab

**Single purpose description**

```
The extension has one purpose: to display CS2 crosshair settings for players in a FACEIT
match. When the user hovers a match row on a faceit.com profile page, it retrieves the
crosshair share codes FACEIT publishes for that match, decodes them, and renders each
player's crosshair as an image in a popup.
```

**Justification — host access to `https://www.faceit.com/*`**

```
The extension's entire function is to annotate faceit.com match rows, so it needs to run on
faceit.com to detect the hovered match and to read the match's crosshair data from FACEIT's
own public endpoints on the same origin.

The match pattern covers all of www.faceit.com rather than just the profile paths because
FACEIT is a single-page application: navigating to a profile from elsewhere on the site is a
client-side route change with no document load, so a content script scoped to the profile
paths would never be injected. To keep this from having any cost elsewhere on the site, the
script attaches its event listeners only while the user is actually on a player profile and
removes them on leaving. Off a profile it holds no listeners, no injected DOM and no timers.

The extension requests no Chrome permissions beyond this host access — no storage, no
tabs, no background service worker.
```

**Remote code:** No, I am not using remote code.
All logic is in the package. The extension fetches only JSON data from faceit.com; it never
loads or executes external script.

**Data usage** — certify collection of **none** of the listed categories.
The extension has no storage, sends no data anywhere, and has no analytics or telemetry.
The only network requests are same-origin reads of faceit.com's public match endpoints,
made with `credentials: "omit"` so they carry no cookies or session.

**Privacy policy URL:** not required — no user data is collected.

---

## Submission checklist

- [ ] $5 one-time developer registration paid and cleared
- [ ] 1280×800 screenshot produced
- [ ] Zip downloaded from the GitHub release (not hand-zipped from `src/`)
- [ ] Listing copy above pasted in
- [ ] Single purpose + host justification pasted in
- [ ] Data usage certified as "no data collected"
- [ ] Distribution set to Public
- [ ] Submitted for review — expect a few days, sometimes longer for a first submission
