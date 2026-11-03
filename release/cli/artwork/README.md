# Terminal artwork

These fixed ANSI/Unicode assets were generated with Chafa (chafa-wasm 0.3.3)
from the supplied Manara lighthouse silhouette. Font width/height is 1/2;
the output uses single-cell block symbols, truecolor and no dithering.

Prepared sizes: 44x13, 36x11 and 28x9 character cells. The launcher chooses a
size that fits with a spare terminal column. It never rescales these glyphs.
MANARA and CYBER are written separately as native text for legibility.

Only SGR color sequences are included. There are no cursor movements, image
protocols or runtime image converters. Non-interactive output, NO_COLOR and
MANARA_ASCII use a plain ASCII fallback. The original uploaded artwork remains
in ../banner.txt for reference. Chafa itself is not included in the package.

Rendering references: https://hpjansson.org/chafa/ and
https://hpjansson.org/chafa/man/ (symbols, font-ratio and size).
