# 🧭 EnvWizard: Start Here (Handoff & Current State)

**Read this first in any new session.** It records where the project stands, what's been decided, and what to do next, so no context lives only in a chat. Keep it current: update the snapshot and "Next steps" at the end of every working session.

*Last updated: 2026-10-23*

---

## 1. Snapshot

| What | State |
|---|---|
| **VS Code Marketplace** | 0.1.1 (live) |
| **Open VSX** (Cursor, Antigravity) | 0.1.2 (live) |
| **`main` branch** | 0.1.3 copy (honest "Pro coming" site). Not published (owner decision, §2) |
| **`v0.2` branch** | **0.2.0 complete and packaged** (`envwizard-0.2.0.vsix`, identity checked, installs). All sprints done; F6 port router deferred to a later version. Not pushed, merged, tagged or published yet |
| **Pro sales** | On hold. Re-open when 0.2.0 is live on both registries (`GUMROAD_KIT.md`). No licenses sold. |
| **Website (live)** | ⚠️ **Stale pre-0.1.3 build** (checked 2026-10-23): "Buy Pro for $9.99" buttons, "100% offline", "auto-heals on file save". It advertises features the published versions don't have. |
| **CI** | **Green on Windows, macOS and Ubuntu** (unit + integration) for 0.2.0, via PR #1 (2026-10-23). |

### Owner's launch steps (in this order)
1. **Today, independent of 0.2.0:** fix the live site. Either pause the Gumroad product, or deploy the honest 0.1.3 site from `main` (`git checkout main && npm run deploy:site`). Check `assets/gumroad_cover.jpg` before it is used again.
2. ✅ Done 2026-10-23: PR #1 green on 3 OSes, merged, tagged `v0.2.0`, GitHub release with the VSIX.
3. Optional but recommended: try the VSIX by hand in Cursor (not installed on the dev machine, so never tested there).
4. Merge to `main`, then publish (versions checked 2026-10-23: Marketplace 0.1.1, Open VSX 0.1.2, so 0.2.0 is valid; re-check if time has passed):
   ```
   npx @vscode/vsce publish --packagePath envwizard-0.2.0.vsix
   npx ovsx publish envwizard-0.2.0.vsix -p <OVSX_TOKEN>
   ```
   Rebuild the VSIX first if anything changed after CI (`npx @vscode/vsce package --out envwizard-0.2.0.vsix`).
5. Tag `v0.2.0` and push the tag.
6. Re-open Gumroad from `GUMROAD_KIT.md` (confirm the product ID in `LicenseManager.ts`, then buy-test with a real key once), then `npm run deploy:site` from `main`.

---

## 2. Decisions log

