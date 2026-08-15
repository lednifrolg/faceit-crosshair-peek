# Third-party code

## src/crosshairRenderer.js

- **Source:** https://github.com/girlglock/cs2-crosshair (`public/static/crosshairRenderer.js`)
- **License:** GPL-3.0
- **Modifications:** none — vendored verbatim.

This file decodes CS2 crosshair share codes and renders them to a canvas using the
game's own pixel math. It is GPL-3, which is why this project is GPL-3: linking it
into the extension makes the whole extension a derivative work.

If you ever want to relicense this project under something more permissive, this file
is the only thing standing in the way. Replacing it means reimplementing both the
share-code decoder and the geometry in `computeCrosshairGeometry` from the published
CS2 console variable semantics, then pixel-diffing the output against the current
build across a spread of real codes (varying `cl_crosshairstyle`, `cl_crosshair_t`,
outline on/off, and negative `cl_crosshairgap`). Note that
[akiver/csgo-sharecode](https://github.com/akiver/csgo-sharecode) is MIT and would
cover the decoding half; only the rendering would need to be written fresh.

The full GPL-3 text is in [LICENSE](LICENSE) and covers both this file and the rest
of the project.
