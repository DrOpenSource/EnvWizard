# 🎨 EnvWizard — Media Kit & Launch Kit

> Before posting anything, check it against [`CLAIMS.md`](CLAIMS.md): only shipped features, no Pro sales until v0.2.

Welcome to the **EnvWizard Media Kit**. This document provides ready-to-use brand assets, store copy, promotional posts, and launch kits for announcing EnvWizard on Product Hunt, X (Twitter), Reddit, and developer communities.

---

## 💎 Brand Identity & Visual Assets

### Official Icon
- **Vector SVG**: [`assets/icon.svg`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/EnvWizard/assets/icon.svg)
- **Marketplace PNG (256x256)**: [`assets/icon.png`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/EnvWizard/assets/icon.png)
- **Visual Motif**: Electric glowing plug and socket on a dark slate background, symbolizing instant port unjamming and clean energy for vibe coders.

### Official Palette
| Token | Hex Code | Visual Usage |
| :--- | :--- | :--- |
| **Neon Indigo** | `#6366f1` | Primary brand accent & buttons |
| **Electric Cyan** | `#06b6d4` | Active port indicators & glow highlights |
| **Emerald Calm** | `#10b981` | "Dev All Clear" status badge |
| **Amber Jam** | `#f59e0b` | Port traffic jam & missing secret warnings |
| **Obsidian Dark** | `#0a0d14` | Dark mode background |

---

## 📢 Product Taglines & Store Listings

### 1-Line Taglines (Marketplaces & Badges)
- *"Zero port collisions. Zero missing secrets. Instant flow-state."*
- *"The 1-click port unjammer and dev environment guardian for VS Code, Cursor, and Antigravity."*
- *"Never Google EADDRINUSE again."*

### Short Description (Under 150 chars)
> *"Scans ports 3000/5173/8000, safely kills background zombie dev servers, and finds missing .env variables and adds placeholders. Built for vibe coders."*

---

## 🚀 Community Launch Templates

### 1. Twitter / X Launch Thread
```markdown
🧵 Meet EnvWizard: The 1-Click Port Unjammer & Dev Guardian for Cursor, VS Code, and Antigravity 🔌

Every developer knows the pain:
You ask AI to generate an app, run `npm run dev`, and hit:
🚨 Error: listen EADDRINUSE: address already in use :::3000

Instead of hunting down rogue PIDs with `lsof` or `netstat`, EnvWizard gives you a calm 1-click button:
⚡ [Unjam Port 3000]

What it does:
1. 🚦 Real-time Port Radar in your status bar
2. 🪦 Safe Zombie Killer (asks first, and refuses to stop your editor, Docker, WSL or system processes)
3. 🧩 Secret Box Check: AI added `process.env.STRIPE_KEY`? EnvWizard finds it missing from .env and adds a placeholder in 1 click.
4. 🧹 1-Click "Clean Slate" to stop leftover dev servers (databases are left alone).

Best part?
Free forever.
Pro (hands-free extras) is coming with v0.2: $9.99 once, personal license, no subscription.

Check it out: https://github.com/DrOpenSource/EnvWizard
```

---

### 2. Reddit (r/Cursor, r/webdev, r/reactjs)
```markdown
Title: I built a 1-click port unjammer & .env guardian for Cursor / VS Code so you never have to kill -9 again

Hey everyone,

Like many of you vibe-coding with Cursor and Antigravity, I found myself constantly hitting `EADDRINUSE` because an earlier background server was still hogging port 3000 or 5173. Or worse, the AI added a new `process.env.VAR` into code that wasn't in my `.env`, crashing the app silently.

I got tired of running `lsof -ti:3000 | xargs kill -9`, so I built **EnvWizard**:
- Sits in the status bar: shows `🔌 Dev: All Clear` or `🚨 Busy: :3000`
- Shows which program holds the port and frees it in 1 click after a confirmation.
- Refuses to stop programs on its protected list (your editor, Docker, WSL, system processes).
- Finds env variables your code uses that are missing or blank in .env / .env.local, and adds placeholders in 1 click.

It runs locally, collects zero telemetry, and the core is free. A $9.99 one-time Pro (no subscription) is coming with v0.2.

GitHub & VSIX download: https://github.com/DrOpenSource/EnvWizard
Feedback and ideas are welcome!
```

---

### 3. Product Hunt Launch Listing
- **Product Name**: EnvWizard
- **Tagline**: The 1-click port unjammer and dev environment guardian
- **Topics**: Developer Tools, Open Source, Productivity, Artificial Intelligence
- **Pricing**: Free. Pro ($9.99 one-time personal license) launches with v0.2

**Maker Comment**:
> *"Hey Product Hunt! 👋 We built EnvWizard because AI-assisted coding is fast, but local environments are fragile. Port traffic jams (`EADDRINUSE`) and missing `.env` variables kill flow-state faster than anything else. EnvWizard translates low-level operating system errors into calm, plain-English intent cards. It's safe, private, and runs locally. Hope it saves you from terminal headaches!"*
