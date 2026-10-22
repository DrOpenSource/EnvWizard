# EnvWizard v0.1.1: Field Review & v0.2 Plan

*Reviewed 2026-10-22 after ~300 installs and mixed user reviews. Every "broken" item below was reproduced on a real machine (Windows 11, VS Code 1.120) or with a failing test before it was fixed.*

---

## TL;DR

v0.1.1 looked finished on paper (every roadmap box ticked, 13 green tests), but in practice:

1. **The sidebar icon was a blank square.** VS Code draws Activity Bar icons as a single-color *mask*, and `icon.svg` is a fully opaque filled squircle, so only a solid square showed.
2. **The Dev Deck panel was completely dead.** One unescaped quote (`onclick="send('healEnv')"` inside a single-quoted string) was a JavaScript syntax error, so none of the panel's script ran. No button worked, and the panel sat on "Scanning workspace environment…" forever. For most users this *was* the product.
3. **Pro sells features that don't exist.** The README and Gumroad page promise a background auto-unjam daemon, a file-save watcher, a port auto-router and a `.env` vault. None of them are implemented, and `isPro` gates nothing.
4. **Anyone could get Pro for free.** Any made-up `XXXX-XXXX-XXXX-XXXX` or UUID key activated (Gumroad answers 404 for unknown keys and the code treated 404 as success), and the offline key generator shipped inside the public bundle. The test suite *asserted* this bypass.

Items 1, 2 and 4, plus about fifteen other bugs, are fixed in **0.1.2** (see the [CHANGELOG](../CHANGELOG.md)). Item 3 is a business decision (see "Decisions needed" below).

---

## What was broken, and its status in 0.1.2

