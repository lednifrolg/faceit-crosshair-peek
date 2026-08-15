# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-15

First public release.

### Added

- Hover any match row on a FACEIT profile to preview all ten players' crosshairs,
  rendered to canvas with CS2's own pixel math rather than an approximation.
- Works on both the match history (`/players/{nickname}/cs2/history`) and the
  recent-matches list on the profile overview (`/players/{nickname}`).
- Click any share code in the popup to copy it to the clipboard.
- The viewed profile's own row is highlighted.
- Per-match-ID response caching for the life of the page, including negative caching
  for matches FACEIT never parsed, so hovering one repeatedly costs nothing.
- Share codes that fail to decode — wrong shape or a bad checksum — render as
  "invalid code" rather than silently falling back to the decoder's default crosshair,
  which would mean showing a crosshair that isn't the player's.
- Legacy dynamic crosshair styles (`cl_crosshairstyle` 0 and 1), which can't be drawn
  statically, render as "dynamic".
- Distinct messaging for transient failures ("couldn't load crosshairs — try again")
  versus matches that genuinely have no advanced stats.
- Extension icons at 16/32/48/128px.
- `README.md` and `THIRD-PARTY.md` ship inside the release zip, so attribution for the
  vendored renderer travels with the distributed extension.

### Notes

- Listeners are attached only while you are on a player profile and removed when you
  leave; SPA navigation is tracked with the Navigation API. Off a profile the extension
  holds no listeners, no injected DOM and no timers.
- No background service worker, no storage, no permissions block and no telemetry.

[1.0.0]: https://github.com/lednifrolg/faceit-crosshair-peek/releases/tag/v1.0.0
