# 🧭 EnvWizard: Start Here (Handoff & Current State)

**Read this first in any new session.** It records where the project stands, what's been decided, and what to do next, so no context lives only in a chat. Keep it current: update the snapshot and "Next steps" at the end of every working session.

*Last updated: 2026-10-22*

---

## 1. Snapshot

| What | State |
|---|---|
| **VS Code Marketplace** | 0.1.1 (live) |
| **Open VSX** (Cursor, Antigravity) | 0.1.2 (live) |
| **`main` branch** | **0.1.3**, built and ready to publish (copy-only release: removes Pro purchase prompts) |
| **`v0.2` branch** | Sprints 1–2 done (foundation + F1 terminal alert). Version still 0.1.x; bumped only at release |
| **Pro sales** | **On hold** until v0.2 ships the Pro features. No licenses sold. |
| **Website** (`index.html` → envwizard.taqnik.in) | Copy updated on `main`; **needs deploy** (`npm run deploy:site`) |
| **CI** | GitHub Actions: unit tests on Windows/macOS/Ubuntu (green); integration job added on `v0.2` (not yet run on GitHub: it runs on PRs to `main`) |

### Owner's pending actions
1. Publish **0.1.3** to both registries (it is higher than both live versions, so they line up again):
   ```
   npx @vscode/vsce publish --packagePath envwizard-0.1.3.vsix
   npx ovsx publish envwizard-0.1.3.vsix -p <OVSX_TOKEN>
   ```
2. Deploy the updated website: `npm run deploy:site`.
3. Check the Gumroad product is unpublished or paused, and check that `assets/gumroad_cover.jpg` doesn't advertise unshipped features before it is ever used again.

---

## 2. Decisions log

| Date | Decision |
|---|---|
| 2026-10-22 | Pro **sales on hold** until v0.2 delivers the Pro features. |
| 2026-10-22 | **$9.99 one-time, personal license (honour system)**: all of the buyer's own machines, no machine limit, no enforcement; never expires; 30-day refunds; no subscriptions ever. |
| 2026-10-22 | **No servers.** At $9.99 the only affordable model is fully local; the one network call is Gumroad license verification. Support is best-effort. See [`CLAIMS.md`](CLAIMS.md) §2. |
| 2026-10-22 | **All public copy follows [`CLAIMS.md`](CLAIMS.md)**: shipped + tested features only; measured numbers only; planned items labelled "Coming in v0.2". |
| 2026-10-22 | Offline self-generated `ENVWIZ-` keys removed (the keygen shipped in the bundle). Gumroad keys only. |
| 2026-10-22 | Free/Pro split for v0.2: manual 1-click fixes are free (including the terminal "Free & Rerun" alert); Pro = opt-in automation and safety nets (auto-unjam, live env watcher, encrypted snapshots, port router). |

---

## 3. Document map

| Doc | Purpose |
|---|---|
| [`CLAIMS.md`](CLAIMS.md) | Pricing, licensing, service model, rules for any claim, approved copy. **Check before writing any user-facing text.** |
| [`REVIEW.md`](REVIEW.md) | Field review of v0.1.1: what was broken, what 0.1.2 fixed, and what's still open. |
| [`ROADMAP.md`](ROADMAP.md) | Checkbox tracker. Phase 7 = 0.1.x hotfixes, Phase 8 = v0.2. |
| `V0.2_SPEC.md` *(on `v0.2` branch)* | Technical design for every v0.2 feature, sprints, release checklist. |
| [`PUBLISHING.md`](PUBLISHING.md) | How to package and publish, plus the per-release checklist (version check first). |
| [`GUMROAD_KIT.md`](GUMROAD_KIT.md) | Launch-day Gumroad listing. **Do not publish until v0.2.** |
| [`PRD.md`](PRD.md) | Original product requirements (goals, not claims). |
| `../AGENTS.md` | Rules for AI agents working on the repo. |

---

## 4. Pathway to v0.2

Effort estimates are in **working sessions** (one focused session ≈ what was done on 2026-10-22). They are estimates, not promises.

