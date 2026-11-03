import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root = process.cwd(), version = '1.9.8';
const base = path.join(root, 'downloads/manara-cli-1.9.7.tgz');
const sums = fs.readFileSync(path.join(root, 'downloads/SHA256SUMS'), 'utf8');
const expected = sums.split('\n').find(line => line.endsWith('  manara-cli-1.9.7.tgz'))?.split('  ')[0];
assert.equal(createHash('sha256').update(fs.readFileSync(base)).digest('hex'), expected);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'manara-color-'));
const extracted = path.join(temp, 'source');
fs.mkdirSync(extracted);
execFileSync('tar', ['-xzf', base, '-C', extracted]);
const pkg = path.join(extracted, 'package');
for (const name of ['banner.mjs', 'manara.mjs', 'reports.mjs']) {
  fs.copyFileSync(path.join(root, 'release/cli', name), path.join(pkg, 'cli', name));
}
fs.cpSync(path.join(root, 'release/cli/artwork'), path.join(pkg, 'cli/artwork'), {recursive:true});
const configPath = path.join(pkg, 'package.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.version = version;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
let readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8').replaceAll('1.9.7', version);
readme = readme.replace('sha256sum -c SHA256SUMS', 'sha256sum --ignore-missing -c SHA256SUMS');
readme = readme.replace(/## Terminal banner\n\n[\s\S]*?\n\n## Reports/, "## Terminal banner\n\nThe colored lighthouse is pre-rendered with Chafa at 44x13, 36x11 and 28x9 cells. The launcher selects a prepared size that fits with a spare column, without resizing text. MANARA and CYBER are printed separately as readable native text.\n\n![Terminal banner preview](https://raw.githubusercontent.com/Balsheh/manara-cli/main/docs/banner-preview.png)\n\nThe image uses single-cell Unicode blocks and foreground colors only in an interactive terminal. Empty areas show the terminal's own background or transparency, with no black rectangle. No image converter is installed or run on your computer. Non-interactive output, NO_COLOR and TERM=dumb use a readable ASCII fallback. Set MANARA_ASCII=1 to request the plain fallback explicitly. Exported JSON, SARIF, HTML and saved reports contain no color codes.\n\n## Reports");
fs.writeFileSync(path.join(pkg, 'README.md'), readme);
execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', path.join(root, 'downloads')], {cwd:pkg, stdio:'inherit'});
const archive = path.join(root, 'downloads', 'manara-cli-' + version + '.tgz');
const install = path.join(temp, 'installed');
execFileSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', install, archive], {stdio:'inherit'});
const installed = path.join(install, 'node_modules/manara-cli');
const {renderBanner, terminalColors} = await import(pathToFileURL(path.join(installed, 'cli/banner.mjs')));
const plain = renderBanner(80), color = renderBanner(80, {color:true});
const uncolored = color.replace(/\x1b\[[0-9;]*m/g, '');
assert.ok(uncolored.includes('M A N A R A'));
assert.ok(uncolored.includes('C Y B E R'));
assert.match(plain, /^[\x20-\x7e\n]+$/);
for (const columns of [5,12,28,29,36,37,44,45,80,240]) {
  const visible = renderBanner(columns, {color:true}).replace(/\x1b\[[0-9;]*m/g, '');
  assert.ok(visible.split('\n').every(line => [...line].length <= Math.max(1, columns - 1)));
  assert.ok(visible.trim().split('\n').length <= 20);
}
for (const size of [44,36,28]) {
  const asset = fs.readFileSync(path.join(installed, 'cli/artwork', size + '.ans'), 'utf8');
  assert.match(asset.replace(/\x1b\[[0-9;]*m/g, ''), /^[ \u2580-\u259f\n]+$/u);
  const codes = [...asset.matchAll(/\x1b\[([0-9;]*)m/g)].map(m => m[1]);
  assert.ok(codes.every(code => ['0','39','49'].includes(code) || /^38;2;\d+;\d+;\d+$/.test(code)), 'Background colors must not be painted');
}
assert.ok(color.includes('\x1b[38;2;245;65;90m'));
assert.ok(color.includes('\x1b[38;2;225;229;235m'));
assert.ok(plain.split('\n').every(line => line.length <= 44));
assert.ok(terminalColors({isTTY:true}, {TERM:'xterm-256color'}));
assert.equal(terminalColors({isTTY:false}, {}), false);
assert.equal(terminalColors({isTTY:true}, {NO_COLOR:''}), false);
assert.equal(terminalColors({isTTY:true}, {TERM:'dumb'}), false);
const target = path.join(temp, 'sample.js');
fs.writeFileSync(target, 'eval(req.query.code);\n');
const wrapper = path.join(temp, 'terminal.mjs');
fs.writeFileSync(wrapper, 'import {run} from ' + JSON.stringify(pathToFileURL(path.join(installed, 'cli/manara.mjs')).href) + ';\nObject.defineProperty(process.stdout,"isTTY",{value:true,configurable:true});\nObject.defineProperty(process.stdout,"columns",{value:120,configurable:true});\nprocess.exitCode=await run(process.argv.slice(2));\n');
const env = {...process.env, TERM:'xterm-256color'};
delete env.NO_COLOR;
const call = (args, extraEnv = {}) => execFileSync(process.execPath, [wrapper, ...args], {env:{...env, ...extraEnv}, encoding:'utf8'});
assert.ok(call(['--help']).includes('\x1b['));
assert.ok(!call(['--help'], {NO_COLOR:'1'}).includes('\x1b['));
const json = call(['scan', target, '--format', 'json']);
assert.ok(!json.includes('\x1b['));
const report = JSON.parse(json);
assert.equal(report.scanIntegrity, 'complete');
assert.ok(report.findings.some(f => f.id === 'MC004'));
const sarif = call(['scan', target, '--format', 'sarif']);
assert.ok(!sarif.includes('\x1b['));
assert.equal(JSON.parse(sarif).version, '2.1.0');
const saved = path.join(temp, 'report.txt');
call(['scan', target, '--output', saved]);
assert.ok(!fs.readFileSync(saved, 'utf8').includes('\x1b['));
const hashes = fs.readdirSync(path.join(root, 'downloads')).filter(name => name.endsWith('.tgz')).sort().map(name => createHash('sha256').update(fs.readFileSync(path.join(root, 'downloads', name))).digest('hex') + '  ' + name).join('\n') + '\n';
fs.writeFileSync(path.join(root, 'downloads/SHA256SUMS'), hashes);
fs.writeFileSync(path.join(root, 'README.md'), readme);
console.log('Installed package verified: colored TTY help, plain NO_COLOR output, JSON/SARIF parsing and source-free text export.');
fs.rmSync(temp, {recursive:true, force:true});