| # | Problem | How it was verified | 0.1.2 |
|---|---------|---------------------|-------|
| 1 | Activity Bar icon renders as a blank square | Rendered `icon.svg` as a mask: solid square | ✅ New monochrome `assets/activity-icon.svg`, confirmed in a real VS Code window |
| 2 | Dev Deck script syntax error: every button dead | Rendered the shipped HTML, `vm.Script` → `Unexpected identifier 'healEnv'` | ✅ Rewritten with CSP + nonce, no inline handlers, regression test parses the script |
| 3 | "Freed port 8000" while an auto-restarter (nodemon / `--reload`) had already re-bound it | Real supervisor process: reported success, port still busy | ✅ Success = port actually free; explains the auto-restarter |
| 4 | Safety Shield refusal threw an uncaught error ("command failed"), and aborted Clean Slate midway | Simulated protected holder | ✅ Friendly message; Clean Slate skips and continues |
| 5 | Clean Slate would kill Postgres / Redis / Mongo on 5432 / 6379 / 27017 | Protected-list check | ✅ Databases are never stopped by Clean Slate |
| 6 | Docker Desktop (`com.docker.backend`, `vpnkit`), WSL (`wslrelay`) and macOS IDE helpers (`Code Helper`) were not protected, so killing them breaks Docker/WSL/VS Code | Protected-list check; macOS `ps` returns full paths, which never matched | ✅ Added, with name normalization and prefixes |
| 7 | Process name could become `"INFO: No tasks are running…"` (tasklist fallback parsed its error text) | Observed during a race in the real run | ✅ Fixed |
| 8 | "Project folder" (`cwd`) was actually the node.exe path | Real inspection output | ✅ Removed the wrong data; real cwd on macOS/Linux, command summary everywhere |
| 9 | Same port listed twice for IPv4 + IPv6 servers | Parser fixture | ✅ De-duplicated |
| 10 | No `lsof` → silent "All Clear" | Code path | ✅ "Radar Offline" + `ss` fallback on Linux |
| 11 | Dev Deck "⚡ Free" killed instantly with no confirmation | Code path (PRD requires a preview card) | ✅ Confirmation names the program and its command |
| 12 | `.env.local` ignored → false "missing" alarms for Next.js/Vite users | Realistic project simulation | ✅ Reads `.env`, `.env.local`, `.env.development(.local)` |
| 13 | `PORT`, `NODE_ENV`, venv `site-packages` vars flagged as missing secrets | Simulation | ✅ Runtime keys ignored, virtualenvs skipped (any name, via `pyvenv.cfg`) |
| 14 | Missed `const { KEY } = process.env`, `os.getenv("K", default)`, monorepo files deeper than 4 levels | Simulation | ✅ Detected; depth 8 with file-count and size caps |
| 15 | "Heal" wrote blank `KEY=` lines and then said "in sync" | Simulation | ✅ Blank values flagged as "needs a value"; the file opens at the new lines |
| 16 | No warning when `.env` isn't gitignored (secret-leak risk) | Simulation | ✅ Warning + 1-click `.gitignore` fix |
| 17 | Multiline values, escaped quotes and inline `# comments` mis-parsed; mixed line endings after append | Parser tests | ✅ Fixed; existing bytes never change |
| 18 | License bypass (see TL;DR #4) | Real activation call with a made-up key → Pro | ✅ Gumroad must confirm the key; refunds are rejected; offline shows a clear message |
| 19 | `PRIVACY.md` said the license key is validated offline and never transmitted | Code reads `api.gumroad.com` | ✅ Corrected |
| 20 | VSIX shipped `AGENTS.md`, `index.html` and Gumroad marketing images | Unzipped the VSIX | ✅ Excluded |

**Tests:** 13 → 35, including real spawned servers (plain, child-held, auto-respawning), a dual-stack socket test, and a Dev Deck render test. An end-to-end run in an isolated VS Code 1.120 confirmed activation (191 ms), all commands, the icon, and the live Dev Deck.

---

## Still open (not fixed in 0.1.2)

- **Windows "graceful" shutdown never happens.** `taskkill` without `/F` can't close console apps, so every Windows unjam is a force-kill after an ~800 ms wait. A real polite stop needs `GenerateConsoleCtrlEvent` (native code) or sending Ctrl+C to the owning VS Code terminal.
- ~~The `npm run dev` wrapper survives.~~ **Correction:** a re-test with a real `npm run dev` showed npm exits by itself once its server is stopped. The earlier finding came from an artificial parent process in the simulation. Not a bug.
- **Windows can't show which project a server belongs to.** There is no cwd without native code; the command line is the best available signal.
- **Multi-root workspaces.** Only one folder is audited (the active editor's). *Monorepo packages are fixed in 0.1.2:* `apps/web/.env.local` is read and scoped to that package.
- ~~`.gitignore` fix doesn't untrack files.~~ Fixed in 0.1.2: committed env files are detected, with a 1-click `git rm --cached` that keeps the file on disk.
- **macOS and Linux run only in CI.** A GitHub Actions matrix (Windows / macOS / Ubuntu) now runs the full suite, including the real-process tests, on every push. Nobody has used it hands-on on a Mac or Linux machine yet.
- **The 3-machine limit isn't enforced**, and `increment_uses_count` bumps on every activation, including reinstalls on the same machine.
- **The roadmap overclaimed.** AST scanning, a debounced save watcher, process-tree discovery, uptime/memory, status-bar/webview tests and "< 40 ms activation" were ticked but never existed. Activation is ~190 ms (fine, but not what the roadmap says).
- ~~`icon.png` is 420 KB.~~ Resized 1024→256 px (95 KB) in 0.1.2.

---

## Decisions needed

**Pro currently delivers nothing beyond a badge, while the listing advertises four features.** Choose one:

- **A. (Recommended) Pause sales until v0.2 ships real Pro features**, change the listing to "coming soon", and refund or honour existing buyers.
- **B. Keep selling as an "early supporter" license** and rewrite the listing to say exactly that: what exists today and what's coming.

Either way, the README section "$9.99 Pro tier unlocks automatic background daemon…" and the Gumroad copy should not stay as they are. 0.1.2 deliberately leaves that text untouched until you decide.

---

## v0.2 plan: what to add

Ordered by impact for vibe coders. **Free** respects the "manual 1-click stays free" rule; **Pro** is the zero-click / power layer.

1. **Port-jam detector in the terminal (Free).** Use VS Code shell integration (`onDidEndTerminalShellExecution` + output stream) to spot `EADDRINUSE` the moment `npm run dev` fails, then show a toast: *"Port 3000 is jammed by an old server. [Free it & rerun]"*. This is the moment users need EnvWizard; today they have to know to open the panel.
2. **Zero-click auto-unjam (Pro).** The same detector, but it frees the port and re-runs the command automatically. It only touches processes started from this workspace, never databases or protected programs. This is the promised "background daemon", done safely.
3. **Project-aware Clean Slate (Free).** Only stop servers whose cwd or command line points inside the open workspace, and list everything else as "other projects", instead of everything on the watched ports.
4. **Live env watcher (Pro).** When a saved file (often AI-written) introduces a new `process.env.X`, show a quiet badge on the Dev Deck plus a 1-click add. This was promised as the "AST file-save watcher".
5. **`.env` safety snapshots (Pro).** Keep a local, timestamped copy before EnvWizard edits a `.env`, with 1-click restore. This was promised as ".env vault".
6. **`.env.example` generator (Free).** Create or refresh `.env.example` from `.env` with values stripped, so sharing a project never leaks keys.
7. **Value sanity checks (Free).** Flag obvious mistakes: trailing spaces, surrounding quotes copied twice, `OPENAI_API_KEY` not starting with `sk-`, invalid URLs.
8. **Monorepo support.** Audit each package with its own env files, and support multi-root workspaces.
9. **Cross-platform CI**, plus a tiny `vscode` integration test (the harness used for this review) run on every release.
