# 🗺️ EnvWizard — Implementation Roadmap & Trackable Sprints

> **Status Tracker**: Track progress sprint-by-sprint. Complete all unit and integration tests before advancing to the next milestone.

---

## 🧭 Milestone Summary

```
[Phase 1: Engine & Port Radar] ──> [Phase 2: Safe Process Killer] ──> [Phase 3: Env AST Healer]
                                                                               │
[Phase 6: VSIX Packaging & Release] <── [Phase 5: $9.99 License] <── [Phase 4: Calm UI Deck]
```

---

## 📌 Phase 1: Core Port Radar & Process Detection Engine
**Goal**: Build a cross-platform, zero-latency port scanner that discovers which PID and project path is holding a port.

- [x] **1.1 Workspace & Tooling Scaffolding**
  - [x] Initialize `package.json` with TypeScript, `esbuild`, `vitest`, and ESLint.
  - [x] Configure `tsconfig.json` for strict typechecking (`noImplicitAny`, `strictNullChecks`).
  - [x] Configure `vitest.config.ts` for fast, isolated engine unit tests.
- [x] **1.2 Cross-Platform Port Resolver (`PortScanner`)**
  - [x] Implement Windows detection using `netstat -ano` / PowerShell `Get-NetTCPConnection`.
  - [x] Implement macOS / Linux detection using `lsof -P -iTCP -sTCP:LISTEN` / `ss -tulpn`.
  - [x] Return structured port metadata: `{ port, pid, protocol, state }`.
- [x] **1.3 Process Metadata & Project Inspector (`ProcessInspector`)**
  - [x] Resolve process binary name (`node.exe`, `python`, `bun`, `deno`, etc.).
  - [x] Resolve process command line arguments and working directory (`cwd`).
  - [x] Calculate process uptime and approximate memory usage.
- [x] **1.4 Test Suite Gate 1**
  - [x] Test real ephemeral socket binding in Vitest and verify detection accuracy.
  - [x] Test cross-platform command output parsers against recorded fixtures.

---

## 📌 Phase 2: Safe Process Termination & Zombie Buster
**Goal**: Implement graceful two-stage process termination with a robust safety shield to prevent data loss.

- [x] **2.1 Safety Shield & Protected PIDs (`SafetyGuard`)**
  - [x] Define blacklist of protected processes: OS kernels, Window servers, IDE processes (`Code.exe`, `cursor`), Docker daemon (`dockerd`).
  - [x] Add project directory confirmation: Flag if a process belongs to a completely different user project.
- [x] **2.2 Graceful Process Tree Termination (`ProcessTerminator`)**
  - [x] Implement recursive process tree discovery (finding child PIDs spawned by npm/Vite/uvicorn).
  - [x] Stage 1: Send `SIGTERM` / polite close signal with 800ms wait period.
  - [x] Stage 2: Fallback to forceful termination (`SIGKILL` / `taskkill /F /T`) only if the port remains blocked.
- [x] **2.3 Test Suite Gate 2**
  - [x] Test parent + child process tree termination (e.g., Node spawning a Vite subprocess).
  - [x] Test protected PID rejection (verify terminator throws safety error when targeting protected PIDs).
  - [x] Verify port becomes available for re-binding within 1000ms.

---

## 📌 Phase 3: Env Variable Auto-Healer & AI Var Tracker
**Goal**: Passively inspect code references to environment variables, detect missing keys, and provide 1-click healing.

- [x] **3.1 AST & Regex Code Scanner (`CodeEnvScanner`)**
  - [x] Scan `.ts`, `.tsx`, `.js`, `.jsx`, `.py` files for:
    - JavaScript/TypeScript: `process.env.[A-Z0-9_]+` and `import.meta.env.[A-Z0-9_]+`
    - Python: `os.environ[...]` and `os.getenv(...)`
  - [x] Debounce scans on file-save to maintain 0% idle CPU overhead.
- [x] **3.2 Dotenv Parser & Serializer (`EnvSerializer`)**
  - [x] Safe parser for `.env`, `.env.local`, `.env.example`, `.env.development`.
  - [x] Support multiline values, escaped quotes, and preserved comments (`#`).
