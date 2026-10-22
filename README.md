# 🔌 EnvWizard — Safe Local Dev Guardian for Vibe Coders

> **Zero port collisions. Zero missing secrets. Instant flow-state.**  
> 🌐 Website: [https://envwizard.taqnik.in](https://envwizard.taqnik.in) • Free to use. Pro is coming with v0.2 ([see what's planned](https://envwizard.taqnik.in/#pricing))

**EnvWizard** is an intent-based local runtime guardian and port unjammer extension for **VS Code**, **Cursor**, and **Antigravity**. It sits alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) as part of the DrOpenSource Calm Dev Suite.

---

## ⚡ Why EnvWizard?

Vibe coders iterate conversationally: asking AI models to generate entire features, spin up servers, and configure environment variables. But local dev environments break constantly:

- **Port Traffic Jams (`EADDRINUSE`)**: A forgotten background server hogs port `3000` or `5173`.
- **Missing Secrets**: AI introduces `process.env.STRIPE_KEY` into code, but your local `.env` doesn't have it, causing unhandled runtime crashes.
- **Ghost Servers**: Forgotten Node/Python dev servers keep running in the background and hold on to your ports.

EnvWizard translates terrifying operating system errors into calm, plain-English intent cards with 1-click healing.

---

## 🌟 Core Features

### 1. 🚦 Real-Time Port Radar & 1-Click Unjammer
- Live radar in your Status Bar: `🔌 Dev: All Clear` or `🔌 Busy :3000`.
- See which program (and command) is holding a port, then free it with one click after a confirmation.
- **Safety Shield**: EnvWizard refuses to stop programs on its protected list (your editor, Docker, WSL, system processes).

### 2. 🧩 Secret Box (.env) Checker
- Scans code references (`process.env.*`, `const { KEY } = process.env`, `import.meta.env.*`, `os.environ` / `os.getenv`, `Deno.env`, `Bun.env`).
- Reads `.env`, `.env.local`, `.env.development` and `.env.development.local`, so keys in any of them count.
- Detects missing variables, blank values, and template drift against `.env.example`.
- Warns when a secret `.env` file is not covered by `.gitignore`, with a 1-click fix.
- 1-click appends starter placeholder variables with `# Added by EnvWizard` comments, then opens the file so you can paste the real values.

### 3. 🧹 1-Click Clean Slate
- One click stops the background Node, Python, Vite and other dev servers on your watched ports.
- Local databases (Postgres, Redis, MongoDB, MySQL) and protected programs (your editor, Docker, WSL) are always left alone.

### ⚙️ Settings
- `envwizard.watchedPorts`: the ports the radar watches (default: 3000-3002, 5173-5174, 8000, 8080, 8888, 5432, 6379, 27017, 4200, 4000).
- `envwizard.scanIntervalSeconds`: how often the status bar checks them (default: 5).

### 4. ⭐ EnvWizard Pro: coming in v0.2
Everything above is **free, forever**. Pro will add hands-free extras:
- **Auto-unjam & rerun:** when your dev server fails because its port is held by an old copy of the same project, EnvWizard frees it and restarts your command (opt-in).
- **Live `.env` watcher:** a heads-up as soon as saved code uses an env variable your `.env` doesn't have.
- **Encrypted `.env` snapshots:** a local, encrypted backup before every change, with 1-click restore.
- **Port router:** run this project on another port when the usual one belongs to a different project.

**Pricing:** $9.99 once, for a personal license on all your own machines. No subscription, no account, 30-day refunds. **Pro isn't on sale yet**; sales open when v0.2 ships.

### 🔒 Privacy
Runs locally. Your code, ports and `.env` values never leave your machine. The only network request is a one-time license check with Gumroad when you activate Pro.

---

## 🛠️ Development & Testing

```bash
# Run isolated unit & integration tests (Vitest)
npm test

# Typecheck TypeScript codebase
npm run compile

# Build extension bundle with esbuild
npm run build
```

---

## 📜 License

MIT © Dr. OpenSource
