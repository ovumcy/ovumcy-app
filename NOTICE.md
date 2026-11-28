# Third-Party Notices

This file records attribution required by the licenses of third-party material
that Ovumcy App depends on. It is separate from the project's own license (see
[LICENSE](LICENSE)).

## caniuse-lite (browser support data)

Ovumcy App's web build resolves browser targets through Browserslist, which
consumes the `caniuse-lite` dataset.

- Package: `caniuse-lite`
- Data source: caniuse.com (https://caniuse.com/)
- License: Creative Commons Attribution 4.0 International (CC-BY-4.0)
  — https://creativecommons.org/licenses/by/4.0/

The support data is © the caniuse.com contributors and is used under CC-BY-4.0.
This project does not modify the dataset; it is redistributed as an unmodified
transitive dependency.

## DejaVu Sans Condensed (doctor PDF font)

The doctor PDF export embeds a subset of DejaVu Sans Condensed (regular and
bold), bundled as `assets/fonts/DejaVuSansCondensed.ttf` and
`assets/fonts/DejaVuSansCondensed-Bold.ttf`.

- Project: DejaVu Fonts (https://dejavu-fonts.github.io/)
- Copyright: © 2003 Bitstream, Inc. (Bitstream Vera); © 2006 Tavmjong Bah
  (glyphs imported from Arev); DejaVu changes are in the public domain.
  Bitstream Vera is a trademark of Bitstream, Inc.
- License: Bitstream Vera Fonts license and Arev Fonts license — full text in
  [assets/fonts/LICENSE-DejaVu.txt](assets/fonts/LICENSE-DejaVu.txt). The
  upstream license's third section covers TeX Gyre DJV Math, which this app
  does not ship, and is omitted.

The fonts are unmodified and keep their DejaVu names. The app shows the same
notice on its About screen.
