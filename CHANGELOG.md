# Changelog

## 0.1.3: Honest Pro information

- The Dev Deck and command palette no longer offer a Pro purchase. **Pro is coming with v0.2** (auto-unjam & rerun, a live `.env` watcher and encrypted `.env` snapshots), as a $9.99 one-time personal license. Everything in the free version stays free.
- The README, privacy policy and license terms now describe exactly what EnvWizard does today. The Pro license is a personal license for all your own machines, with no machine limit.
- No functional changes since 0.1.2.

## 0.1.2: Reliability hotfix

Thank you to everyone who installed 0.1.x and shared feedback. This release fixes the problems you reported.

### Fixed
- **Blank square in the Activity Bar.** EnvWizard now has a proper sidebar icon.
- **Dev Deck panel did nothing.** A script error stopped every button (Refresh, Clean Slate, Free, Auto-Fill) from working and left the panel stuck on "Scanning…". The panel now loads, updates live with the status bar, and asks before stopping anything.
- **"Freed" reported while the port was still busy.** If an auto-restarter (nodemon, `--reload`, pm2) brings the server straight back, EnvWizard now says so instead of claiming success.
- **Clean Slate could stop databases or Docker/WSL.** Postgres, Redis, MongoDB and MySQL are left alone, and Docker / WSL port relays and macOS editor helpers are now protected.
- **Protected-program errors.** Instead of a "command failed" error, EnvWizard now explains why it won't stop the program.
- **The same port listed twice** for servers on both IPv4 and IPv6.
- **False "All Clear"** when the port list couldn't be read (e.g. `lsof` missing). The status bar now says "Radar Offline". On Linux, `ss` is used when `lsof` isn't installed.
- **.env false alarms.** Keys in `.env.local` / `.env.development` now count, and runtime variables like `PORT` and `NODE_ENV` are no longer flagged. Virtualenvs are skipped.
- **.env misses.** EnvWizard now detects destructured keys (`const { KEY } = process.env`), `os.getenv("KEY", default)`, `Deno.env` / `Bun.env`, and files in deep monorepo folders.
- **"Healed" but still broken.** Blank placeholder values are now flagged as "needs a value", and the env file opens at the new lines so you can fill them in.
- `.env` parsing now handles multiline values, escaped quotes, inline comments and Windows line endings, and appending never changes existing bytes.
- License activation now verifies keys with Gumroad and explains when you're offline.

- **Monorepos.** Env files inside packages (e.g. `apps/web/.env.local`) are read, and each file only "sees" env files in its own folder and the folders above it.

### Added
- Warning (with a 1-click fix) when `.env` / `.env.local` would be committed to git.
- Detection of env files that are *already* committed, with a 1-click "Stop Tracking" (`git rm --cached`) that keeps your file on disk.
- Settings: `envwizard.watchedPorts` and `envwizard.scanIntervalSeconds`.
- Confirmation dialogs show which program and command hold the port before anything is stopped.
