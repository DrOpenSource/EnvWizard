# 🚀 EnvWizard — Multi-Registry Publishing Guide

This guide walks you through publishing **EnvWizard** across the three major extension ecosystems:
1. **VS Code Marketplace** (Official Microsoft Store)
2. **Open VSX Registry** (Native registry for **Cursor**, **Antigravity**, **VSCodium**, **Gitpod**)
3. **Direct VSIX Releases** (GitHub Releases 1-click install for vibe coders)

---

## 📋 Prerequisites Checklist

- [x] Extension compiled and bundled (`npm run build`)
- [x] Unit & integration tests passing (`npm test`)
- [x] 256x256 PNG icon in [`assets/icon.png`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/EnvWizard/assets/icon.png)
- [x] [`README.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/EnvWizard/README.md) with feature demos & clear messaging
- [x] [`LICENSE`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/EnvWizard/LICENSE) (MIT) and [`PRIVACY.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/EnvWizard/PRIVACY.md) in place
- [x] `.vscodeignore` configured to exclude dev source files

---

## 1. Publishing to VS Code Marketplace (Microsoft)

### Step 1.1: Create Azure DevOps Personal Access Token (PAT)
1. Sign in to [Azure DevOps](https://dev.azure.com/).
2. Create an organization if you haven't already (e.g. `dropensource`).
3. Click the **User Settings** (gear with user icon) in top right $\rightarrow$ **Personal Access Tokens**.
4. Click **+ New Token**:
   - **Name**: `EnvWizard-VSCE-Publisher`
   - **Organization**: `All accessible organizations`
   - **Expiration**: `90 days` (or 1 year)
   - **Scopes**: Select **Custom defined**, scroll to **Marketplace**, and check:
     - `Acquire`
     - `Manage`
5. Click **Create** and copy the generated token string immediately.

### Step 1.2: Web Portal Upload (Quickest / Drag-and-Drop)
1. Go to the [VS Code Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. Select your publisher: **`dr-opensource`**.
3. Click **+ New extension** $\rightarrow$ **Visual Studio Code**.
4. Drag and drop the **`envwizard-0.1.0.vsix`** file (now packaged with publisher `dr-opensource`).
5. Click **Upload**.

### Step 1.3: Terminal CLI via VSCE (Alternative)
```bash
# Login with your publisher ID 'dr-opensource'
npx @vscode/vsce login dr-opensource

# Publish live to Marketplace
npx @vscode/vsce publish
```

---

## 2. Publishing to Open VSX Registry (Cursor & Antigravity)

**Cursor**, **Antigravity**, and **VSCodium** query the [Open VSX Registry](https://open-vsx.org/) by default.

### Step 2.1: Open VSX Namespace
1. Sign in to [Open VSX](https://open-vsx.org/) using your GitHub account.
2. Claim or verify the namespace: **`dr-opensource`** (matches `publisher` in `package.json`).
3. You can also upload `envwizard-0.1.0.vsix` directly on the Open VSX website under **Publish Extension**.

### Step 2.2: Generate Access Token
1. Go to **Settings** $\rightarrow$ **Access Tokens**.
2. Generate a new token with write access to `DrOpenSource`.

### Step 2.3: Publish via OVSX CLI
```bash
# Publish the generated .vsix directly to Open VSX
npx ovsx publish envwizard-0.1.0.vsix -p <YOUR_OVSX_TOKEN>
```
*Once published, EnvWizard will be searchable and installable natively within Cursor's and Antigravity's Extension tab within 10 minutes.*

---

## 3. GitHub Releases & Direct Sideloading

For instant viral distribution and vibe coders who want to drag-and-drop the extension:

1. Create a Git tag and push to GitHub:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. Go to `https://github.com/DrOpenSource/EnvWizard/releases/new`.
3. Set release tag to `v0.1.0`, title to `🔌 EnvWizard v0.1.0 — Safe Local Dev Guardian`.
4. Attach `envwizard-0.1.0.vsix` as a binary asset.
5. Vibe coders can install it instantly in VS Code, Cursor, or Antigravity via:
   - `Extensions (...) Menu` $\rightarrow$ `Install from VSIX...` $\rightarrow$ choose `envwizard-0.1.0.vsix`.

---

## 4. Pro License (Gumroad)

> ⏸ **Pro sales are on hold until v0.2.** Launch-day listing copy and dashboard settings are in [`GUMROAD_KIT.md`](GUMROAD_KIT.md); pricing and licence rules are in [`CLAIMS.md`](CLAIMS.md).

- **Keys:** Gumroad generates a unique license key per sale. The extension verifies keys with Gumroad's license API (`LicenseManager.verifyGumroadKey`). There are no self-generated `ENVWIZ-` keys anymore.
- **In-app:** `EnvWizard: Activate Pro License` → paste key → verified online once → stored in editor secret storage → works offline afterwards.

---

## 5. Release Checklist (every version)

1. Check the live versions: Marketplace (`extensionquery` API for `dr-opensource.envwizard`) and Open VSX (`https://open-vsx.org/api/dr-opensource/envwizard`). Published versions can't be replaced, so the new version must be higher than **both**.
2. Bump `package.json` `version`, and update `CHANGELOG.md`.
3. Run `npm run compile`, `npm test`, `npm run test:integration` (where available) and `npm run build`.
4. Run `npx @vscode/vsce package --out envwizard-<version>.vsix`, then confirm the `<Identity Id="envwizard" Publisher="dr-opensource" Version="…">` inside the VSIX.
5. Run `npx @vscode/vsce publish --packagePath envwizard-<version>.vsix` and `npx ovsx publish envwizard-<version>.vsix -p <OVSX_TOKEN>`.
6. Commit, tag `v<version>`, push.