| Step | Contents (see `V0.2_SPEC.md`) | Gate to move on | Est. |
|---|---|---|---|
| ✅ Groundwork | Jam detector (29 tests), shell-integration feasibility proven in real VS Code, integration harness + CI job, engines `^1.93` | Done | — |
| ✅ **Sprint 1: Foundation** | Ownership classifier (`this-terminal` / `this-project` / `other-project`); polite stop via Ctrl+C to the owning terminal; Pro gating helper (opt-in, one-time notice); Windows reserved-port helper | Done (110 unit tests passing) | — |
| ✅ **Sprint 2: F1 terminal alert (Free)** | `src/extension/terminalAlert.ts`: "Port 3000 jam → Free & Rerun" toast; shifted-port (Vite/Next) notice; reserved-port explainer; degrades without shell integration; real output confirmed for 7 tools | Done (144 unit + 4 integration tests passing) | — |
| **Sprint 3: F2 + F3** | Pro auto-unjam & rerun (opt-in, only own project/terminal); project-aware Clean Slate (multi-select) | Never touches other-project / DB / protected processes (tests) | 1–2 |
| **Sprint 4: F4 + F5** | Pro live env watcher (per-file, debounced); Pro encrypted snapshots (AES-256-GCM, key in SecretStorage, restore with in-memory diff) | Snapshot round-trip and restore tests; no plaintext on disk | 2 |
| **Sprint 5: F7 (+ F6 stretch) & launch prep** | `.env.example` generator, value sanity checks, multi-root; port router only if time allows; listing/README/site from `CLAIMS.md`; smoke test in Cursor and Antigravity | Release checklist in `PUBLISHING.md` §5 | 1–2 |
| **Release 0.2.0** | Version check → bump → package → publish → **re-open Pro sales** with copy that lists only shipped Pro features | — | — |

**Total: roughly 6–9 working sessions.** If time is short, ship v0.2 with F1–F5 and move F6 (port router) to v0.3. In that case remove it from the Pro copy before launch.

---

## 5. Working on this repo: how-to and gotchas

- **Commands:**
  - `npm run compile` (typecheck), `npm test` (Vitest, includes real-process tests), `npm run build` (esbuild → `dist/`).
  - `npm run test:integration` (v0.2 branch) runs EnvWizard in a real VS Code. Set `VSCODE_EXECUTABLE` to use a local install, e.g. `%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe`.
  - Package: `npx @vscode/vsce package --out envwizard-<version>.vsix`.
- **`ELECTRON_RUN_AS_NODE`** is inherited inside VS Code's terminal and makes `Code.exe` behave like Node. The integration runner unsets it; do the same for any manual launch.
- **Windows PowerShell 5.1** mangles quotes in native-command arguments: write commit messages to a file and use `git commit -F <file>`.
- **No vsce/ovsx tokens** on the dev machine: the owner publishes manually.
- **Published versions are immutable**: always check both registries before bumping (see `PUBLISHING.md` §5).
- **Screenshots of the webview/site:** Edge headless (`msedge --headless=new --screenshot=...`) works. A real-editor screenshot can be taken during an integration run.

---

## 6. Next steps (pick up here)

1. *(Owner)* Publish 0.1.3 and deploy the website (§1).
2. Start **Sprint 3: F2 + F3** from `V0.2_SPEC.md` §4:
   - F2 (Pro, opt-in `envwizard.autoUnjam`): in `TerminalJamAlerts`, skip the toast and run the same free → rerun path when the holder is `this-terminal`/`this-project`, not protected, not a database. Gate with `isProFeatureEnabled('autoUnjam', …)` from `pro.ts`.
   - F3 (Free): replace the Clean Slate modal in `actions.ts` with a multi-select QuickPick using `classify()`.
   - Tests must prove other-project / database / protected holders are never touched automatically.
3. At the end of the session, tick boxes in `ROADMAP.md` and update §1 and §6 of this file.

### Findings from Sprint 2 (2026-10-22)
- **VS Code has its own "free port" terminal quick fix** for `EADDRINUSE` output. In the test profile it logs `An unknown error occurred` in the renderer, even with EnvWizard's watcher off (confirmed). It isn't ours; EnvWizard's toast adds ownership, safety checks and rerun.
- **Windows dual-stack:** a server on `[::]:8000` and another on `127.0.0.1:8000` can both bind, so there is no jam (Uvicorn ran fine next to a Node blocker). Jams only happen on the same address family/interface.
- **On Windows, Python servers report a busy port as `WinError 10013`** (http.server, Flask, Django): the same error as a reserved port. The alert checks for a holder first, so it's only called "reserved" when nothing is listening.
- Ancestor lookup on Windows now reads the process table once (~0.5 s, cached 2 s) instead of one PowerShell call per level (~2.5 s). A jam toast still takes a couple of seconds on Windows because process inspection uses PowerShell.
- The integration test uses `ext.exports.terminalAlerts` (only exported in `ExtensionMode.Test`) to click the toast button.
