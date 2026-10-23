# EnvWizard: Pricing, Licensing & Honest Claims

**This file is the single source of truth for anything EnvWizard says about itself**: README, website (`index.html`), Marketplace/Open VSX listing, Gumroad page, in-extension text, EULA, privacy policy and social posts. When the product changes, update this file first, then the copy.

*Decisions recorded 2026-10-22 by the owner. §4 updated 2026-10-23 for the 0.2.0 release.*

---

## 1. Decisions

| Topic | Decision |
|---|---|
| **Pro sales** | **Re-open when 0.2.0 is live on both registries** (the owner switches the Gumroad product back on). Until then: on hold. No Pro licenses have been sold. |
| **Price** | **$9.99 one-time.** No subscriptions, ever. |
| **License type** | **Personal license, honour system.** One person, on all of their own machines. **No machine/seat limit and no enforcement.** Not for sharing with other people or teams. |
| **Free tier** | Everything shipped in 0.1.x stays free forever (port radar, 1-click unjam, Clean Slate, `.env` audit & fixes, `.gitignore` checks). Pro adds *automation and safety nets*; it never takes free features away. No nag screens. |
| **Refunds** | 30-day, no-questions refund through Gumroad. |
| **"Lifetime"** | Means the **license never expires**. It does *not* promise updates forever. |

## 2. What $9.99 can afford (the service model)

