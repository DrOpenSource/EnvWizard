// Runs inside the VS Code extension host. Plain CommonJS, so no build step is needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const vscode = require('vscode');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${what}`)), ms))),
  ]).finally(() => clearTimeout(timer));
}

test('activates and registers all commands', async () => {
  const ext = vscode.extensions.getExtension('dr-opensource.envwizard');
  assert.ok(ext, 'extension not found');
  await ext.activate();
  assert.equal(ext.isActive, true);

  const commands = await vscode.commands.getCommands(true);
  for (const id of ['scanPorts', 'unjamPort', 'cleanSlate', 'auditEnv', 'activateLicense', 'buyLicense', 'restoreSnapshot', 'generateEnvExample']) {
    assert.ok(commands.includes(`envwizard.${id}`), `missing command envwizard.${id}`);
  }
});

test('opens the Dev Deck without errors', async () => {
  await vscode.commands.executeCommand('workbench.view.extension.envwizard-deck');
});

// v0.2 depends on this: EnvWizard must be able to read the output of a command the user
// runs in the integrated terminal and see the "port in use" error (shell integration API).
test('terminal shell integration exposes a port-in-use error from a user command', async () => {
  const port = 39871;
  const blocker = http.createServer().listen(port);
  const terminal = vscode.window.createTerminal({ name: 'EnvWizard jam test' });
  // EnvWizard reacts to this jam too. Dismiss its toast and wait for it to finish, so its
  // handling can't leak into the next test on a slow machine.
  const { terminalAlerts } = vscode.extensions.getExtension('dr-opensource.envwizard').exports;
  const originalChoose = terminalAlerts.chooseAction;
  terminalAlerts.chooseAction = async () => undefined;
  const handled = jamHandledOn(terminalAlerts, port);

  try {
    terminal.show();
    const shellIntegration =
      terminal.shellIntegration ||
      (await withTimeout(
        new Promise((resolve) => {
          const sub = vscode.window.onDidChangeTerminalShellIntegration((e) => {
            if (e.terminal === terminal) {
              sub.dispose();
              resolve(e.shellIntegration);
            }
          });
        }),
        20000,
        'shell integration did not activate'
      ));

    // Listen the way the feature will: passively, for any command started in the terminal
    const output = new Promise((resolve) => {
      const sub = vscode.window.onDidStartTerminalShellExecution(async (e) => {
        if (e.terminal !== terminal) return;
        sub.dispose();
        let text = '';
        for await (const chunk of e.execution.read()) text += chunk;
        resolve({ text, commandLine: e.execution.commandLine.value });
      });
    });

    shellIntegration.executeCommand(`node -e "require('http').createServer().listen(${port})"`);
    const result = await withTimeout(output, 30000, 'terminal command output');

    assert.match(result.text, new RegExp(`EADDRINUSE[^\\n]*${port}`), `no EADDRINUSE in output:\n${result.text}`);
    assert.match(result.commandLine, /listen/);
    await withTimeout(handled, 30000, 'EnvWizard finished handling the jam');
  } finally {
    terminalAlerts.chooseAction = originalChoose;
    terminal.dispose();
    blocker.close();
  }
});

