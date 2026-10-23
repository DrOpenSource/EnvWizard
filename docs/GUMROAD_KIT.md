# 🛍️ EnvWizard: Gumroad Listing & Fulfillment Kit

> **Publish when 0.2.0 is live on both registries** (see [`CLAIMS.md`](CLAIMS.md)). Every Pro bullet below shipped and is tested in 0.2.0. The port router was moved to a later version and is deliberately not listed.

---

## 1. Product Setup Overview

| Field | Exact Value to Enter |
| :--- | :--- |
| **Product Name** | `EnvWizard Pro: Personal License` |
| **Product Type** | `Digital product` |
| **Price** | `$9.99` |
| **Currency** | `USD ($)` |
| **Custom URL Slug** | `envwizard` (Result: `https://kashyapster867.gumroad.com/l/envwizard`) |
| **Cover Image** | Upload `assets/gumroad_cover.png` (16:9 1280×720). Redone 2026-10-23 to match 0.2.0; the old cover said "Zero-Click", "AST" and ".env Healer". |
| **Thumbnail Image** | Upload `assets/gumroad_thumbnail.jpg` (1:1 600×600) |

---

## 2. Product Summary (One-Liner)

```text
Hands-free extras for EnvWizard: auto-unjam & rerun, a live .env watcher and encrypted .env snapshots. $9.99 once, personal license, no subscription.
```

---

## 3. Full Product Description (Copy & Paste into Gumroad)

```markdown
### 🔌 EnvWizard Pro

EnvWizard (free) shows what's holding your dev ports, frees them safely in one click, and finds the env variables your code needs but your `.env` is missing.

**Pro adds the hands-free extras:**

- 🚦 **Auto-unjam & rerun**: when `npm run dev` fails because an old copy of the *same project* still holds the port, EnvWizard frees it and reruns your command without asking. It never touches other projects, databases, Docker or your editor, and asks instead if the same port jams again within a minute. Needs terminal shell integration (VS Code's default for PowerShell, bash, zsh and fish).
- 🧩 **Live .env watcher**: when you (or your AI assistant) save code that uses an env variable no env file defines, EnvWizard tells you once and offers to add it.
- 🔐 **Encrypted .env snapshots**: the last 20 versions of each env file, encrypted on your computer, with a side-by-side preview before you restore. Nothing is uploaded; snapshots can't be opened on another computer.

**Every Pro feature is off until you turn it on** in Settings. Everything in the free version stays free.

---

### 💳 Fair, simple licensing
- **$9.99 once.** No subscription, no account.
- **Personal license:** use it on all of your own machines. Please don't share it with other people or teams.
- **Never expires.** Pro updates are included for as long as EnvWizard is maintained.
- **30-day refunds**, no questions asked.

### 🛡️ Private by design
Everything runs locally. Your code, ports and `.env` values never leave your machine. The only network request is a one-time license check with Gumroad when you activate Pro.

### 🚀 Activate in 30 seconds
1. Install **EnvWizard** from the VS Code Marketplace (or Open VSX for Cursor / Antigravity).
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **EnvWizard: Activate Pro License**.
3. Paste the license key from your receipt.
4. Turn on the Pro features you want in Settings (search "envwizard").

Support is best-effort via GitHub issues or support@taqnik.in.
```

---

## 4. Crucial Settings Checklist (Gumroad Dashboard)

Under **Product Settings** → **Settings**:
- [ ] **"Generate a unique license key per sale"** → **ON** (the extension verifies these keys with Gumroad's license API).
- [ ] **"Allow customers to choose a quantity"** → OFF (quantity = 1).
- [ ] **"Mark as e-publication"** → OFF.
- [ ] **Refund Policy** → 30-day refund.
- [ ] Confirm the product ID still matches the one in `src/core/LicenseManager.ts` (`gumroadProductId`).

---

## 5. Receipt & Thank-You Note (Copy & Paste into Gumroad)

Under **Checkout** → **Receipt** → **Thank you note**:

```markdown
Thank you for supporting EnvWizard and independent developer tooling! 🔌

Your license key is shown below and has also been emailed to you.

HOW TO ACTIVATE IN VS CODE / CURSOR / ANTIGRAVITY:
1. Open the Command Palette: Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (Mac).
2. Run: EnvWizard: Activate Pro License
3. Paste your license key and press Enter. (Activation needs internet once; Pro then works offline.)
4. Turn on the Pro features you want: Settings → search "envwizard" (Auto Unjam, Env Watcher, Snapshots).

It's a personal license: use it on all your own machines.

Need help? Open an issue at https://github.com/DrOpenSource/EnvWizard or email support@taqnik.in.

Happy vibe coding! 🚀
```