At $9.99 one-time (about **$8.50 net** after Gumroad's fee of roughly 10% + $0.50; check the current rate), EnvWizard only works as a business if each sale costs nothing to serve afterwards. So:

- **No servers, ever.** Everything runs on the user's machine. The only network request is a single Gumroad license check when someone activates Pro. No accounts, cloud sync, dashboards or telemetry.
- **Support is best-effort:** GitHub issues and `support@taqnik.in`, with no response-time promise.
- **Updates:** Pro improvements ship to license holders free of charge *for as long as EnvWizard is maintained*.
- **Never promise:** SLAs or guaranteed response times; team or company features; cloud backup/sync; guaranteed compatibility with every future editor or fork; "works everywhere".

If a future feature would need a server (team sharing, cloud vault), it does **not** fit this price. It would be a separate product decision, not a v0.x feature.

## 3. Rules for any claim

1. **Shipped + tested only.** A feature may be described as available only if it is in the **currently published** version and covered by a test. Planned features are labelled **"Coming in v0.2"**, never with a ✓.
2. **Numbers must be measured.** Use a measured, dated figure, or no number at all. (Measured on Windows 11, 2026-10-22: port scan ~40–70 ms; freeing a port ~2 s; activation ~170–190 ms.)
3. **Say how it works, plainly.** Code scanning is pattern matching. Don't say "AST" or "AI". Don't say "daemon" or "background": auto-unjam reacts to a failed command in the terminal, it doesn't run in the background. Always mention that Pro features are opt-in.
4. **Safety claims describe behaviour, not guarantees.** Write "refuses to stop programs on its protected list (your editor, Docker, WSL, system processes)", not "can never kill" or "un-bypassable".
5. **Privacy wording:** "Runs locally. Your code, ports and `.env` values never leave your machine. The only network request is a one-time license check with Gumroad when you activate Pro." Don't say "100% offline" or "offline license validation".
6. **Platforms:** "Windows, macOS and Linux (automated tests run on all three)". Don't claim hands-on testing on a platform unless it happened.
7. **Editors:** VS Code (Marketplace); Cursor and Antigravity via Open VSX. VS Code 1.93+ from v0.2. The integration suite passed in VS Code 1.120 and **Antigravity IDE 1.107** (Windows, 2026-10-23). **Cursor has not been tested**: say "available for Cursor via Open VSX", never "tested in Cursor".
8. **Terminal features need shell integration** (VS Code's default for PowerShell, bash, zsh and fish; not cmd.exe). Say so wherever the terminal alert or auto-unjam is described.

---

## 4. Approved copy

### Tagline
> **Free your ports and fix your `.env`, without leaving your editor.**
> EnvWizard shows what's holding port 3000, frees it safely in one click, and finds the env variables your code needs but your `.env` is missing.

> **Use the 0.2.0 copy below only once 0.2.0 is live on both registries.** Before that, the 0.1.3 wording applies: the free list without the "new in 0.2" items, and "Pro is coming with v0.2".

### Free (0.2.0)
- **Port radar** in the status bar for your dev ports (configurable).
- **Terminal port-jam alert** *(new in 0.2)*: when `npm run dev` (or Vite, Next.js, Uvicorn, Flask, Django…) fails because its port is busy, EnvWizard shows what's holding it and offers **Free & Rerun**. Needs terminal shell integration.
- **Moved-port notice** *(new in 0.2)*: when Vite or Next.js quietly starts on another port, EnvWizard tells you and offers to free the original one.
- **1-click unjam:** see which program holds a port, then stop it after a confirmation. A server running in one of your editor's terminals is stopped with Ctrl+C there first.
- **Clean Slate** *(updated in 0.2)*: pick which dev servers to stop. This project's servers are pre-selected, other projects' aren't, and databases and protected programs are never offered.
- **Safety shield:** refuses to stop your editor, Docker, WSL relays and system processes.
- **`.env` check:** finds variables your code uses that are missing or blank in `.env` / `.env.local` (monorepo packages included), and adds placeholders in one click.
- **Value hints** *(new in 0.2)*: a gentle note when a value looks wrong (two sets of quotes, a `*_URL` that isn't a URL, an OpenAI key that doesn't start with `sk-`).
- **`.env.example` generator** *(new in 0.2)*: keys and comments, never values. Adds new keys to an existing file without rewriting it.
- **Multi-root workspaces** *(new in 0.2)*: pick the folder in the Dev Deck.
- **Secret leak check:** warns when `.env` isn't in `.gitignore` or is already committed, with 1-click fixes.

### Pro (0.2.0): $9.99 once, every feature opt-in
- **Auto-unjam & rerun:** when your dev server fails because its port is held by an old copy of *this* project, EnvWizard frees it and runs your command again, without asking. It never touches other projects, databases or protected programs, and it asks instead if the same port jams again within a minute. Needs terminal shell integration.
- **Live `.env` watcher:** when you (or your AI assistant) save code that uses an env variable no env file defines, EnvWizard tells you once and offers to add it. Only the saved file is checked.
- **Encrypted `.env` snapshots:** the last 20 versions of each env file, encrypted on your computer (AES-256-GCM, key in the editor's secret storage), with a side-by-side preview before you restore. Nothing is uploaded. Snapshots can't be opened on another computer.

**Not in 0.2:** the port router (run this project on another port) moved to a later version. Don't mention it in launch copy.

### Pricing statement
- **Before 0.2.0 is live:** "EnvWizard is free. **Pro is coming with v0.2**, as a $9.99 one-time personal license. Sales open when it ships."
- **From 0.2.0:** "**Pro: $9.99 once.** A personal license for all your own machines, never expires, and includes 30-day refunds. No subscription, no account, no servers."

### FAQ answers
- **Does EnvWizard send my code or secrets anywhere?** No. Everything runs locally. The only network request is a one-time license check with Gumroad when you activate Pro.
- **How does the Pro license work?** $9.99 once, for you personally, on all your own machines. It never expires. No subscription. Every Pro feature is off until you turn it on in Settings.
- **Can it kill something important?** EnvWizard shows what holds a port and asks first. The one exception is Pro auto-unjam, which you have to turn on, and which only acts on old copies of the project you're working in. It refuses to stop programs on its protected list (your editor, Docker, WSL, system processes), and Clean Slate never offers databases.
- **Which editors?** VS Code 1.93+ (Marketplace), and Cursor and Antigravity via Open VSX. EnvWizard's integration tests have passed in VS Code and Antigravity.
- **What if I get a new computer?** Your license works there too. Encrypted snapshots stay on the computer that made them.
