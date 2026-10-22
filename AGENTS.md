# AGENTS.md — EnvWizard Project Protocol

Welcome, Agent. You are developing **EnvWizard**, an intent-based local environment guardian and port unjammer extension for **VS Code**, **Cursor**, and **Antigravity**, created for vibe coders and modern developers.

---

## 1. Core Operating Principles

1. **Safety First (Protected Process Shield)**:
   - Never kill system processes (`explorer.exe`, `WindowServer`, `dockerd`, IDE instances) under any circumstances.
   - Always verify process ownership and project directory before proposing or executing termination.
   - Use graceful two-stage shutdown (`SIGTERM` / polite close -> 800ms wait -> `SIGKILL` only if stuck).

2. **Zero Config Data Loss**:
   - Never overwrite or truncate an existing `.env` or `.env.local` file.
   - Always append missing keys with `# Added by EnvWizard` annotations and preserve comments, quotes, and whitespace.

3. **Plain-English UX for Vibe Coders**:
   - Do not surface raw POSIX signals (`SIGKILL`, `SIGTERM`), socket constants (`EADDRINUSE`, `ECONNREFUSED`), or raw PIDs without an immediate, friendly translation card.
   - Use reassuring, calm metaphors: *"Port Traffic Jam"*, *"Ghost Server"*, *"Missing Secret Key"*.

4. **Lean Context & Cost Optimization**:
   - Do not bloat context with large repetitive process dumps or OS command logs.
   - Reference detailed requirements in `docs/PRD.md` and track execution state in `docs/ROADMAP.md`.
   - Maintain trackable sprint progress via checkboxes in `docs/ROADMAP.md` rather than repeating plans in chat.

5. **Strict Automated Verification**:
   - Every sprint feature must have automated unit tests in `test/` using Vitest.
   - Test real TCP socket binding and unjamming edge cases (e.g., zombie child processes, unreadable PIDs, permission boundaries).
   - Verify cross-platform compatibility across Windows (PowerShell / `netstat`), macOS (`lsof`), and Linux (`ss`).
   - Always run `npm test` and `npm run compile` before marking tasks complete.

6. **Monetization & Pricing Guardrails**:
   - **Model**: Freemium with a **$9.99 One-Time Lifetime License**.
   - **No Subscriptions**: Never introduce monthly/annual recurring charges. Developers and vibe coders value transparent, pay-once tools.
   - **Free Tier Integrity**: Manual 1-click unjamming and basic `.env` checking must remain free forever without artificial cripples or spammy nag screens.

---

## 2. Directory Layout & Standards

```
EnvWizard/
├── docs/
│   ├── PRD.md                 # Product Requirements Document & User Journeys
│   └── ROADMAP.md             # Phase-wise sprint checklist & tracker
├── src/
│   ├── core/                  # Platform-agnostic engine (Zero IDE dependencies)
│   │   ├── PortScanner.ts     # Cross-platform port and PID detection
│   │   ├── ProcessInspector.ts# Resolves binary names, cwd, and uptimes
│   │   ├── ProcessTerminator.ts# Graceful tree-killing with safety blacklist
│   │   ├── EnvHealer.ts       # AST code scanner & .env diff/serializer
│   │   └── LicenseManager.ts  # $9.99 cryptographic key verification
│   ├── extension/             # VS Code / Cursor / Antigravity integration
│   │   ├── extension.ts       # Extension entry point & lifecycle hooks
│   │   ├── StatusBar.ts       # Live status bar radar & quick actions
│   │   └── DevDeckView.ts     # Activity Bar webview dashboard
│   └── shared/                # Shared types, constants, and translations
│       ├── types.ts           # Engine and port contracts
│       └── glossary.ts        # Technical-to-Plain-English translation map
├── test/
│   ├── port-scanner.test.ts   # Socket binding and resolution tests
│   ├── terminator.test.ts     # Safe process killing and blacklist tests
│   └── env-healer.test.ts     # AST regex and .env parsing edge cases
├── AGENTS.md                  # This agent protocol file
├── index.html                 # Ecosystem portfolio & showcase page
├── package.json               # Extension manifest and scripts
├── tsconfig.json              # Strict TypeScript compiler options
└── vitest.config.ts           # Vitest unit test runner config
```

---

## 3. GitWizard Interoperability

EnvWizard is designed as the runtime counterpart to **[GitWizard](https://github.com/DrOpenSource/GitWizard)**:
- While GitWizard protects code state and version history, EnvWizard protects the active runtime environment and ports.
- Shared visual language: calm badges, dark-mode glassmorphic aesthetics, non-blocking toasts, and 1-click intent triggers.
