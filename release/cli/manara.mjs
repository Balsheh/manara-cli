#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Worker} from 'node:worker_threads';
import {prepareReport, formatReport} from './reports.mjs';
import {renderBanner, terminalColors} from './banner.mjs';

const help = `Manara Cyber — original engine, local source-code review

Usage: manara scan <file-or-directory> [options]

  --format text|json|html|sarif   Output format (default: text)
  --output, -o <file>            Save a new report (never overwrite)
  --severity <levels>            Show comma-separated critical,high,medium,low
  --fail-on <level|none>         Exit 1 at this severity or higher (default: none)
  --exclude <path>               Exclude a path relative to the scan root; repeatable
  --lang en|ar|tr                Finding/report language (default: en)
  --timeout <milliseconds>       Whole scan deadline, 1000–120000 (default: 30000)
  --help, -h                    Show help
  --version, -v                 Show version

Exit codes: 0 completed; 1 severity threshold met; 2 error/incomplete scan.
Limits: 50 files, 250 KB per file, 2 MB total; same engine as the website.
No network calls, accounts, API keys or target-code execution.
`;
const ranks = {low:1, medium:2, high:3, critical:4};
export function parseOptions(args) {
  if (!args.length || args.includes('--help') || args.includes('-h')) return {help:true};
  if (args.length === 1 && ['--version', '-v'].includes(args[0])) return {version:true};
  if (args[0] !== 'scan') throw Error('Use: manara scan <file-or-directory> [options]');
  const options = {format:'text', lang:'en', failOn:'none', timeout:30000, exclude:[]};
  const flags = {'--format':'format', '--output':'output', '-o':'output', '--severity':'severity', '--fail-on':'failOn', '--exclude':'exclude', '--lang':'lang', '--timeout':'timeout'};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') {
      if (options.target || i !== args.length - 2) throw Error('Provide exactly one target path.');
      options.target = args[++i];
    } else if (arg.startsWith('-')) {
      const key = flags[arg], value = args[++i];
      if (!key || !value || value.startsWith('--')) throw Error('Unknown option or missing value. Use --help.');
      if (key === 'exclude') options.exclude.push(value);
      else options[key] = value;
    } else {
      if (options.target) throw Error('Provide exactly one target path.');
      options.target = arg;
    }
  }
  if (!options.target) throw Error('Provide a file or directory to scan.');
  if (!['text', 'json', 'html', 'sarif'].includes(options.format)) throw Error('Invalid report format.');
  if (!['en', 'ar', 'tr'].includes(options.lang)) throw Error('Invalid language.');
  if (options.failOn !== 'none' && !Object.hasOwn(ranks, options.failOn)) throw Error('Invalid failure threshold.');
  if (options.severity) {
    options.severity = [...new Set(options.severity.split(','))];
    if (options.severity.some(level => !Object.hasOwn(ranks, level))) throw Error('Invalid severity filter.');
  }
  if (!/^\d+$/.test(String(options.timeout)) || Number(options.timeout) < 1000 || Number(options.timeout) > 120000) throw Error('Timeout must be 1000–120000 milliseconds.');
  options.timeout = Number(options.timeout);
  options.target = path.resolve(options.target);
  if (options.output) {
    options.output = path.resolve(options.output);
    // lexists equivalent: reject existing paths, including dangling symlinks.
    try { fs.lstatSync(options.output); throw Error('Output already exists. Choose a new filename.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return options;
}

export function exitCode(report, threshold) {
  if (report.scanIntegrity !== 'complete') return 2;
  return threshold !== 'none' && report.findings.some(f => ranks[f.severity] >= ranks[threshold]) ? 1 : 0;
}

export function runScan(options) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.mjs', import.meta.url), {workerData:{target:options.target, options:{exclude:options.exclude, output:options.output}}});
    let settled = false;
    const finish = (error, report) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      error ? reject(error) : resolve(report);
    };
    const timer = setTimeout(() => finish(Error('Scan timed out; no complete report was produced.')), options.timeout);
    worker.once('message', result => result.error ? finish(Error(result.error)) : finish(null, result.report));
    worker.once('error', () => finish(Error('Scanner worker failed. Check installed parser assets.')));
    worker.once('exit', () => { if (!settled) finish(Error('Scanner stopped before completing.')); });
  });
}

export async function run(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) { process.stdout.write(renderBanner(process.stdout.columns, {color:terminalColors()}) + '\n' + help); return 0; }
  if (options.version) {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    process.stdout.write(`Manara Cyber ${pkg.version}\n`); return 0;
  }
  const raw = await runScan(options);
  const output = formatReport(prepareReport(raw, options), options.format, raw, {columns:options.output ? 80 : process.stdout.columns, color:!options.output && terminalColors()});
  if (options.output) {
    fs.writeFileSync(options.output, output, {flag:'wx', mode:0o600});
    process.stderr.write('Manara report saved.\n');
  } else process.stdout.write(output);
  return exitCode(raw, options.failOn);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().then(code => { process.exitCode = code; }).catch(error => {
    // OS errors may contain hostile path text; keep diagnostics source-free.
    const message = error.code ? 'Could not read the target or write the report. Check paths and permissions.' : error.message;
    process.stderr.write(`Manara: ${String(message).replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')}\n`);
    process.exitCode = 2;
  });
}
