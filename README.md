# 🔌 EnvWizard — Safe Local Dev Guardian for Vibe Coders

> **Zero port collisions. Zero missing secrets. Instant flow-state.**  
> 🌐 Website: [https://envwizard.taqnik.in](https://envwizard.taqnik.in) • ⚡ [Get Lifetime Pro ($9.99)](https://envwizard.taqnik.in)

**EnvWizard** is an intent-based local runtime guardian and port unjammer extension for **VS Code**, **Cursor**, and **Antigravity**. It sits alongside [GitWizard](https://github.com/DrOpenSource/GitWizard) as part of the DrOpenSource Calm Dev Suite.

---

## ⚡ Why EnvWizard?

Vibe coders iterate conversationally: asking AI models to generate entire features, spin up servers, and configure environment variables. But local dev environments break constantly:

- **Port Traffic Jams (`EADDRINUSE`)**: A forgotten background server hogs port `3000` or `5173`.
- **Missing Secrets**: AI introduces `process.env.STRIPE_KEY` into code, but your local `.env` doesn't have it, causing unhandled runtime crashes.
- **Ghost Servers**: Forgotten Node/Python child processes eat 25% CPU silently.

EnvWizard translates terrifying operating system errors into calm, plain-English intent cards with 1-click healing.

---

## 🌟 Core Features

### 1. 🚦 Real-Time Port Radar & 1-Click Unjammer
- Live radar in your Status Bar: `🔌 Dev: All Clear` or `🚨 Busy: :3000`.
- 1-Click to safely evict the background process and free the door in < 100ms.
- **Safe Process Shield**: Protected PIDs (system processes, Docker daemon, IDE itself) can never be accidentally killed.

### 2. 🧩 Secret Box (.env) Auto-Healer
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

### 4. 🏷️ $9.99 One-Time Lifetime License
- **No Subscriptions**: Developers prefer simple, pay-once pricing.
- Free tier gives you manual 1-click port unjamming forever.
- $9.99 Pro tier unlocks automatic background daemon, AST file-save watchers, and multi-project routing.

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
