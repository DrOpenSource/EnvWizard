# AGENTS.md — EnvWizard Project Protocol

Welcome, Agent. You are developing **EnvWizard**, an intent-based local environment guardian and port unjammer extension for **VS Code**, **Cursor**, and **Antigravity**, created for vibe coders and modern developers.

> **🧭 Start every session by reading [`docs/HANDOFF.md`](docs/HANDOFF.md)**: the current state, live versions, decisions log, next steps and environment gotchas. Update it at the end of every session.

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
   - Never tick a `docs/ROADMAP.md` box for a feature that isn't implemented and tested.

6. **Monetization & Pricing Guardrails** (details: [`docs/CLAIMS.md`](docs/CLAIMS.md)):
   - **Model**: Freemium with a **$9.99 one-time personal license** (all of the buyer's own machines, no seat limit, never expires, 30-day refunds). **Pro sales are on hold until v0.2 ships.**
   - **No Subscriptions**: Never introduce monthly/annual recurring charges. Developers and vibe coders value transparent, pay-once tools.
   - **No servers**: The price only works with zero running costs. Don't add features that need a backend, accounts or cloud storage.
   - **Free Tier Integrity**: Manual 1-click unjamming and basic `.env` checking must remain free forever without artificial cripples or spammy nag screens.

7. **Honest Claims**:
   - Every user-facing claim (README, website, listing, in-extension text) must follow `docs/CLAIMS.md`: only shipped and tested features, only measured numbers, and planned features labelled "Coming in v0.2".

---

## 2. Directory Layout & Standards

```
EnvWizard/
├── .github/workflows/ci.yml   # Tests on Windows / macOS / Ubuntu
├── docs/
│   ├── HANDOFF.md             # START HERE: current state, decisions, next steps
│   ├── CLAIMS.md              # Pricing, licensing & approved public copy
│   ├── REVIEW.md              # v0.1.1 field review & open issues
│   ├── ROADMAP.md             # Phase-wise sprint checklist & tracker
│   ├── V0.2_SPEC.md           # v0.2 technical design (v0.2 branch)
│   ├── PUBLISHING.md          # Packaging, publishing & release checklist
│   ├── GUMROAD_KIT.md         # Launch-day listing (not live until v0.2)
│   ├── MEDIA_KIT.md           # Launch posts (check against CLAIMS.md)
│   └── PRD.md                 # Product Requirements Document & User Journeys
├── src/
│   ├── core/                  # Platform-agnostic engine (Zero IDE dependencies)
│   │   ├── PortScanner.ts     # Cross-platform port/PID detection (netstat / lsof / ss)
│   │   ├── ProcessInspector.ts# Process name, command line, cwd (macOS/Linux)
│   │   ├── ProcessTerminator.ts# Two-stage stop, Safety Shield, database list
│   │   ├── EnvHealer.ts       # Env-var pattern scanner, .env parser/appender, git checks
│   │   ├── LicenseManager.ts  # Gumroad license verification
│   │   └── TerminalJamDetector.ts # Port-in-use output detector (v0.2 branch)
│   ├── extension/             # VS Code / Cursor / Antigravity integration
│   │   ├── extension.ts       # Extension entry point & commands
│   │   ├── actions.ts         # Shared confirm/unjam/Clean Slate flows
│   │   ├── StatusBar.ts       # Live status bar radar & quick pick
│   │   └── DevDeckView.ts     # Activity Bar webview dashboard (CSP + nonce)
│   └── shared/                # Shared types, constants, and translations
│       ├── types.ts           # Engine and port contracts
│       └── glossary.ts        # Technical-to-Plain-English translation map
├── test/                      # Vitest unit tests (+ real-process tests)
│   ├── mocks/vscode.ts        # Minimal vscode stub for extension-layer tests
│   └── integration/           # Real VS Code tests via @vscode/test-electron (v0.2 branch)
├── assets/activity-icon.svg   # Monochrome Activity Bar icon (must stay single-colour, transparent)
├── AGENTS.md                  # This agent protocol file
├── index.html                 # Product website (envwizard.taqnik.in)
├── package.json               # Extension manifest and scripts
├── tsconfig.json              # Strict TypeScript compiler options
└── vitest.config.ts           # Vitest unit test runner config
```

---

## 3. GitWizard Interoperability

EnvWizard is designed as the runtime counterpart to **[GitWizard](https://github.com/DrOpenSource/GitWizard)**:
- While GitWizard protects code state and version history, EnvWizard protects the active runtime environment and ports.
- Shared visual language: calm badges, dark-mode glassmorphic aesthetics, non-blocking toasts, and 1-click intent triggers.
