# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-15

### Added

- Hover any match row in a FACEIT CS2 match history to preview all ten players'
  crosshairs, rendered to canvas with CS2's own pixel math.
- Click any share code in the popup to copy it to the clipboard.
- The viewed profile's own row is highlighted.
- Per-match-ID response caching for the life of the page.
- Graceful message for matches where FACEIT has no advanced stats.
- Support for both `playerId` and `player_id` key casings returned by the
  scoreboard endpoint.

[Unreleased]: https://github.com/OWNER/faceit-crosshair-peek/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/OWNER/faceit-crosshair-peek/releases/tag/v1.0.0