function waitForShellIntegration(terminal) {
  if (terminal.shellIntegration) return Promise.resolve(terminal.shellIntegration);
  return withTimeout(
    new Promise((resolve) => {
      const sub = vscode.window.onDidChangeTerminalShellIntegration((e) => {
        if (e.terminal === terminal) {
          sub.dispose();
          resolve(e.shellIntegration);
        }
      });
    }),
    20000,
    'shell integration did not activate'
  );
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

async function waitFor(check, ms, what) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out after ${ms}ms: ${what}`);
}

/** Resolves with the outcome of the next jam on `port` only, so a late event from another test can't leak in. */
function jamHandledOn(terminalAlerts, port) {
  return new Promise((resolve) => {
    const sub = terminalAlerts.onDidHandleJam((outcome, jam) => {
      if (jam.port !== port) return;
      sub.dispose();
      resolve(outcome);
    });
  });
}

/** Collects EnvWizard's output-channel lines while a test runs; call the result to stop and read them. */
function captureLog(terminalAlerts) {
  const deps = terminalAlerts.deps;
  const original = deps.log;
  const lines = [];
  deps.log = (line) => {
    lines.push(line);
    if (original) original(line);
  };
  return () => {
    deps.log = original;
    return lines.join(' / ');
  };
}

// Sprint 2 gate (F1): a jam in the terminal → toast "Free & Rerun" → the rerun binds the port.
test('terminal jam: Free & Rerun frees the port and the rerun binds it', async () => {
  const port = 39872;
  const { terminalAlerts } = vscode.extensions.getExtension('dr-opensource.envwizard').exports;
  const blocker = spawn('node', ['-e', `require('http').createServer().listen(${port})`], { stdio: 'ignore' });
  const blockerExited = new Promise((resolve) => blocker.once('exit', resolve));
  const terminal = vscode.window.createTerminal({ name: 'EnvWizard rerun test' });
  const alerts = [];
  const originalChoose = terminalAlerts.chooseAction;

  try {
    await waitFor(() => canConnect(port), 10000, 'blocker listening');
    terminal.show();
    const shellIntegration = await waitForShellIntegration(terminal);

    terminalAlerts.chooseAction = async (alert) => {
      if (!alert.message.includes(`Port ${port} `)) return undefined; // Not this test's jam
      alerts.push(alert);
      return 'Free & Rerun';
    };
    const outcome = jamHandledOn(terminalAlerts, port);
    const stopLog = captureLog(terminalAlerts);

    shellIntegration.executeCommand(`node -e "require('http').createServer().listen(${port})"`);

    const result = await withTimeout(outcome, 45000, 'jam handled');
    const log = stopLog();
    assert.equal(result, 'freed-rerun', `log: ${log}`);
    assert.match(alerts[0].message, new RegExp(`Port ${port} jam`));
    await withTimeout(blockerExited, 10000, 'blocker stopped');
    // The rerun in the terminal now holds the port
    await waitFor(() => canConnect(port), 15000, 'rerun listening');
  } finally {
    terminalAlerts.chooseAction = originalChoose;
    terminal.dispose();
    blocker.kill();
  }
});

// Sprint 3 (F2): an old copy of this project is freed and rerun without a toast. On Windows the
// holder's folder can't be read, so this also proves "this project" is found from its command line.
test('auto-unjam: an old copy of this project is freed and rerun without asking', async () => {
  const port = 39873;
  const ext = vscode.extensions.getExtension('dr-opensource.envwizard');
  const { terminalAlerts } = ext.exports;
  const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const script = path.join(folder, 'server.js');
  fs.writeFileSync(script, 'require("http").createServer().listen(Number(process.argv[2]));\n');

  const blocker = spawn('node', [script, String(port)], { cwd: folder, stdio: 'ignore' });
  const blockerExited = new Promise((resolve) => blocker.once('exit', resolve));
  const terminal = vscode.window.createTerminal({ name: 'EnvWizard auto test', cwd: folder });
  // A Pro license can't be activated in tests; switch the gate on directly
  const deps = terminalAlerts.deps;
  const originalGate = deps.isAutoUnjamEnabled;
  const originalChoose = terminalAlerts.chooseAction;
  let toastShown = false;

  try {
    deps.isAutoUnjamEnabled = async () => true;
    let toastText = '';
    terminalAlerts.chooseAction = async (alert) => {
      if (!alert.message.includes(`Port ${port} `)) return undefined; // Not this test's jam
      toastShown = true;
      toastText = alert.message;
      return undefined;
    };
    await waitFor(() => canConnect(port), 10000, 'blocker listening');
    terminal.show();
    const shellIntegration = await waitForShellIntegration(terminal);
    const outcome = jamHandledOn(terminalAlerts, port);
    const stopLog = captureLog(terminalAlerts);

    shellIntegration.executeCommand(`node server.js ${port}`);

    // On failure, say which safety condition didn't hold (ownership is in the toast text)
    const result = await withTimeout(outcome, 45000, 'jam handled');
    const log = stopLog();
    assert.equal(
      result,
      'freed-rerun',
      `toast: "${toastText}" | workspace: ${folder} | terminal cwd: ${shellIntegration.cwd && shellIntegration.cwd.fsPath} | log: ${log}`
    );
    assert.equal(toastShown, false, 'auto-unjam should not ask');
    await withTimeout(blockerExited, 10000, 'blocker stopped');
    await waitFor(() => canConnect(port), 15000, 'rerun listening');
  } finally {
    deps.isAutoUnjamEnabled = originalGate;
    terminalAlerts.chooseAction = originalChoose;
    terminal.dispose();
    blocker.kill();
  }
});

// Sprint 4 (F5): saving .env in the editor keeps encrypted snapshots of the old and new versions,
// using the editor's real secret storage; nothing readable lands in the snapshot folder.
test('snapshots: saving .env keeps encrypted before/after copies', async () => {
  const { snapshots } = vscode.extensions.getExtension('dr-opensource.envwizard').exports;
  const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const envPath = path.join(folder, '.env');
  const deps = snapshots.deps;
  const originalGate = deps.isEnabled;
  const secret = 'sk_live_IntegrationSecret123';

  try {
    deps.isEnabled = async () => true; // A Pro license can't be activated in tests
    const before = fs.readFileSync(envPath, 'utf8');
    const doc = await vscode.workspace.openTextDocument(envPath);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((b) => b.insert(new vscode.Position(doc.lineCount, 0), `STRIPE_KEY=${secret}
`));
    await doc.save();

    let contents = [];
    await waitFor(async () => {
      const list = snapshots.store.list(folder, envPath);
      contents = await Promise.all(list.map((i) => snapshots.store.read(i)));
      return contents.length >= 2;
    }, 10000, 'two snapshots');
    assert.ok(contents.includes(before), 'old version kept');
    assert.ok(contents.some((c) => c.includes(secret)), 'new version kept');

    for (const info of snapshots.store.list(folder, envPath)) {
      assert.equal(fs.readFileSync(info.file).includes(Buffer.from(secret)), false, 'snapshot is encrypted');
    }
  } finally {
    deps.isEnabled = originalGate;
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
});

exports.run = async function run() {
  const failures = [];
  for (const { name, fn } of tests) {
    const started = Date.now();
    try {
      await fn();
      console.log(`  ✓ ${name} (${Date.now() - started}ms)`);
    } catch (err) {
      console.log(`  ✗ ${name}\n    ${(err && err.stack) || err}`);
      failures.push(name);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} integration test(s) failed`);
  }
};
