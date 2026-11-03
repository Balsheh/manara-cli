import {localizedReport, sarifReport} from '../dist/report.js';
import {remediationFor} from '../dist/enhancements.js';
import {renderBanner} from './banner.mjs';

// Terminal output must not interpret controls from filenames or diagnostics.
export const terminalText = value => String(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, ' ');
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
export function prepareReport(report, {severity, lang = 'en'} = {}) {
  const safe = localizedReport(report, lang);
  const findings = severity ? safe.findings.filter(f => severity.includes(f.severity)) : safe.findings;
  return {...safe, totalFindings:safe.findings.length, findingFilter:severity || null, findings:findings.map(f => ({...f, remediation:remediationFor(f.id, lang)}))};
}

export function formatReport(report, format, rawReport, {columns = 80, color = false} = {}) {
  if (format === 'json') return JSON.stringify(report, null, 2) + '\n';
  if (format === 'sarif') {
    const selected = new Set(report.findings.map(f => JSON.stringify([f.id, f.file, f.line])));
    // SARIF needs the original flow locations; its shared exporter strips evidence.
    const source = rawReport || {...report, findings:report.findings.map(f => f.flow ? {...f, flow:{...f.flow, steps:(f.flow.stepLines || []).map(line => ({line}))}} : f)};
    const sarif = sarifReport({...source, findings:source.findings.filter(f => selected.has(JSON.stringify([f.id, f.file, f.line])))});
    sarif.runs[0].invocations[0].properties.inputReview = report.inputReview;
    sarif.runs[0].invocations[0].properties.findingFilter = report.findingFilter;
    sarif.runs[0].invocations[0].properties.totalFindings = report.totalFindings;
    return JSON.stringify(sarif, null, 2) + '\n';
  }
  if (format === 'html') return htmlReport(report);
  const lines = ['Manara Cyber · original engine · local scan', `Integrity: ${report.scanIntegrity} | Files: ${report.files.length} | Lines: ${report.lines} | Rules: ${report.rules}`, `Findings shown: ${report.findings.length}/${report.totalFindings}`, ''];
  for (const f of report.findings) lines.push(`[${f.severity.toUpperCase()}] ${f.id} ${f.file}:${f.line}`, `  ${f.title}`, `  ${f.explanation}`, `  Guidance: ${f.remediation.action}`, `  Validate: ${f.remediation.test}`, '');
  if (!report.findings.length) lines.push('No matching findings in this view. This does not establish that the code is secure.', '');
  for (const diagnostic of report.diagnostics) lines.push(`Diagnostic: ${diagnostic.code}${diagnostic.file ? ' · ' + diagnostic.file : ''}`);
  for (const item of report.inputReview.skipped) lines.push(`Skipped: ${item.file} (${item.reason})`);
  for (const item of report.inputReview.excluded) lines.push(`Excluded: ${item.file} (${item.reason})`);
  lines.push('', ...report.notes, '', report.limitations);
  return renderBanner(columns, {color}) + '\n' + lines.map(terminalText).join('\n') + '\n';
}

function htmlReport(r) {
  const findings = r.findings.map(f => `<article><p class="severity">${html(f.severityLabel)} · ${html(f.id)} · CWE-${html(f.cwe)}</p><h2>${html(f.title)}</h2><p class="location">${html(f.file)}:${html(f.line)}</p><p>${html(f.explanation)}</p><h3>Guidance</h3><p>${html(f.remediation.action)}</p><h3>Validation</h3><p>${html(f.remediation.test)}</p></article>`).join('');
  const list = items => items.map(item => `<li>${html(item)}</li>`).join('');
  return `<!doctype html>
<html lang="${html(r.language)}" dir="${r.language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Manara Cyber · Local security review</title><style>
body{margin:0;background:#10141c;color:#e8edf5;font:16px/1.65 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:40px 24px}header{border-bottom:2px solid #ed5159;padding-bottom:24px}h1{font-size:36px;margin:0}h1 span,.severity{color:#ff7d84}h2{font-size:21px}h3{font-size:16px;margin-bottom:0}article,section{background:#1a202c;border:1px solid #333e50;border-radius:12px;padding:24px;margin:24px 0;overflow-wrap:anywhere}.location,small{color:#b5c2d5}li{margin:8px 0}p{white-space:pre-wrap}.status{font-weight:bold}footer{color:#b5c2d5}@media print{body{background:white;color:black}article,section{background:white;color:black;break-inside:avoid}}
</style></head><body><main><header><h1>Manara <span>Cyber</span></h1><p>Original engine · Local security review</p><p class="status">Integrity: ${html(r.scanIntegrity)} · ${r.files.length} files · ${r.lines} lines · ${r.rules} rules</p><p>Findings shown: ${r.findings.length}/${r.totalFindings}</p><small>${html(r.createdAt)}</small></header>
${findings || '<section>No matching findings in this view. This does not establish that the code is secure.</section>'}
<section><h2>Scope and coverage</h2><ul>${list(r.coverage.map(c => `${c.file}: ${c.analysis}${c.reason ? ' (' + c.reason + ')' : ''}`))}</ul><h3>Skipped paths</h3><ul>${list(r.inputReview.skipped.map(s => `${s.file}: ${s.reason}`))}</ul><h3>Excluded paths</h3><ul>${list(r.inputReview.excluded.map(s => `${s.file}: ${s.reason}`))}</ul><h3>Diagnostics</h3><ul>${list(r.diagnostics.map(d => `${d.code}${d.file ? ': ' + d.file : ''}`))}</ul></section>
<section><h2>Manual review</h2><ul>${list(r.manualChecks.map(([title, body]) => `${title}: ${body}`))}</ul></section><footer><p>${html(r.limitations)}</p>${r.notes.map(n => `<p>${html(n)}</p>`).join('')}<p>Source evidence is omitted from this report. Findings require human review.</p></footer></main></body></html>\n`;
}
