# 🔌 EnvWizard — Product Requirements Document (PRD)

> **"Never Google `EADDRINUSE` again. Zero port collisions. Zero missing secrets. Instant flow-state for vibe coders."**

---

## 1. Executive Summary & Vision

**EnvWizard** is an intent-based local runtime and environment guardian extension for **VS Code**, **Cursor**, and **Antigravity**. It sits alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) as part of the DrOpenSource Calm Dev Suite.

Vibe coders and modern developers rely on conversational AI models that rapidly generate code, spin up dev servers, and reference environment variables. However, local environments break constantly:
- Ghost processes hog common ports (`3000`, `5173`, `8000`), triggering cryptic `EADDRINUSE` terminal errors.
- AI models introduce new `process.env.NEW_KEY` calls into application code without updating `.env`, leading to runtime crashes.
- Developers waste 10–20 minutes running esoteric terminal commands (`lsof -ti:3000 | xargs kill -9` or `netstat -ano | findstr :3000`).

**EnvWizard eliminates this friction with a 1-click visual guardian deck, translating terrifying operating system jargon into plain English, backed by an accessible $9.99 one-time lifetime license.**

---

## 2. Product Philosophy: The GitWizard DNA

EnvWizard directly adopts the core architectural and UX tenets proven in **GitWizard**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GITWIZARD DNA IN ENVWIZARD                      │
├────────────────────────────────┬───────────────────────────────────────┤
│ GitWizard Pattern              │ EnvWizard Implementation               │
├────────────────────────────────┼───────────────────────────────────────┤
│ 🛡️ Safe Defaults & Zero Loss    │ Protected PID List: Never kill system  │
│                                │ services, Docker hosts, or databases  │
│                                │ without explicit user confirmation.   │
├────────────────────────────────┼───────────────────────────────────────┤
│ 🗣️ Plain-English Translations   │ Translates POSIX signals, PIDs, and   │
│                                │ socket errors into conversational cards│
├────────────────────────────────┼───────────────────────────────────────┤
│ ⚡ Intent-Driven Calm Deck      │ 1-Click "Unjam Port", "Wipe Ghosts",   │
│                                │ "Auto-Fill Secrets" action buttons.   │
├────────────────────────────────┼───────────────────────────────────────┤
│ ⏳ Passive Guardian / Watcher  │ Non-intrusive status bar indicator;    │
│                                │ auto-detects conflicts before launch. │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Target Audience & Personas

### Persona A: "The Vibe Coder" (Primary)
- **Profile**: Founders, designers, and non-traditional developers building apps with Cursor Composer, Claude, and Antigravity.
- **Pain Points**: Terminal panic. When `npm run dev` outputs a red wall of text with `EADDRINUSE`, they don't know what PID is running or how to free the port. When an app crashes with `apiKey is undefined`, they don't realize the AI didn't add it to `.env`.
- **Value Realization**: 1-click button frees the port in 100ms. Code runs immediately.

### Persona B: "The Context-Switching Indie Hacker" (Secondary)
- **Profile**: Full-stack developer juggling 4 projects simultaneously (frontend, backend, microservices).
- **Pain Points**: Leaves dev servers running in background terminals or closed editor tabs. Ports collide constantly.
- **Value Realization**: Visual radar showing all active ports with project paths and memory usage.

---

## 4. The Plain-English Translation Glossary

EnvWizard strips away cryptic terminal jargon and replaces it with intuitive developer metaphors:

