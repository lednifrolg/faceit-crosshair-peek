# Contributing

There is no build step, no package.json, no test suite and no linter. `src/` **is** the
extension.

## Running it locally

1. `chrome://extensions` → **Developer mode** → **Load unpacked** → select `src/`.
2. After editing a file, hit the reload icon on the extension card, then reload the
   FACEIT tab.

## Testing a change

Open a profile history, e.g. `https://www.faceit.com/en/players/donk666/cs2/history`, and
hover a match row. Test the overview too (`https://www.faceit.com/en/players/donk666`) —
it lists recent matches through the same row links, and it is the page that breaks first
when the path matching changes.

Worth hovering at least one match with no advanced stats (an unparsed demo) to confirm it
says so rather than failing silently.

## Releasing

1. Bump `version` in `src/manifest.json`.
2. Add a `CHANGELOG.md` section for the version.
3. Commit, then tag and push:

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

`.github/workflows/release.yml` packages `src/` plus `LICENSE`, `THIRD-PARTY.md` and
`README.md` into `faceit-crosshair-peek-v1.2.3.zip` and attaches it to a GitHub release.
That zip is also what gets uploaded to the Chrome Web Store.

The workflow hard-fails if the tag doesn't match the manifest version, so bump the
manifest first.

## Things that look wrong but aren't

- **`src/crosshairRenderer.js` is vendored** from
  [girlglock/cs2-crosshair](https://github.com/girlglock/cs2-crosshair) and is GPL-3.
  Don't refactor or restyle it. Its licence is why this project is GPL-3.
- **`pick()` reads two key casings** (`playerId`/`player_id`, `elo_delta`/`eloDelta`).
  The scoreboard endpoint genuinely returns both. Normalising to one silently breaks
  roughly half of all matches, and it fails as "unknown" names rather than an error.
- **The manifest matches all of `www.faceit.com/*`** on purpose. FACEIT is an SPA, so a
  narrower match pattern would never inject when you reach a profile by clicking through.
  The cost is bought back at runtime by the activation gate at the bottom of `content.js`.
- **Never select on FACEIT CSS classes** — they're hashed
  (`styles__MatchLink-sc-cf17d301-9`) and change every deploy. The only DOM contract is
  the `href` shape.
- **`parseCode()` fails open.** On a bad pattern or checksum it returns its own
  `defaultSettings` *by reference*, which render as a plausible green crosshair —
  i.e. someone else's. `parseShareCode()` guards this with an identity comparison; don't
  "improve" it into a deep equality check.

New source files need SPDX `GPL-3.0-or-later` headers matching `content.js`, and must be
added to `manifest.json` — nothing loads them otherwise. All injected DOM uses the `fcp-`
class prefix and is built with `document.createElement`, never `innerHTML`.
