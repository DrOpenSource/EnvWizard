# EnvWizard: Pricing, Licensing & Honest Claims

**This file is the single source of truth for anything EnvWizard says about itself**: README, website (`index.html`), Marketplace/Open VSX listing, Gumroad page, in-extension text, EULA, privacy policy and social posts. When the product changes, update this file first, then the copy.

*Decisions recorded 2026-10-22 by the owner.*

---

## 1. Decisions

| Topic | Decision |
|---|---|
| **Pro sales** | **On hold** until v0.2 ships the Pro features. No Pro licenses have been sold. |
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
3. **Say how it works, plainly.** Code scanning is pattern matching. Don't say "AST" or "AI". Don't say "daemon", "zero-click" or "background auto-unjam" until F2 ships.
4. **Safety claims describe behaviour, not guarantees.** Write "refuses to stop programs on its protected list (your editor, Docker, WSL, system processes)", not "can never kill" or "un-bypassable".
5. **Privacy wording:** "Runs locally. Your code, ports and `.env` values never leave your machine. The only network request is a one-time license check with Gumroad when you activate Pro." Don't say "100% offline" or "offline license validation".
6. **Platforms:** "Windows, macOS and Linux (automated tests run on all three)". Don't claim hands-on testing on a platform unless it happened.
7. **Editors:** VS Code (Marketplace); Cursor and Antigravity via Open VSX. VS Code 1.93+ from v0.2.

---

## 4. Approved copy

### Tagline
> **Free your ports and fix your `.env`, without leaving your editor.**
> EnvWizard shows what's holding port 3000, frees it safely in one click, and finds the env variables your code needs but your `.env` is missing.

### Free: available now (0.1.3)
- **Port radar** in the status bar for your dev ports (configurable).
- **1-click unjam:** see which program holds a port, then stop it after a confirmation.
- **Clean Slate:** stop leftover dev servers on your watched ports. Databases and protected programs are left alone.
- **Safety shield:** refuses to stop your editor, Docker, WSL relays and system processes.
- **`.env` check:** finds variables your code uses that are missing or blank in `.env` / `.env.local` (monorepo packages included), and adds placeholders in one click.
- **Secret leak check:** warns when `.env` isn't in `.gitignore` or is already committed, with 1-click fixes.

### Pro: coming in v0.2 (not on sale yet)
- **Auto-unjam & rerun:** when your dev server fails because its port is busy with an old copy of *this* project, EnvWizard frees it and restarts your command. Opt-in.
- **Live `.env` watcher:** when you (or your AI assistant) save code that uses a new env variable, EnvWizard tells you right away.
- **Encrypted `.env` snapshots:** a local, encrypted copy before every change, with 1-click restore.
- **Port router:** run this project on another port when the usual one belongs to a different project.

*(In v0.2 itself, the **terminal port-jam alert with "Free & Rerun"** is a **free** feature. Only the hands-free version is Pro.)*

### Pricing statement
- **Now:** "EnvWizard is free. **Pro is coming with v0.2**, as a $9.99 one-time personal license. Sales open when it ships."
- **At v0.2 launch:** "**Pro: $9.99 once.** A personal license for all your own machines, never expires, and includes 30-day refunds. No subscription, no account, no servers."

### FAQ answers
- **Does EnvWizard send my code or secrets anywhere?** No. Everything runs locally. The only network request is a one-time license check with Gumroad when you activate Pro.
- **How does the Pro license work?** $9.99 once, for you personally, on all your own machines. It never expires. No subscription. *(While sales are on hold: "Pro launches with v0.2.")*
- **Can it kill something important?** EnvWizard always shows what holds a port and asks first. It refuses to stop programs on its protected list (your editor, Docker, WSL, system processes), and Clean Slate leaves databases alone.
- **Which editors?** VS Code, Cursor and Antigravity (via Open VSX).
