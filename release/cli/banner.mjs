import fs from 'node:fs';

const palette = ' .:-=+*#%@';
// Preserve the supplied file. Normalize a flat converter background only for display.
const supplied = fs.readFileSync(new URL('./banner.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sourceRows = supplied.split('\n');
const border = /^(.)\1{20,}$/.exec(sourceRows.find(row => row.trim())?.trim() || '');
const background = Math.max(0, palette.indexOf(border?.[1] || ' '));
const rows = background > 0 && background < palette.length - 1
  ? sourceRows.map(row => [...row].map(char => {
    const value = palette.indexOf(char);
    return value < 0 ? char : palette[Math.round(Math.max(0, value - background) / (palette.length - 1 - background) * (palette.length - 1))];
  }).join(''))
  : sourceRows;
while (rows.length && !rows[0].trim()) rows.shift();
while (rows.length && !rows.at(-1).trim()) rows.pop();
const indent = Math.min(...rows.filter(row => row.trim()).map(row => row.length - row.trimStart().length));
for (let i = 0; i < rows.length; i++) rows[i] = rows[i].slice(indent).trimEnd();
const original = rows.join('\n');
const width = Math.max(...rows.map(row => row.length));

export function terminalColors(stream = process.stdout, env = process.env) {
  return Boolean(stream?.isTTY) && !Object.hasOwn(env, 'NO_COLOR') && env.TERM !== 'dumb';
}

function accentAt(x, y) {
  const nx = x / width, ny = y / rows.length;
  return (ny < 0.32 && (nx < 0.41 || nx > 0.585))
    || (ny >= 0.129 && ny <= 0.215 && nx >= 0.44 && nx <= 0.56)
    || ny > 0.95;
}

function paintLine(line, accents) {
  let result = '', previous = '';
  for (let i = 0; i < line.length; i++) {
    const color = accents[i] ? '\x1b[38;2;245;65;90m' : '\x1b[38;2;225;229;235m';
    if (line[i] !== ' ' && color !== previous) { result += color; previous = color; }
    result += line[i];
  }
  return previous ? result + '\x1b[0m' : result;
}

export function renderBanner(columns = 80, {color = false} = {}) {
  // Keep startup branding compact even in maximized or ultrawide terminals.
  const available = Math.min(44, Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : 44);
  if (available >= width) return '\n' + original + '\n';
  const scale = available / width;
  const height = Math.max(1, Math.round(rows.length * scale));
  const output = [];
  // Average source-cell coverage to preserve the logo's proportions and shaded edges.
  for (let y = 0; y < height; y++) {
    let line = ''; const accents = [];
    const top = y * rows.length / height, bottom = (y + 1) * rows.length / height;
    for (let x = 0; x < available; x++) {
      const left = x * width / available, right = (x + 1) * width / available;
      let sum = 0, area = 0, red = 0;
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) {
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
          const weight = (Math.min(right, sx + 1) - Math.max(left, sx)) * (Math.min(bottom, sy + 1) - Math.max(top, sy));
          const value = Math.max(0, palette.indexOf(rows[sy]?.[sx] || ' '));
          sum += value * weight;
          if (accentAt(sx, sy)) red += value * weight;
          area += weight;
        }
      }
      line += palette[Math.round(sum / area)];
      accents.push(sum > 0 && red >= sum * 0.4);
    }
    line = line.trimEnd();
    output.push(color ? paintLine(line, accents) : line);
  }
  return '\n' + output.join('\n') + '\n';
}