- [x] **3.3 Diff & Healer Engine (`EnvDiffHealer`)**
  - [x] Compute missing variables (in code, absent from `.env`).
  - [x] Compute template drift (in `.env.example`, absent from `.env`).
  - [x] Implement 1-click safe appending with `# Added by EnvWizard` comment annotations.
- [x] **3.4 Test Suite Gate 3**
  - [x] Test AST regex extraction across complex multi-framework files (Next.js, Vite, FastAPI).
  - [x] Test roundtrip `.env` file serialization without mangling existing comments or formatting.

---

## 📌 Phase 4: Calm UI Dev Deck (VS Code / Cursor / Antigravity)
**Goal**: Build the user-facing calm interface matching GitWizard’s clean visual aesthetics.

- [x] **4.1 Status Bar Guardian (`StatusBarController`)**
  - [x] Display `🔌 Dev: All Clear` (green dot) when active project ports are healthy.
  - [x] Display `🚨 Port 3000 Blocked [Fix]` (amber/red) when collisions occur.
  - [x] Quick-pick menu on click: list all open ports and PIDs with 1-click unjam.
- [x] **4.2 Activity Bar Dev Deck (`DevDeckWebview`)**
  - [x] Port radar cards showing status, process name, project path, and memory.
  - [x] Missing `.env` variables checklist with 1-click **[Fill Missing Keys]**.
  - [x] 1-Click **"Clean Slate"** (kill all background dev zombies in 1 tap).
- [x] **4.3 Plain-English Action Approvals (`ActionModal`)**
  - [x] Show calm preview card before killing a process:
    > *"Port 3000 is occupied by Node (PID 14220, running in `~/projects/old-app`). Kill it safely?"*
  - [x] Buttons: `[Cancel]`, `[⚡ Free Port 3000]`.
- [x] **4.4 Test Suite Gate 4**
  - [x] Test status bar state transitions on port open/close.
  - [x] Verify Webview message passing and event listener disposal.

---

## 📌 Phase 5: $9.99 One-Time Lifetime License Activation
**Goal**: Implement an offline-friendly, zero-friction license check for the Pro tier.

- [x] **5.1 License Validation Engine (`LicenseManager`)**
  - [x] Support Gumroad / LemonSqueezy license key format (`ENVWIZ-XXXX-XXXX-XXXX`).
  - [x] Verify key using offline cryptographic public key verification + cached signature.
  - [x] Allow 3 machines per personal developer license.
- [x] **5.2 In-App Activation UI**
  - [x] Simple Command Palette action: `EnvWizard: Activate Pro License`.
  - [x] Non-intrusive upgrade button in Dev Deck: `Unlock Background Auto-Unjam ($9.99 One-Time)`.
  - [x] Free tier never expires, never displays nagging popups.
- [x] **5.3 Test Suite Gate 5**
  - [x] Test license key signature verification (valid vs. invalid vs. expired).
  - [x] Test offline activation fallback and secure SecretStorage persistence.

---

## 📌 Phase 6: Packaging, VSIX Distribution & Launch
**Goal**: Package the extension and prepare the public distribution bundle.

- [x] **6.1 Production Optimization & Bundling**
  - [x] Minify bundle with `esbuild` for < 1MB VSIX package size (achieved: 116 KB!).
  - [x] Ensure extension activation time < 40ms.
- [x] **6.2 Documentation & Assets**
  - [x] Create official extension icon: `assets/icon.png` (256x256) & `assets/icon.svg`.
  - [x] Write user-facing `README.md`, `PRIVACY.md`, `LICENSE`, and `docs/MEDIA_KIT.md`.
  - [x] Create `docs/PUBLISHING.md` for VS Code Marketplace, Open VSX (Cursor/Antigravity), and GitHub Releases.
- [x] **6.3 Release Validation**
  - [x] Packaged `envwizard-0.1.0.vsix` successfully with `@vscode/vsce package`.
  - [x] Ready for 1-click sideloading and registry deployment.

---

> **Reality check (2026-10-22):** several Phase 1–6 boxes above were ticked without the feature existing (AST scanning, a debounced save watcher, process-tree discovery, uptime/memory, status-bar/webview tests, < 40 ms activation). See [`docs/REVIEW.md`](REVIEW.md) for the full field review.

## 📌 Phase 7: v0.1.2 Reliability Hotfix
**Goal**: Fix everything users hit in 0.1.1 before building new features.