| Date | Decision |
|---|---|
| 2026-10-22 | Pro **sales on hold** until v0.2 delivers the Pro features. |
| 2026-10-22 | **$9.99 one-time, personal license (honour system)**: all of the buyer's own machines, no machine limit, no enforcement; never expires; 30-day refunds; no subscriptions ever. |
| 2026-10-22 | **No servers.** At $9.99 the only affordable model is fully local; the one network call is Gumroad license verification. Support is best-effort. See [`CLAIMS.md`](CLAIMS.md) §2. |
| 2026-10-22 | **All public copy follows [`CLAIMS.md`](CLAIMS.md)**: shipped + tested features only; measured numbers only; planned items labelled "Coming in v0.2". |
| 2026-10-22 | Offline self-generated `ENVWIZ-` keys removed (the keygen shipped in the bundle). Gumroad keys only. |
| 2026-10-22 | **0.1.3 will not be published** and the website not redeployed for now: no purchases or user requests so far, so there is no one to mislead. All effort goes to v0.2. |
| 2026-10-23 | **F6 port router deferred** to a later version: riskiest feature (rewrites the user's command), and F1–F5 are a complete Pro offer. Its setting was removed and it is out of all launch copy. |
| 2026-10-23 | Pro features are **opt-in, including the env watcher** (the spec said "default on for Pro"; the opt-in rule won). Restoring snapshots works even with snapshots turned off. |
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
| ✅ **Sprint 3: F2 + F3** | Pro auto-unjam & rerun (opt-in, only own project/terminal); project-aware Clean Slate (multi-select) | Done (166 unit + 5 integration tests passing) | — |
| ✅ **Sprint 4: F4 + F5** | `envWatcher.ts`: Pro live env watcher (per-file, debounced); `EnvSnapshots.ts` + `snapshots.ts`: Pro encrypted snapshots (AES-256-GCM, key in SecretStorage, restore with in-memory diff) | Done (200 unit + 6 integration tests passing) | — |
| ✅ **Sprint 5: F7 & launch prep** | `.env.example` generator, value hints, multi-root Dev Deck; F6 deferred; CLAIMS → README/site/Gumroad/media kit/EULA; integration suite passed in Antigravity IDE 1.107 | Done (215 unit + 6 integration tests passing) | — |
| ◐ **Release 0.2.0** | ✅ version check, bump, package, VSIX identity + install check. **Owner:** CI on GitHub, publish, tag, re-open Pro sales, deploy site (§1) | — | — |

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

1. The owner's launch steps in §1. Development work for 0.2.0 is finished.
2. After launch: watch GitHub issues for terminal-alert reports from shells/editors we couldn't test (Cursor, macOS/Linux shells by hand, cmd.exe users who get nothing).
3. Candidates for 0.3 (not promised anywhere): F6 port router; confirm CRA/Rails/Bun/Go messages with real runs; faster process inspection on Windows (PowerShell makes a jam toast take ~2 s); a snapshot export/import so snapshots survive a new computer.

### Findings from GitHub CI (2026-10-23)
- **Real bug fixed:** on Windows the same folder can be spelled with an 8.3 short name (`C:\Users\RUNNER~1`) or the long name (`runneradmin`). Auto-unjam's "command ran inside the workspace" check refused. `isPathInside` now also compares real paths (long names, junctions, symlinks).
- **macOS CI couldn't launch VS Code 1.110+** (`Contents/MacOS/Electron` was renamed). Fixed by `@vscode/test-electron` 3.1.0, which needs Node 22+.
- When a rerun is skipped, the reason now goes to the EnvWizard output panel (command still running, no shell integration, uncertain command line…).

### Findings from Sprint 5 (2026-10-23)
- **F7:** `core/EnvTemplate.ts` (`buildEnvExample`, `findValueHints`) and `extension/envExample.ts`. An existing `.env.example` is only appended to, never rewritten. Hints never include values. Spaces around *unquoted* values aren't flagged, because dotenv trims them.
- **Multi-root:** the Dev Deck's folder picker passes the folder to `auditEnv` / `generateEnvExample` as a command argument.
- **Antigravity IDE 1.107** (at `%LOCALAPPDATA%\Programs\Antigravity IDE`) runs the whole integration suite: set `VSCODE_EXECUTABLE` to its exe. Cursor is **not** installed (`NewCursor` in Programs is an unrelated project folder).
- **The live site was found stale** (see §1); `public/` is gitignored build output, regenerated by `deploy:site`.
- The VSIX ships `dist/extension.js.map` (245 KB uncompressed; the whole VSIX is 205 KB). Harmless for an MIT project; exclude `*.map` in `.vscodeignore` if size matters.

### Findings from Sprint 4 (2026-10-23)
- **F4** (`envWatcher.ts`): on save, `EnvHealer.findMissingKeysInFile` reads only the env files that file can see (own folder + parents): no workspace rescan. One toast per key per session; a `$(key) N missing env keys` badge stays until they're defined (rechecked when an env file is saved). The Dev Deck refreshes only when a *new* missing key appears. **Opt-in (default off)** like every Pro automation; the spec's "default on for Pro" was overridden by the opt-in rule.
- **F5** (`core/EnvSnapshots.ts`, `extension/snapshots.ts`): format `EWS1 | IV | tag | ciphertext`; the env file's relative path is the GCM additional data. Snapshots are taken: at startup (root env files, baseline), before save (disk version, via `onWillSave`), after save, and before every EnvWizard write (`beforeEnvWrite`: if the snapshot fails, EnvWizard doesn't write). Identical content is skipped; 20 kept per file.
- **Restore is always allowed** (even with the setting off) so nobody is locked out of copies they already have. It snapshots the current version first and refuses if the file has unsaved edits.
- **Lost key = unreadable snapshots** (SecretStorage isn't synced between machines). The restore error says so in plain words; PRIVACY.md §3 discloses it.
- The snapshot integration test sets `snapshots.deps.isEnabled` directly (no Pro license in tests). The file-permission (0600) test only runs on macOS/Linux (CI).

### Findings from Sprint 3 (2026-10-22)
- **F2 rule** (`canAutoUnjam` in `terminalAlert.ts`): only a *blocked* start (moved ports always ask), holder `this-project`/`this-terminal`, not protected, not a database, and the command ran inside the workspace. At most once per port per minute, so an auto-restarter can't loop. The Pro check only runs when a jam qualifies, so free users see the one-time Pro notice only when it would have helped (or when they turn the setting on).
- **PowerShell leaves `execution.cwd` undefined**; the code falls back to `terminal.shellIntegration.cwd`. Only the real-editor test caught this: without it, auto-unjam never fired on Windows.
- On Windows "this project" comes from paths in the holder's command line (cwd isn't readable); proven by the auto-unjam integration test (`node server.js` started in the workspace).
- Details of every automatic action go to the **EnvWizard** Output channel.
- F3: Clean Slate is now a multi-select QuickPick (`buildCleanSlatePicks` in `actions.ts`). Databases/protected programs aren't pickable; they're named in the placeholder.
- ~~Flaky once, cause unknown~~ **Explained by CI:** an earlier test's jam was still being handled when the next test began, so its toast reached the next test's stand-in. Tests now wait for their own jam and only answer toasts for their own port.
- The auto-unjam integration test sets `terminalAlerts.deps.isAutoUnjamEnabled` directly (a Pro license can't be activated in tests).

### Findings from Sprint 2 (2026-10-22)
- **VS Code has its own "free port" terminal quick fix** for `EADDRINUSE` output. In the test profile it logs `An unknown error occurred` in the renderer, even with EnvWizard's watcher off (confirmed). It isn't ours; EnvWizard's toast adds ownership, safety checks and rerun.
- **Windows dual-stack:** a server on `[::]:8000` and another on `127.0.0.1:8000` can both bind, so there is no jam (Uvicorn ran fine next to a Node blocker). Jams only happen on the same address family/interface.
- **On Windows, Python servers report a busy port as `WinError 10013`** (http.server, Flask, Django): the same error as a reserved port. The alert checks for a holder first, so it's only called "reserved" when nothing is listening.
- Ancestor lookup on Windows now reads the process table once (~0.5 s, cached 2 s) instead of one PowerShell call per level (~2.5 s). A jam toast still takes a couple of seconds on Windows because process inspection uses PowerShell.
- The integration test uses `ext.exports.terminalAlerts` (only exported in `ExtensionMode.Test`) to click the toast button.
