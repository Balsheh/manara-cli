import fs from 'node:fs';

// Generated once with Chafa at each target size. Never resample terminal glyphs.
const sizes = [44, 36, 28];
const pictures = new Map(sizes.map(width => [width,
  fs.readFileSync(new URL(`./artwork/${width}.ans`, import.meta.url), 'utf8').trimEnd()
]));
const reset = '\x1b[0m';
const white = '\x1b[38;2;225;229;235m';
const red = '\x1b[38;2;245;65;90m';

export function terminalColors(stream = process.stdout, env = process.env) {
  return Boolean(stream?.isTTY) && !Object.hasOwn(env, 'NO_COLOR') && env.TERM !== 'dumb';
}

const center = (text, width) => ' '.repeat(Math.max(0, Math.floor((width - text.length) / 2))) + text;
function asciiBanner(width) {
  const mark = ['      /\\', '     /__\\', '    |<o>|', '    |___|', '     | |', '    /| |\\', '   /_|_|_\\'];
  const lines = width >= 13 ? [...mark, '', 'MANARA CYBER'] : ['MANARA'.slice(0, width), 'CYBER'.slice(0, width)];
  return '\n' + lines.map(line => center(line, width)).join('\n') + '\n';
}

export function renderBanner(columns = 80, {color = false, ascii = false} = {}) {
  // Leave the final column free so the terminal cannot wrap a full-width row.
  const available = Math.max(1, Math.min(44, Number.isFinite(columns) ? Math.floor(columns) - 1 : 44));
  const width = sizes.find(size => size <= available);
  if (!color || ascii || Object.hasOwn(process.env, 'MANARA_ASCII') || !width) return asciiBanner(available);
  return '\n' + pictures.get(width) + reset + '\n\n'
    + white + center('M A N A R A', width) + reset + '\n'
    + red + center('C Y B E R', width) + reset + '\n';
}
