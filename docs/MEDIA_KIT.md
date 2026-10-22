# 🎨 EnvWizard — Media Kit & Launch Kit

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
> *"Scans ports 3000/5173/8000, safely kills background zombie dev servers, and auto-heals missing .env variables from code. Built for vibe coders."*

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
2. 🪦 Safe Zombie Killer (polite shutdown -> force evict if stuck, with system PID shield)
3. 🧩 Secret Box Healer: AI added `process.env.STRIPE_KEY`? EnvWizard spots the diff and offers a 1-click fill.
4. 🧹 1-Click "Clean Slate" to wipe all background servers.

Best part?
Free forever for manual 1-click unjamming.
Pro is a $9.99 ONE-TIME lifetime license. No recurring subscriptions.

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
- 1-click unjams the port with a graceful two-stage shutdown.
- Has a Protected Shield so you never accidentally kill Docker or system services.
- Passively monitors file saves: when new env vars appear in code, it offers 1-click template filling.

It's completely offline-first, collects zero telemetry on your secrets, and has a $9.99 one-time lifetime license (no subscriptions!).

GitHub & VSIX download: https://github.com/DrOpenSource/EnvWizard
Feedback and ideas are welcome!
```

---

### 3. Product Hunt Launch Listing
- **Product Name**: EnvWizard
- **Tagline**: The 1-click port unjammer and dev environment guardian
- **Topics**: Developer Tools, Open Source, Productivity, Artificial Intelligence
- **Pricing**: Free with $9.99 One-Time Lifetime License

**Maker Comment**:
> *"Hey Product Hunt! 👋 We built EnvWizard because AI-assisted coding is fast, but local environments are fragile. Port traffic jams (`EADDRINUSE`) and missing `.env` variables kill flow-state faster than anything else. EnvWizard translates low-level operating system errors into calm, plain-English intent cards. It's safe, private, and 100% offline. Hope it saves you from terminal headaches!"*
