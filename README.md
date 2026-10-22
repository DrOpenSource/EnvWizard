# 🔌 EnvWizard: Port Unjammer & .env Checker

> **Free your ports and fix your `.env`, without leaving your editor.**
> EnvWizard shows what's holding port 3000, frees it safely in one click, and finds the env variables your code needs but your `.env` is missing.
>
> 🌐 [envwizard.taqnik.in](https://envwizard.taqnik.in) • Free, with an optional $9.99 one-time Pro license

For **VS Code** (1.93+) on the Marketplace, and for **Cursor** and **Antigravity** via Open VSX. Runs on Windows, macOS and Linux (automated tests run on all three). Part of the DrOpenSource Calm Dev Suite, next to [GitWizard](https://github.com/DrOpenSource/GitWizard).

---

## ⚡ Why EnvWizard?

When you build with an AI assistant, your local setup breaks in boring ways:

- **Port Traffic Jam:** `npm run dev` fails with `EADDRINUSE` because an old server still holds port 3000.
- **Missing Secret Key:** the assistant adds `process.env.STRIPE_KEY` to your code, but your `.env` doesn't have it.
- **Ghost Servers:** dev servers from earlier sessions keep running and holding ports.

EnvWizard explains each one in plain English and fixes it in a click.

---

## 🌟 Free features

### 🚦 Port jams, right where they happen
- **Terminal alert:** when `npm run dev` (or Vite, Next.js, Uvicorn, Flask, Django…) fails because its port is busy, EnvWizard shows what's holding it, for example *"an old node server from this project"*, and offers **Free & Rerun**: it stops the old server and runs your command again.
- **Moved ports:** when Vite or Next.js quietly starts on 3001 instead of 3000, EnvWizard tells you (login callbacks and CORS often expect the usual port) and offers to free the original one.
- Needs the editor's terminal **shell integration**, which is on by default in VS Code for PowerShell, bash, zsh and fish (not cmd.exe). Everything else works without it.

### 📡 Port radar & 1-click unjam
- A status bar radar for your dev ports: `🔌 Dev: All Clear` or `🔌 Busy :3000`.
- See which program (and command) holds a port, then free it after a confirmation. A server running in one of your editor's terminals is stopped with Ctrl+C there first, like you would by hand.
- **Safety shield:** EnvWizard refuses to stop programs on its protected list (your editor, Docker, WSL, system processes).

### 🧹 Clean Slate
- Pick which leftover dev servers to stop. Servers from this project are pre-selected; other projects' are listed but not selected.
- Local databases (Postgres, Redis, MongoDB, MySQL) and protected programs are never offered.

### 🧩 Secret Box (.env) check
- Finds env variables your code uses (`process.env.*`, `import.meta.env.*`, `os.environ` / `os.getenv`, `Deno.env`, `Bun.env`) that are missing or blank in `.env`, `.env.local`, `.env.development` or `.env.development.local`, including per-package env files in monorepos. This is pattern matching on your code, done locally.
- Adds placeholders in one click (marked `# Added by EnvWizard`) without touching your existing lines.
- **Value hints:** a gentle note when a value looks wrong: two sets of quotes, a `*_URL` that isn't a URL, an OpenAI key that doesn't start with `sk-`. Hints name the key, never the value.
- **`.env.example` generator:** keys and comments, never values. If you already have one, new keys are added without rewriting it.
- **Secret leak check:** warns when `.env` isn't in `.gitignore`, or is already committed to git, with 1-click fixes.
- **Multi-root workspaces:** pick the folder in the Dev Deck.

---

## ⭐ EnvWizard Pro: $9.99 once

Pro adds hands-free extras. **Every Pro feature is off until you turn it on** in Settings.

- **Auto-unjam & rerun** (`envwizard.autoUnjam`): when your dev server fails because its port is held by an old copy of *this* project, EnvWizard frees it and runs your command again without asking, and notes it in the status bar. It never touches other projects, databases or protected programs, and it asks instead if the same port jams again within a minute. Needs terminal shell integration.
- **Live `.env` watcher** (`envwizard.envWatcher`): when you (or your AI assistant) save code that uses an env variable no env file defines, EnvWizard tells you once and offers to add it. Only the saved file is checked.
- **Encrypted `.env` snapshots** (`envwizard.snapshots`): the last 20 versions of each env file, encrypted on your computer (AES-256-GCM, with the key in your editor's secret storage). **EnvWizard: Restore .env Snapshot…** shows the difference before anything changes. Nothing is uploaded, and snapshots can't be opened on another computer.

**A personal license for all your own machines.** It never expires and includes 30-day refunds. No subscription, no account, no servers. Get it at [envwizard.taqnik.in](https://envwizard.taqnik.in/#pricing), then run **EnvWizard: Activate Pro License**.

---

## ⚙️ Settings

| Setting | Default | What it does |
|---|---|---|
| `envwizard.watchedPorts` | 3000-3002, 5173-5174, 8000, 8080, 8888, 5432, 6379, 27017, 4200, 4000 | Ports the radar watches |
| `envwizard.scanIntervalSeconds` | 5 | How often the status bar checks them |
| `envwizard.terminalDetection` | on | The terminal port-jam alert |
| `envwizard.autoUnjam` | off | Pro: auto-unjam & rerun |
| `envwizard.envWatcher` | off | Pro: live `.env` watcher |
| `envwizard.snapshots` | off | Pro: encrypted `.env` snapshots |

## 🔒 Privacy

Runs locally. Your code, ports and `.env` values never leave your machine. The only network request is a one-time license check with Gumroad when you activate Pro. Details, including how snapshots are stored: [PRIVACY.md](PRIVACY.md).

---

## 🛠️ Development

```bash
npm test                  # unit tests (Vitest), including real processes and ports
npm run compile           # typecheck
npm run build             # bundle with esbuild
npm run test:integration  # runs EnvWizard inside a real VS Code
```

## 📜 License

MIT © Dr. OpenSource