| Scary OS / Terminal Jargon | What Actually Happened | EnvWizard Plain English Card |
| :--- | :--- | :--- |
| `EADDRINUSE :::3000` | Another process is bound to port 3000 | 🚦 **Port Traffic Jam**<br>*"Port 3000 is occupied by a forgotten Vite server from another project. [⚡ Free Port]"* |
| `taskkill /F /PID 14920` | Forcefully killing a Windows PID | 🪦 **Evict Process**<br>*"Safely ask the server to stop, then close it if stuck."* |
| `SIGTERM` vs `SIGKILL` | Polite stop request vs immediate hard kill | 🤝 **Polite Knock** vs 💥 **Instant Eviction** |
| Zombie / Orphan Process | Background child process whose parent died | 👻 **Ghost Server**<br>*"A background Python script is still running quietly in the dark. [🧹 Clean Up]"* |
| `process.env.KEY is undefined` | Missing config entry in runtime | 🧩 **Missing Secret Key**<br>*"Your code wants `STRIPE_KEY`, but your secret box doesn't have it. [➕ Add Test Key]"* |
| `.env` vs `.env.example` drift | Uncommitted or out-of-sync env schema | 📋 **Recipe Mismatch**<br>*"Your project recipe mentions 2 keys that aren't set in your local `.env`. [✨ Sync]"* |

---

## 5. User Journeys (Before vs. After)

### Journey 1: The Dev Server Jam (`EADDRINUSE`)
- **Before EnvWizard**:
  1. Vibe coder prompts AI: *"Build the login page and test it."*
  2. Terminal runs `npm run dev` → crashes with `Error: listen EADDRINUSE: address already in use :::3000`.
  3. User pastes error back to AI → AI suggests running `lsof -i :3000` or `netstat -ano`.
  4. User gets confused by PID columns, runs wrong command, accidentally closes something else or gives up.
- **With EnvWizard**:
  1. Terminal crashes or user opens VS Code.
  2. EnvWizard status bar turns amber: `🚨 Port 3000 Blocked`.
  3. User clicks toast: *"Port 3000 is in use by Node (Project: `saas-landing-v1`). Would you like to free it?"*
  4. User clicks **[⚡ Unjam Port]**. Process cleanly terminates in 50ms. Dev server starts seamlessly.

### Journey 2: AI Code Generation Injects New Env Vars
- **Before EnvWizard**:
  1. AI adds Supabase client setup with `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  2. Page crashes on load with unhandled runtime exception: `URL is required`.
  3. User spends 20 minutes debugging why the page is blank.
- **With EnvWizard**:
  1. EnvWizard passively monitors code edits on save.
  2. Notices `NEXT_PUBLIC_SUPABASE_ANON_KEY` referenced in `lib/supabase.ts` is absent from `.env`.
  3. Subtle toast appears: *"🧩 New secret detected: `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add placeholder to your `.env`?"*
  4. 1-click inserts `# Added by AI:\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here` into `.env`.

---

## 6. Functional Requirements

### FR-1: High-Speed Port Radar & Process Inspector
- Scans priority development ports: `3000`, `3001`, `5173`, `8000`, `8080`, `8888`, `5432`, `6379`, `27017`, `4200`.
- Fast resolution (< 100ms) on Windows (`netstat -ano`), macOS (`lsof -P -iTCP -sTCP:LISTEN`), and Linux (`ss -tulpn` / `lsof`).
- Resolves:
  - Process ID (PID)
  - Process Name (`node.exe`, `python`, `uvicorn`, `bun`, `deno`, `docker-proxy`)
  - Working Directory (Path of the project running that process)
  - Memory usage & CPU % (via `pidusage`)

### FR-2: Safe Process Unjammer (Zombie Buster)
- **Two-Stage Termination**:
  1. Stage 1: Polite Shutdown (`SIGTERM` on POSIX / `WM_CLOSE` on Windows). Waits 800ms.
  2. Stage 2: Hard Eviction (`SIGKILL` / `taskkill /F /T`) only if stubborn.
- **Process Tree Killing**: Recursively kills child processes so orphaned worker threads don't linger.
- **Protected Safety List**: Rejects accidental termination of system processes (`explorer.exe`, `WindowServer`, `dockerd`, IDE instances) unless confirmed with double-prompt.

