# 🔒 Privacy Policy — EnvWizard

> **Last Updated: October 2026**

At **Dr. OpenSource**, we believe developer tools should operate with total transparency and zero surveillance. **EnvWizard** is built from the ground up as an offline-first, local-only developer environment guardian.

---

## 1. Zero Network Transmission of Secrets

- **No Remote Calls for Environment Data**: EnvWizard reads your `.env` files and the names and command lines of programs listening on your dev ports **strictly locally on your computer**.
- **No Telemetry on Keys or Values**: Variable names (`STRIPE_KEY`, `OPENAI_API_KEY`) and their corresponding values are **never sent to any external server, analytics service, or third-party endpoint**.
- **Local Code Scanning**: Pattern-matching of code files (`.ts`, `.tsx`, `.py`, etc.) occurs entirely in memory within your local editor process.

---

## 2. Process Inspection & Port Diagnostics

- EnvWizard uses native operating system APIs (`netstat`, `lsof`, `Get-CimInstance`, `ps`) exclusively to identify which process is holding a port.
- No details about your processes, directory names, or project contents are ever recorded, uploaded, or shared.

---

## 3. Encrypted `.env` Snapshots (Pro, off by default)

- If you turn on `envwizard.snapshots` with a Pro license, EnvWizard keeps copies of your env files (`.env`, `.env.local` and similar) so you can undo a bad edit. A copy is made when the editor opens, before and after each save of an env file, and before EnvWizard itself adds keys to one.
- Every copy is **encrypted with AES-256-GCM** before it is written. The encryption key is created on your computer and kept in your editor's secret storage (`vscode.ExtensionContext.secrets`), never in the snapshot folder.
- Copies are stored only in the extension's local storage folder on your computer. They are **never uploaded or synced**. Folder names are a hash of your project path, so they don't reveal it; only the env file's name within the project (e.g. `apps/web/.env.local`) is stored in plain text. The last 20 copies per file are kept; older ones are deleted.
- When you restore, the old version is decrypted in memory to show you the difference. It is only written to disk when you confirm, and then only to the env file itself.
- If the key is lost (for example, on a new computer or after reinstalling the editor), old copies can't be opened by anyone, including you.

---

## 4. License Validation

- **Pro License Key Verification**: If you choose to activate EnvWizard Pro (a one-time personal license), the license key you paste is sent **once**, at activation, to Gumroad's license API (`api.gumroad.com`) to confirm the purchase. Nothing else (no code, ports, paths or `.env` contents) is included in that request.
- After activation your license key is stored in your editor's native secret storage (`vscode.ExtensionContext.secrets`) and Pro keeps working offline. It is never sent to any telemetry or analytics service.

---

## 5. Third-Party Analytics & Tracking

- EnvWizard contains **zero tracking pixels, zero analytics SDKs (e.g. Google Analytics, Mixpanel, PostHog), and zero ad trackers**.
- What happens on your machine stays on your machine.

---

## 6. Contact & Questions

If you have any questions or security concerns regarding EnvWizard, please open an issue on our official GitHub repository:
- **Repository**: [https://github.com/DrOpenSource/EnvWizard](https://github.com/DrOpenSource/EnvWizard)
- **Organization**: [Dr. OpenSource](https://github.com/DrOpenSource)
