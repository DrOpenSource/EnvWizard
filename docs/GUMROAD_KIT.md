# 🛍️ EnvWizard: Gumroad Listing & Fulfillment Kit

> **⏸ Do not publish yet.** Pro sales are on hold until v0.2 ships the Pro features (see [`CLAIMS.md`](CLAIMS.md)). This is the ready-to-paste listing for launch day. Before pasting, re-check that every Pro bullet below has actually shipped in the published version; remove any that haven't.

---

## 1. Product Setup Overview

| Field | Exact Value to Enter |
| :--- | :--- |
| **Product Name** | `EnvWizard Pro: Personal License` |
| **Product Type** | `Digital product` |
| **Price** | `$9.99` |
| **Currency** | `USD ($)` |
| **Custom URL Slug** | `envwizard` (Result: `https://kashyapster867.gumroad.com/l/envwizard`) |
| **Cover Image** | Upload `assets/gumroad_cover.jpg` (16:9 1280×720). **Check the image text first:** it must not show features or claims that aren't shipped. |
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

- 🚦 **Auto-unjam & rerun**: when `npm run dev` fails because an old copy of the *same project* still holds the port, EnvWizard frees it and reruns your command. Opt-in, and it never touches other projects, databases, Docker or your editor.
- 🧩 **Live .env watcher**: the moment you (or your AI assistant) save code that uses a new env variable, EnvWizard tells you it's missing and offers to add it.
- 🔐 **Encrypted .env snapshots**: a local, encrypted copy of your `.env` before every change, with 1-click restore.
- 🔀 **Port router**: run this project on another port when the usual one belongs to a different project.

Everything in the free version stays free.

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

It's a personal license: use it on all your own machines.

Need help? Open an issue at https://github.com/DrOpenSource/EnvWizard or email support@taqnik.in.

Happy vibe coding! 🚀
```
