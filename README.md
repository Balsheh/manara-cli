# Manara CLI for Linux

Local source-code security review powered by the original Manara Cyber engine.
Requires **Node.js 22 or later**. No GitHub account, API key, Docker or cloud backend is needed to run a scan. Source code stays on your computer.

## Download and install

[Download Manara CLI 1.9.6](https://raw.githubusercontent.com/Balsheh/manara-cli/main/downloads/manara-cli-1.9.6.tgz) — public download, no GitHub account required.

[SHA-256 checksums](https://raw.githubusercontent.com/Balsheh/manara-cli/main/downloads/SHA256SUMS)

```bash
curl -fL https://raw.githubusercontent.com/Balsheh/manara-cli/main/downloads/manara-cli-1.9.6.tgz -o manara-cli-1.9.6.tgz
curl -fL https://raw.githubusercontent.com/Balsheh/manara-cli/main/downloads/SHA256SUMS -o SHA256SUMS
sha256sum --ignore-missing -c SHA256SUMS
npm install --global --offline --no-audit --no-fund ./manara-cli-1.9.6.tgz
manara --help
manara scan /path/to/project
```

If global npm installation is unavailable, extract and run the bundled tool directly:

```bash
mkdir manara-cli
tar -xzf manara-cli-1.9.6.tgz -C manara-cli --strip-components=1
node manara-cli/cli/manara.mjs scan /path/to/project
```

The archive includes all parser assets. Installation from the downloaded archive and scanning require no network access, provided Node.js/npm are already installed.

## Terminal banner

The supplied Manara lighthouse artwork appears when you run `manara`, `manara --help`, or a text scan. It is compact by default: at most 44 columns wide and approximately 19 lines tall, shrinking further in narrower terminals. The original artwork is bundled in `cli/banner.txt`. Flat converter backgrounds are removed only for terminal display. Terminal colors follow the supplied reference: red beams, eye and CYBER lettering, with a white lighthouse and MANARA lettering. Colors are enabled only in an interactive terminal and respect NO_COLOR and TERM=dumb. Redirected output and exported reports contain no ANSI color codes. JSON, SARIF and HTML outputs remain free of the banner.

## Reports

```bash
manara scan ./my-project --format html --output report.html
manara scan ./my-project --format json --output report.json
manara scan ./my-project --format sarif --output report.sarif
manara scan ./my-project --lang ar --format html --output report-ar.html
manara scan ./my-project --severity high,critical --fail-on high
manara scan ./my-project --exclude generated --exclude fixtures
```

Finding content supports English, Arabic and Turkish (`--lang en|ar|tr`). CLI help and status labels are English. Saved reports omit source evidence and do not overwrite existing files.

## Scope

This release scans up to **50 files**, **250,000 bytes per file**, **2,000,000 bytes total**, with up to 500 findings. JavaScript/TypeScript, Python and PHP use bundled Tree-sitter parsers and the existing bounded analysis. Other supported files retain heuristic coverage. Skipped paths and incomplete coverage are explicit.

The engine reads code as data and never runs it. Findings require human review; no findings does not prove code is secure. `--severity` filters the displayed findings; `--fail-on` evaluates all findings.

Exit codes: `0` completed, `1` severity threshold reached, `2` error/incomplete scan. Default deadline: 30 seconds (`--timeout 1000` to `--timeout 120000`). Use `--help` for all options.

The public download contains the CLI and local engine only. The hosted service's backend, credentials and private repository history are not included. Third-party components retain their own bundled licenses.