### FR-3: AST & Regex Env Healer
- Scans active workspace files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.env*`).
- Detects calls:
  - `process.env.VAR_NAME`
  - `import.meta.env.VAR_NAME`
  - `os.environ.get("VAR_NAME")` / `os.getenv("VAR_NAME")`
- Compares against local `.env`, `.env.local`, and `.env.example`.
- Highlights:
  - Missing keys (used in code, missing in `.env`)
  - Unused keys (defined in `.env`, never referenced)
  - Template drift (keys in `.env.example` not present in `.env`)
- **Privacy Guarantee**: Operates 100% locally on the user's machine. Never transmits secret keys or values over any network.

### FR-4: Calm Dev Deck UI
- **Status Bar Item**:
  - `🔌 Dev: All Clear` (when all watched ports are free)
  - `🚨 Port 3000 Busy [Fix]` (1-click quick fix)
- **Activity Bar View / Sidebar Deck**:
  - Visual Port Status Grid (Green / Amber / Red)
  - Active Process Inspector with Project Names
  - 1-Click "Clean Slate" (kills all dev server zombies across all ports at once)

---

## 7. Monetization Strategy: $9.99 One-Time Personal License

> **Current decisions and approved public wording live in [`CLAIMS.md`](CLAIMS.md).** Pro sales are on hold until v0.2 ships the Pro features. This PRD describes goals; it is not public copy.

### Why Developers & Vibe Coders Prefer One-Time Pricing
- **Zero Subscription Fatigue**: Developers hate paying $5/mo or $8/mo for small utilities.
- **The $9.99 Impulse Point**: Priced like a specialty coffee or Gumroad utility. Frictionless checkout.
- **Developer Goodwill**: Builds long-term trust for DrOpenSource's suite of developer tools.

### Tier Comparison Matrix

| Feature | Free | Pro ($9.99 one-time) | Status |
| :--- | :---: | :---: | :--- |
| Port radar (configurable ports), 1-click unjam, Clean Slate, Safety Shield | ✅ | ✅ | Shipped (0.1.x) |
| `.env` missing/blank finder, `.gitignore` & committed-secret checks | ✅ | ✅ | Shipped (0.1.x) |
| Terminal port-jam alert with **Free & Rerun** | ✅ | ✅ | v0.2 |
| Project-aware Clean Slate, `.env.example` generator, value sanity checks | ✅ | ✅ | v0.2 |
| **Auto-unjam & rerun** (hands-free, opt-in) | Manual click | ✅ | v0.2 |
| **Live `.env` watcher on save** | Manual refresh | ✅ | v0.2 |
| **Encrypted `.env` snapshots + restore** | ❌ | ✅ | v0.2 |
| **Port router** (run on another port) | ❌ | ✅ | later (deferred from v0.2) |
| Docker / database container health | ❌ | ❌ | Not planned |
| License | — | Personal license, all your own machines, never expires, 30-day refunds | Decided 2026-10-22 |

---

## 8. Technical Architecture & Stack

```
EnvWizard Extension
├── Core Engine (Pure TypeScript, Zero IDE Lock-in)
│   ├── PortScanner (Platform-agnostic socket & PID resolver)
│   ├── ProcessTerminator (Safe tree-kill with graceful timeout)
│   ├── EnvHealer (Code AST parser & .env file serializer)
│   └── LicenseManager (Offline-capable cryptographic key verifier)
├── VS Code / Cursor / Antigravity Layer
│   ├── StatusBarController (Live pulse & quick action triggers)
│   ├── DevDeckWebviewProvider (Rich visual dashboard)
│   └── DiagnosticProvider (In-editor squiggly warnings for missing env vars)
```

---

## 9. Testing & Quality Assurance Requirements

1. **Cross-Platform Verification**:
   - Windows 10/11 (PowerShell & Command Prompt)
   - macOS (Intel & Apple Silicon Zsh)
   - Linux (Ubuntu/Debian Bash)
2. **Process Mocking**:
   - Tests spin up real temporary TCP sockets on dynamic ports, verify detection, trigger `Unjam`, and assert port availability within 1000ms.
3. **Safety Assurance**:
   - Explicit tests ensuring PIDs matching system names (`wininit`, `systemd`, `launchd`) cannot be terminated even if mapped to a port.
4. **Env Parser Robustness**:
   - Supports multiline values, comments (`#`), quotes (`"..."`, `'...'`), exports (`export KEY=val`), and variable expansions (`$VAR`).