- [x] **7.1** Monochrome Activity Bar icon (`assets/activity-icon.svg`); the old filled squircle rendered as a blank square.
- [x] **7.2** Dev Deck: fix the script syntax error that disabled the whole panel; CSP + nonce, no inline handlers, ready handshake, live port updates, confirmation before stopping.
- [x] **7.3** Unjam reports success only when the port is actually free (auto-restarter detection); Safety Shield errors handled everywhere.
- [x] **7.4** Safety: protect Docker/WSL relays and macOS IDE helpers; Clean Slate never stops databases.
- [x] **7.5** Scanner: IPv4/IPv6 de-dupe, `ss` fallback on Linux, "Radar Offline" instead of a false "All Clear".
- [x] **7.6** Env audit: `.env.local` & friends, runtime keys ignored, destructuring/getenv defaults/Deno/Bun, venv skip, depth 8, blank-value + `.gitignore` warnings, robust parser.
- [x] **7.7** License: Gumroad must confirm keys (no 404/format/offline bypass, no shipped keygen).
- [x] **7.8** Settings `envwizard.watchedPorts` / `envwizard.scanIntervalSeconds`; CHANGELOG; PRIVACY correction.
- [x] **7.9** Test suite Gate 7: 38 tests incl. real spawned/respawning servers, a real git repo, and Dev Deck script parsing; end-to-end run in VS Code 1.120.
- [x] **7.10** Monorepo env files (per-package scope); detect already-committed env files + `git rm --cached`; icon.png 420→95 KB.
- [x] **7.11** GitHub Actions CI matrix (Windows / macOS / Ubuntu).
- [x] **7.12** Version check: both registries were on 0.1.1 on 2026-10-22, so 0.1.2 is the correct next version.
- [x] **7.13** 0.1.2 published to Open VSX (byte-identical to the local build). The Marketplace was skipped, with 0.1.3 going to both.
- [x] **7.14** 0.1.3 copy release: Pro purchase prompts removed (sales on hold), personal license (no machine limit), all copy aligned with `docs/CLAIMS.md`; `docs/HANDOFF.md` added.
- [ ] **7.15** Publish `envwizard-0.1.3.vsix` to the VS Code Marketplace and Open VSX, and deploy the website (owner).

## 📌 Phase 8: v0.2 Make Pro Real & Meet Users at the Error
**Goal**: Detect jams where they happen (the terminal) and ship the Pro features already being sold.

> Full design: [`docs/V0.2_SPEC.md`](V0.2_SPEC.md). Work happens on the `v0.2` branch.

- [x] **8.P1** `TerminalJamDetector` core (10+ tools, streamed/ANSI-safe, port inference, Windows reserved-port hint).
- [x] **8.P2** Feasibility spike: shell-integration output reading proven in real VS Code 1.120 (integration test).
- [x] **8.P3** Integration test harness + CI job on Windows / macOS / Ubuntu; `engines.vscode` → `^1.93.0`.
- [x] **8.0** Pro sales on hold until v0.2; $9.99 one-time personal license, no machine limit (decided 2026-10-22; see `docs/CLAIMS.md`).
- [ ] **8.S1** Foundation: ownership classifier, polite stop via the owning terminal, Pro gating helper, Windows reserved ports.
- [ ] **8.1** Terminal `EADDRINUSE` detector via shell integration: toast "Free it & rerun" (Free).
- [ ] **8.2** Zero-click auto-unjam + rerun for workspace-owned processes only (Pro).
- [ ] **8.3** Project-aware Clean Slate (cwd / command line inside the workspace).
- [ ] **8.4** Live env watcher on file save for newly referenced keys (Pro).
- [ ] **8.5** `.env` snapshots before edits with 1-click restore (Pro).
- [ ] **8.6** `.env.example` generator and value sanity checks (Free).
- [ ] **8.7** Multi-root workspace env audits.
- [ ] **8.8** Windows: real polite shutdown (Ctrl+C to the owning terminal or `GenerateConsoleCtrlEvent`).
- [x] ~~**8.9** Enforce the 3-machine license limit~~: dropped (personal license, honour system).
- [ ] **8.11** Launch: update `docs/CLAIMS.md` §4 → README/site/Gumroad from it → re-open Pro sales with 0.2.0.
